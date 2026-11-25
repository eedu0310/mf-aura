/**
 * O que a tela do escritório virtual recebe (GET /api/gestor/agentes).
 *
 * Monta o EstadoEscritorio do contrato (tipos.ts) a partir do registro de
 * agentes, do diário de rodadas, das recomendações, das falas e da base de
 * conhecimento. Lê com a chave de serviço: a rota já conferiu que quem pediu
 * é gestor aprovado.
 *
 * Gestor de UMA loja (empresa preenchida) vê só as falas e as contagens de
 * achados da própria loja (e as falas sem loja, que são da equipe toda); o
 * gestor mestre (empresa null) vê tudo.
 *
 * Sem a migração 110: a equipe aparece inteira, com "aguardando_ativacao",
 * e o aviso em motivoInativo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";
import { inicioDoDiaEmSaoPaulo } from "@/lib/fuso";
import { BUCKET_NUVEM } from "@/lib/backup/executar";
import { carregarRegistro, temMigracao108, type AgenteRegistrado } from "./motor";
import { agendaTexto, estaAtrasado, proximaExecucao } from "./agenda";
import { CRON_DO_AGENTE_DO_SISTEMA } from "./sistema";
import { PASTA_CONHECIMENTO, diaDoCaminho } from "./guardiao";
import { MOTIVO_SEM_108, faltaNoBanco, gestorDaFala } from "./util";
import { ID_DIRETORA } from "./diretora";
import type {
  ConfigAgenteConfiguravel,
  EstadoEscritorio,
  EstadoMesa,
  FalaEscritorio,
  MesaAgente,
  PropostaListada,
  Setor,
} from "./tipos";

const DIA = 86_400_000;
const RODANDO_VALIDA_MS = 20 * 60_000;

type Execucao = NonNullable<MesaAgente["execucoes"]>[number];

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

/** Filtro "fala da minha loja ou sem loja" no formato do PostgREST. */
function filtroLoja(empresa: string): string {
  return `empresa.is.null,empresa.eq."${empresa.replace(/"/g, '\\"')}"`;
}

async function execucoesDosAgentes(sb: SupabaseClient, ids: string[]): Promise<Map<string, Execucao[]>> {
  const mapa = new Map<string, Execucao[]>();
  await Promise.all(
    ids.map(async (id) => {
      const { data } = await sb
        .from("aura_agente_execucoes")
        .select("inicio, fim, status, resumo, achados, custo_usd")
        .eq("agente_id", id)
        .order("inicio", { ascending: false })
        .limit(10);
      mapa.set(
        id,
        (data ?? []).map((e) => ({
          inicio: e.inicio as string,
          fim: (e.fim as string | null) ?? null,
          status: e.status as Execucao["status"],
          resumo: (e.resumo as string | null) ?? "",
          achados: Number(e.achados ?? 0),
          custoUsd: Number(e.custo_usd ?? 0),
        })),
      );
    }),
  );
  return mapa;
}

/** As rotinas do sistema vêm do diário dos crons (migração 105). */
async function execucoesDosCrons(sb: SupabaseClient): Promise<Map<string, Execucao[]>> {
  const mapa = new Map<string, Execucao[]>();
  await Promise.all(
    Object.entries(CRON_DO_AGENTE_DO_SISTEMA).map(async ([id, cron]) => {
      const { data, error } = await sb
        .from("aura_execucoes_cron")
        .select("inicio, fim, ok, detalhe")
        .eq("nome", cron)
        .order("inicio", { ascending: false })
        .limit(10);
      if (error) return; // 105 ainda não aplicada: mesa sem histórico
      mapa.set(
        id,
        (data ?? []).map((e) => {
          const detalhe = (e.detalhe ?? null) as { erro?: string } | null;
          return {
            inicio: e.inicio as string,
            fim: (e.fim as string | null) ?? null,
            status: e.ok ? "ok" : "erro",
            resumo: e.ok ? "Rodou." : `Falhou: ${detalhe?.erro ?? "sem mensagem"}`,
            achados: 0,
            custoUsd: 0,
          } as Execucao;
        }),
      );
    }),
  );
  return mapa;
}

