/**
 * O que o painel do agente recebe (GET /api/gestor/agentes/[id]).
 *
 * Lê com a chave de serviço: a rota já conferiu que quem pediu é gestor
 * aprovado e que o agente existe. Tudo limitado (no máximo algumas dezenas
 * de linhas por consulta) e em paralelo:
 *
 *   - FALAS: as que o agente mandou e as que mandaram para ele (para a
 *     Diretora também as "sem destinatário", que pelo contrato são dela).
 *     Gestor de uma loja vê as da loja dele e as sem loja (da equipe toda).
 *   - RODADAS: o diário do agente (aura_agente_execucoes); rotina do sistema
 *     (sentinela, backup…) vem do diário dos crons (aura_execucoes_cron).
 *     Rodada não tem loja: é a mesma para todos os gestores.
 *   - ACHADOS: as recomendações que o agente criou (aura_recomendacoes),
 *     só da loja do gestor quando ele não é o mestre. A lista traz as 30
 *     abertas mais novas e as 30 fechadas mais recentes, para os filtros
 *     "Abertos" e "Resolvidos" nunca saírem vazios por causa do corte.
 *
 * Tabela faltando (migração 110 não aplicada) vira TabelaFaltando, que a rota
 * responde com 409 e o motivo — nunca um 500 sem explicação.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { inicioDoDiaEmSaoPaulo } from "@/lib/fuso";
import type { AgenteRegistrado } from "./motor";
import { CRON_DO_AGENTE_DO_SISTEMA } from "./sistema";
import { ID_DIRETORA } from "./diretora";
import { faltaNoBanco, gestorDaFala } from "./util";
import {
  LIMITE_ATIVIDADE,
  LIMITE_DESCRICAO,
  duracaoMs,
  juntarAtividade,
  linkInterno,
  ordenarAchados,
  primeiraLinha,
  truncar,
  type AchadoNoPainel,
  type FalaNoPainel,
  type PainelDoAgente,
  type ParteDaFala,
  type RodadaNoPainel,
} from "./painel";
import type { FalaEscritorio, Prioridade } from "./tipos";

const DIA = 86_400_000;
const LIMITE_ACHADOS = 30;
/** Agente de intervalo curto roda ~300 vezes por dia: o teto cobre com folga. */
const TETO_RODADAS_DO_DIA = 1000;

export class TabelaFaltando extends Error {}

type Resposta<T> = { data: T | null; error: { code?: string; message: string } | null };
type RespostaContagem = { count: number | null; error: { code?: string; message: string } | null };

/** Confere o erro: tabela/coluna faltando vira TabelaFaltando; outro erro, Error. */
function conferir<T>(r: Resposta<T>, onde: string): T | null {
  if (!r.error) return r.data;
  if (faltaNoBanco(r.error)) throw new TabelaFaltando(onde);
  throw new Error(`${onde}: ${r.error.message}`);
}
function contagem(r: RespostaContagem, onde: string): number {
  if (!r.error) return r.count ?? 0;
  if (faltaNoBanco(r.error)) throw new TabelaFaltando(onde);
  throw new Error(`${onde}: ${r.error.message}`);
}

/** "empresa vazia ou a minha", no formato do PostgREST (mesmo do escritório). */
function filtroLoja(empresa: string): string {
  return `empresa.is.null,empresa.eq."${empresa.replace(/"/g, '\\"')}"`;
}

/** .eq("empresa", …) só para o gestor de uma loja (o mestre vê todas). */
function daLoja<Q>(q: Q, empresa: string | null): Q {
  return empresa ? (q as unknown as { eq: (c: string, v: string) => Q }).eq("empresa", empresa) : q;
}

interface LinhaFala {
  id: string;
  de_agente: string;
  para_agente: string | null;
  tipo: string;
  texto: string;
  empresa: string | null;
  criado_em: string;
}

interface LinhaAchado {
  id: string;
  titulo: string | null;
  descricao: string | null;
  prioridade: string | null;
  status: string;
  empresa: string | null;
  vendedor_id: string | null;
  criado_em: string;
  atualizado_em: string | null;
  acao_url: string | null;
}

const PRIORIDADES = new Set<Prioridade>(["baixa", "media", "alta", "urgente"]);