/*
 * A luz da mesa. Antes, fora dos segundos da rodada, todo agente ficava
 * cinza ("ocioso") — mesmo ligado e em dia — e o escritório parecia parado
 * (25/11/2026). Agora: verde = em dia; verde piscando = trabalhando agora;
 * amarelo = atrasado; vermelho = erro; cinza = ainda não rodou.
 */
function estadoDaMesa(a: AgenteRegistrado, ultima: Execucao | undefined, com108: boolean, agora: Date): EstadoMesa {
  if (a.tipo !== "sistema" && !com108) return "aguardando_ativacao";
  if (!a.ativo) return "desligado";
  if (!ultima) return "ocioso";
  if (ultima.status === "rodando" && Date.now() - new Date(ultima.inicio).getTime() < RODANDO_VALIDA_MS) return "trabalhando";
  if (ultima.status === "erro") return "com_erro";
  if (estaAtrasado(a.agenda, new Date(ultima.inicio), agora)) return "atrasado";
  return "em_dia";
}

function fazendoAgora(a: AgenteRegistrado, estado: EstadoMesa, ultima: Execucao | undefined, proxima: Date | null): string {
  switch (estado) {
    case "aguardando_ativacao":
      return "Esperando a migração 110 para começar a trabalhar.";
    case "desligado":
      return "Desligado pelo gestor.";
    case "trabalhando":
      return `Trabalhando agora (começou às ${hora(ultima!.inicio)}).`;
    case "com_erro":
      return ultima?.resumo || "A última rodada falhou.";
    case "atrasado":
      return `Atrasado: a última rodada foi às ${hora(ultima!.inicio)}${proxima ? `; deveria ter rodado antes de ${hora(proxima.toISOString())}` : ""}.`;
    default:
      if (ultima?.resumo) return ultima.resumo;
      return proxima ? `Ainda não rodou. Primeira rodada às ${hora(proxima.toISOString())}.` : "Ainda não rodou.";
  }
}

/** .eq("empresa", …) só para o gestor de uma loja (o mestre vê todas). */
function filtrarLoja<Q>(q: Q, empresa: string | null): Q {
  return empresa ? (q as unknown as { eq: (c: string, v: string) => Q }).eq("empresa", empresa) : q;
}

async function contar(consulta: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  const { count, error } = await consulta;
  return error ? 0 : (count ?? 0);
}

async function conhecimento(sb: SupabaseClient, empresa: string | null, com108: boolean): Promise<EstadoEscritorio["conhecimento"]> {
  const daLoja = <Q,>(q: Q): Q => filtrarLoja(q, empresa);
  const [aprovados, sugeridos, materiais, trechos] = await Promise.all([
    contar(daLoja(sb.from("aura_aprendizado").select("id", { count: "exact", head: true }).eq("status", "aprovado"))),
    contar(daLoja(sb.from("aura_aprendizado").select("id", { count: "exact", head: true }).eq("status", "sugerido"))),
    contar(daLoja(sb.from("aura_materiais").select("id", { count: "exact", head: true }))),
    contar(daLoja(sb.from("aura_material_trechos").select("id", { count: "exact", head: true }))),
  ]);

  let ultimaVersao: string | null = null;
  if (com108) {
    const { data } = await daLoja(sb.from("aura_conhecimento_historico").select("em"))
      .order("em", { ascending: false })
      .limit(1)
      .maybeSingle();
    ultimaVersao = (data?.em as string | undefined) ?? null;
  }

  let ultimoBackup: string | null = null;
  const { data: copias } = await sb.storage
    .from(BUCKET_NUVEM)
    .list(PASTA_CONHECIMENTO, { limit: 1, sortBy: { column: "name", order: "desc" } });
  const maisNova = (copias ?? []).find((o) => diaDoCaminho(o.name));
  if (maisNova) ultimoBackup = maisNova.updated_at ?? maisNova.created_at ?? `${diaDoCaminho(maisNova.name)}T23:30:00-03:00`;

  return {
    aprendizadosAprovados: aprovados,
    aprendizadosSugeridos: sugeridos,
    materiais,
    trechos,
    ultimaVersao,
    ultimoBackup,
  };
}

export async function montarEstadoEscritorio(
  sb: SupabaseClient,
  opcoes: { empresa: string | null },
): Promise<EstadoEscritorio> {
  const { empresa } = opcoes;
  const agora = new Date();
  const com108 = await temMigracao108(sb);
  const registro = await carregarRegistro(sb, com108);
  const nomeDe = (id: string | null) => (id ? (registro.find((a) => a.id === id)?.nome ?? id) : null);

  const [execCrons, saber, custos] = await Promise.all([
    execucoesDosCrons(sb),
    conhecimento(sb, empresa, com108),
    todasAsLinhas<{ funcao: string; custo_usd: number | string }>((de, ate) =>
      sb
        .from("ia_uso")
        .select("funcao, custo_usd")
        .like("funcao", "agente/%")
        .gte("criado_em", new Date(agora.getTime() - 30 * DIA).toISOString())
        .order("id")
        .range(de, ate),
    ).catch(() => []),
  ]);
  const custoPorAgente = new Map<string, number>();
  for (const c of custos) {
    const id = c.funcao.slice("agente/".length);
    custoPorAgente.set(id, (custoPorAgente.get(id) ?? 0) + Number(c.custo_usd ?? 0));
  }

  let execAgentes = new Map<string, Execucao[]>();
  const abertosPorAgente = new Map<string, number>();
  const resolvidosPorAgente = new Map<string, number>();
  let falas: FalaEscritorio[] = [];
  let propostas: PropostaListada[] = [];
  let planoDoDia: EstadoEscritorio["planoDoDia"] = null;

  if (com108) {
    const daLoja = <Q,>(q: Q): Q => filtrarLoja(q, empresa);
    const [exec, abertos, resolvidos, mensagens, listaPropostas, plano] = await Promise.all([
      execucoesDosAgentes(
        sb,
        registro.filter((a) => a.tipo !== "sistema").map((a) => a.id),
      ),
      todasAsLinhas<{ agente: string }>((de, ate) =>
        daLoja(sb.from("aura_recomendacoes").select("agente").not("agente", "is", null).eq("status", "pendente"))
          .order("id")
          .range(de, ate),
      ),
      todasAsLinhas<{ agente: string }>((de, ate) =>
        daLoja(
          sb
            .from("aura_recomendacoes")
            .select("agente")
            .not("agente", "is", null)
            .in("status", ["concluida", "resolvida_sozinha"])
            .gte("atualizado_em", new Date(agora.getTime() - 30 * DIA).toISOString()),
        )
          .order("id")
          .range(de, ate),
      ),
      (() => {
        let q = sb
          .from("aura_escritorio_mensagens")
          .select("id, de_agente, para_agente, tipo, texto, empresa, criado_em")
          .order("criado_em", { ascending: false })
          .limit(100);
        if (empresa) q = q.or(filtroLoja(empresa));
        return q;
      })(),
      sb
        .from("aura_agente_propostas")
        .select("id, proposto_por, nome, setor, missao, justificativa, config, status, criado_em, decidido_em")
        .order("criado_em", { ascending: false })
        .limit(60),
      sb
        .from("aura_escritorio_mensagens")
        .select("texto, criado_em")
        .eq("de_agente", ID_DIRETORA)
        .eq("tipo", "plano")
        .gte("criado_em", inicioDoDiaEmSaoPaulo(agora))
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    execAgentes = exec;
    for (const r of abertos) abertosPorAgente.set(r.agente, (abertosPorAgente.get(r.agente) ?? 0) + 1);
    for (const r of resolvidos) resolvidosPorAgente.set(r.agente, (resolvidosPorAgente.get(r.agente) ?? 0) + 1);

    if (mensagens.error && !faltaNoBanco(mensagens.error)) throw new Error(mensagens.error.message);
    // Gente no mural: o gestor que conversa com a Diretora fala como
    // "gestor:<id>" (ver conversa-diretora.ts). Aqui vira o nome da pessoa.
    const pessoas = new Set<string>();
    for (const m of mensagens.data ?? []) {
      for (const v of [m.de_agente as string, m.para_agente as string | null]) {
        const uid = gestorDaFala(v);
        if (uid) pessoas.add(uid);
      }
    }
    const nomeDaPessoa = new Map<string, string>();
    if (pessoas.size) {
      const { data } = await sb.from("profiles").select("id, nome").in("id", [...pessoas]);
      for (const p of data ?? []) nomeDaPessoa.set(p.id as string, (p.nome as string | null)?.trim() || "Gestor");
    }
    const nomeNaFala = (id: string | null) => {
      const uid = gestorDaFala(id);
      return uid ? (nomeDaPessoa.get(uid) ?? "Gestor") : nomeDe(id);
    };
    falas = (mensagens.data ?? []).map((m) => {
      const para = (m.para_agente as string | null) ?? null;
      return {
        id: m.id as string,
        de: m.de_agente as string,
        deNome: nomeNaFala(m.de_agente as string) ?? (m.de_agente as string),
        // Sem destinatário = para a Diretora (contrato).
        para: para ?? ID_DIRETORA,
        paraNome: para === "todos" ? "Todos" : nomeNaFala(para ?? ID_DIRETORA),
        tipo: m.tipo as FalaEscritorio["tipo"],
        texto: m.texto as string,
        empresa: (m.empresa as string | null) ?? null,
        criadoEm: m.criado_em as string,
      };
    });

    const criadosPorProposta = new Map(
      registro.filter((a) => a.propostaId).map((a) => [a.propostaId as string, a.id]),
    );
    const linhas = listaPropostas.data ?? [];
    // Todas as abertas e as 30 decididas mais recentes.
    const abertas = linhas.filter((p) => p.status === "proposta");
    const decididas = linhas.filter((p) => p.status !== "proposta").slice(0, 30);
    propostas = [...abertas, ...decididas].map((p) => ({
      id: p.id as string,
      propostoPor: p.proposto_por as string,
      propostoPorNome: nomeDe(p.proposto_por as string) ?? (p.proposto_por as string),
      nome: p.nome as string,
      setor: p.setor as Setor,
      missao: (p.missao as string) ?? "",
      justificativa: (p.justificativa as string) ?? "",
      config: p.config as ConfigAgenteConfiguravel,
      status: p.status as PropostaListada["status"],
      criadoEm: p.criado_em as string,
      decididoEm: (p.decidido_em as string | null) ?? null,
      ...(criadosPorProposta.has(p.id as string) ? { agenteCriadoId: criadosPorProposta.get(p.id as string) } : {}),
    }));

    if (plano.data) planoDoDia = { texto: plano.data.texto as string, criadoEm: plano.data.criado_em as string };
  }

  const mesas: MesaAgente[] = registro.map((a) => {
    const execucoes = (a.tipo === "sistema" ? execCrons.get(a.id) : execAgentes.get(a.id)) ?? [];
    const ultima = execucoes[0];
    const estado = estadoDaMesa(a, ultima, com108, agora);
    const proxima = a.ativo ? proximaExecucao(a.agenda, ultima ? new Date(ultima.inicio) : null, agora) : null;
    return {
      id: a.id,
      nome: a.nome,
      cargo: a.cargo,
      setor: a.setor,
      icone: a.icone,
      missao: a.missao,
      tipo: a.tipo,
      ativo: a.ativo,
      estado,
      fazendoAgora: fazendoAgora(a, estado, ultima, proxima),
      ultimaExecucao: ultima ? { inicio: ultima.inicio, fim: ultima.fim, status: ultima.status, resumo: ultima.resumo } : null,
      proximaExecucao: estado === "aguardando_ativacao" || !proxima ? null : proxima.toISOString(),
      agendaTexto: agendaTexto(a.agenda),
      achadosAbertos: abertosPorAgente.get(a.id) ?? 0,
      achadosResolvidos30d: resolvidosPorAgente.get(a.id) ?? 0,
      custo30dUsd: Number((custoPorAgente.get(a.id) ?? 0).toFixed(4)),
      orcamentoMensalUsd: a.orcamentoMensalUsd,
      criadoPor: a.criadoPor,
      criadoEm: a.criadoEm,
      execucoes,
    };
  });

  return {
    ativo: com108,
    ...(com108 ? {} : { motivoInativo: MOTIVO_SEM_108 }),
    mesas,
    falas,
    propostas,
    planoDoDia,
    conhecimento: saber,
    custo30dUsd: Number([...custoPorAgente.values()].reduce((s, n) => s + n, 0).toFixed(4)),
  };
}