export async function montarPainelDoAgente(
  sb: SupabaseClient,
  opcoes: { agente: AgenteRegistrado; registro: AgenteRegistrado[]; empresa: string | null; agora?: Date },
): Promise<PainelDoAgente> {
  const { agente, registro, empresa } = opcoes;
  const agora = opcoes.agora ?? new Date();
  const id = agente.id;
  const hoje = inicioDoDiaEmSaoPaulo(agora);
  const ha30dias = new Date(agora.getTime() - 30 * DIA).toISOString();
  const sistema = agente.tipo === "sistema";
  const cron = CRON_DO_AGENTE_DO_SISTEMA[id];

  /* -------------------------------------------------------- consultas */

  const falasDaLoja = (q: ReturnType<typeof consultaFalas>) => (empresa ? q.or(filtroLoja(empresa)) : q);
  function consultaFalas() {
    return sb
      .from("aura_escritorio_mensagens")
      .select("id, de_agente, para_agente, tipo, texto, empresa, criado_em")
      .order("criado_em", { ascending: false })
      .limit(LIMITE_ATIVIDADE);
  }
  // Três consultas simples em vez de um "or" composto: cada uma usa o índice
  // e o filtro de loja (que já é um "or") não se mistura com o de direção.
  const consultasFalas: Array<PromiseLike<Resposta<LinhaFala[]>>> = [
    falasDaLoja(consultaFalas().eq("de_agente", id)) as unknown as PromiseLike<Resposta<LinhaFala[]>>,
    falasDaLoja(consultaFalas().eq("para_agente", id)) as unknown as PromiseLike<Resposta<LinhaFala[]>>,
  ];
  if (id === ID_DIRETORA) {
    consultasFalas.push(falasDaLoja(consultaFalas().is("para_agente", null)) as unknown as PromiseLike<Resposta<LinhaFala[]>>);
  }

  const consultaRodadas = sistema
    ? cron
      ? sb
          .from("aura_execucoes_cron")
          .select("id, inicio, fim, ok, detalhe")
          .eq("nome", cron)
          .order("inicio", { ascending: false })
          .limit(LIMITE_ATIVIDADE)
      : null
    : sb
        .from("aura_agente_execucoes")
        .select("id, inicio, fim, status, resumo, achados, custo_usd, erro")
        .eq("agente_id", id)
        .order("inicio", { ascending: false })
        .limit(LIMITE_ATIVIDADE);

  const consultaRodadasHoje = sistema
    ? cron
      ? sb.from("aura_execucoes_cron").select("id", { count: "exact", head: true }).eq("nome", cron).gte("inicio", hoje)
      : null
    : sb
        .from("aura_agente_execucoes")
        .select("custo_usd")
        .eq("agente_id", id)
        .gte("inicio", hoje)
        .order("inicio", { ascending: false })
        .limit(TETO_RODADAS_DO_DIA);

  const recs = () => sb.from("aura_recomendacoes");
  const COLUNAS_ACHADO = "id, titulo, descricao, prioridade, status, empresa, vendedor_id, criado_em, atualizado_em, acao_url";

  const [falasBrutas, rodadasBrutas, rodadasHoje, abertos, resolvidos, novosHoje, listaAbertos, listaFechados] = await Promise.all([
    Promise.all(consultasFalas),
    consultaRodadas ?? Promise.resolve(null),
    consultaRodadasHoje ?? Promise.resolve(null),
    daLoja(recs().select("id", { count: "exact", head: true }).eq("agente", id).eq("status", "pendente"), empresa),
    daLoja(
      recs()
        .select("id", { count: "exact", head: true })
        .eq("agente", id)
        .in("status", ["concluida", "resolvida_sozinha"])
        .gte("atualizado_em", ha30dias),
      empresa,
    ),
    daLoja(recs().select("id", { count: "exact", head: true }).eq("agente", id).gte("criado_em", hoje), empresa),
    daLoja(recs().select(COLUNAS_ACHADO).eq("agente", id).eq("status", "pendente"), empresa)
      .order("criado_em", { ascending: false })
      .limit(LIMITE_ACHADOS),
    daLoja(recs().select(COLUNAS_ACHADO).eq("agente", id).neq("status", "pendente"), empresa)
      .order("atualizado_em", { ascending: false, nullsFirst: false })
      .limit(LIMITE_ACHADOS),
  ]);

  /* ----------------------------------------------------------- falas */

  const linhasFala = new Map<string, LinhaFala>();
  for (const r of falasBrutas) for (const l of conferir(r, "falas") ?? []) linhasFala.set(l.id, l);

  const achadosLinhas = [
    ...((conferir(listaAbertos as Resposta<LinhaAchado[]>, "achados abertos") ?? []) as LinhaAchado[]),
    ...((conferir(listaFechados as Resposta<LinhaAchado[]>, "achados fechados") ?? []) as LinhaAchado[]),
  ];

  // Nomes de gente: gestor nas falas ("gestor:<id>") e quem recebeu cada achado.
  const pessoas = new Set<string>();
  for (const l of linhasFala.values()) {
    for (const v of [l.de_agente, l.para_agente]) {
      const uid = gestorDaFala(v);
      if (uid) pessoas.add(uid);
    }
  }
  for (const a of achadosLinhas) if (a.vendedor_id) pessoas.add(a.vendedor_id);
  const nomeDaPessoa = new Map<string, string>();
  if (pessoas.size) {
    const { data } = await sb.from("profiles").select("id, nome").in("id", [...pessoas]);
    for (const p of data ?? []) nomeDaPessoa.set(p.id as string, ((p.nome as string | null) ?? "").trim());
  }

  const nomeDoAgente = new Map(registro.map((a) => [a.id, a.nome]));
  const parte = (valor: string | null): ParteDaFala => {
    if (valor === "todos") return { id: "todos", nome: "Mural", quem: "mural" };
    // Sem destinatário = para a Diretora (contrato).
    const v = valor ?? ID_DIRETORA;
    const uid = gestorDaFala(v);
    if (uid) return { id: uid, nome: nomeDaPessoa.get(uid) || "Gestor", quem: "pessoa" };
    return { id: v, nome: nomeDoAgente.get(v) ?? v, quem: "agente" };
  };

  const falas: FalaNoPainel[] = [...linhasFala.values()].map((l) => ({
    tipo: "fala",
    id: l.id,
    em: l.criado_em,
    direcao: l.de_agente === id ? "enviou" : "recebeu",
    tipoFala: l.tipo as FalaEscritorio["tipo"],
    de: parte(l.de_agente),
    para: parte(l.para_agente),
    texto: l.texto ?? "",
    empresa: l.empresa ?? null,
  }));

  /* --------------------------------------------------------- rodadas */

  let rodadas: RodadaNoPainel[] = [];
  if (sistema) {
    // Diário dos crons é da migração 105: sem ele, a rotina fica sem histórico.
    const r = rodadasBrutas as Resposta<Array<{ id: string; inicio: string; fim: string | null; ok: boolean; detalhe: unknown }>> | null;
    const linhas = r && !r.error ? (r.data ?? []) : [];
    rodadas = linhas.map((e) => {
      const detalhe = (e.detalhe ?? null) as { erro?: string } | null;
      const erro = e.ok ? null : primeiraLinha(detalhe?.erro) ?? "sem mensagem";
      return {
        tipo: "rodada",
        id: e.id ?? e.inicio,
        em: e.inicio,
        fim: e.fim ?? null,
        status: e.fim ? (e.ok ? "ok" : "erro") : "rodando",
        resumo: e.ok ? "Rodou." : `Falhou: ${erro}`,
        achados: 0,
        custoUsd: 0,
        erro,
        duracaoMs: duracaoMs(e.inicio, e.fim),
      };
    });
  } else {
    const linhas =
      conferir(
        rodadasBrutas as Resposta<
          Array<{ id: string; inicio: string; fim: string | null; status: string; resumo: string | null; achados: number | null; custo_usd: number | string | null; erro: string | null }>
        >,
        "rodadas",
      ) ?? [];
    rodadas = linhas.map((e) => ({
      tipo: "rodada",
      id: e.id,
      em: e.inicio,
      fim: e.fim ?? null,
      status: (["ok", "erro", "rodando"].includes(e.status) ? e.status : "ok") as RodadaNoPainel["status"],
      resumo: e.resumo ?? "",
      achados: Number(e.achados ?? 0),
      custoUsd: Number(e.custo_usd ?? 0),
      erro: primeiraLinha(e.erro),
      duracaoMs: duracaoMs(e.inicio, e.fim),
    }));
  }

  /* ---------------------------------------------------- resumo de hoje */

  let rodadasDeHoje = 0;
  let custoHoje = 0;
  if (sistema) {
    const r = rodadasHoje as RespostaContagem | null;
    rodadasDeHoje = r && !r.error ? (r.count ?? 0) : 0;
  } else {
    const linhas = conferir(rodadasHoje as Resposta<Array<{ custo_usd: number | string | null }>>, "rodadas de hoje") ?? [];
    rodadasDeHoje = linhas.length;
    custoHoje = linhas.reduce((s, l) => s + Number(l.custo_usd ?? 0), 0);
  }

  /* ---------------------------------------------------------- achados */

  const lista: AchadoNoPainel[] = ordenarAchados(
    achadosLinhas.map((a) => ({
      id: a.id,
      titulo: a.titulo ?? "",
      descricao: truncar(a.descricao, LIMITE_DESCRICAO),
      prioridade: PRIORIDADES.has(a.prioridade as Prioridade) ? (a.prioridade as Prioridade) : "media",
      status: a.status,
      empresa: a.empresa ?? null,
      destinatarioNome: (a.vendedor_id && nomeDaPessoa.get(a.vendedor_id)) || null,
      criadoEm: a.criado_em,
      atualizadoEm: a.atualizado_em ?? null,
      acaoUrl: linkInterno(a.acao_url),
    })),
  );

  return {
    atividade: juntarAtividade(falas, rodadas),
    achados: {
      abertos: contagem(abertos as RespostaContagem, "achados abertos"),
      resolvidos30d: contagem(resolvidos as RespostaContagem, "achados resolvidos"),
      lista,
    },
    resumoHoje: {
      rodadas: rodadasDeHoje,
      achadosNovos: contagem(novosHoje as RespostaContagem, "achados de hoje"),
      custoUsd: Number(custoHoje.toFixed(4)),
    },
  };
}
