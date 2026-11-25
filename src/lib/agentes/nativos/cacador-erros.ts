/**
 * CAÇADOR DE ERROS — Equipe Vermelha. De 6 em 6 horas procura o que está
 * quebrando sem ninguém ver, e diz como arrumar.
 *
 * SÓ LÊ. Nada aqui grava dado nem mexe em código:
 *   1. IA: falhas das últimas 24 h (ia_falhas), juntando a mesma mensagem;
 *   2. CRONS: execução com erro nas últimas 24 h e cron que parou de rodar
 *      (aura_execucoes_cron × INTERVALO_MAXIMO_DO_CRON_H);
 *   3. AGENTES: rodada com erro nas últimas 24 h e rodada presa em "rodando";
 *   4. LINKS: card pendente cujo botão leva a uma tela que não existe;
 *   5. DADOS: negócio, cliente e pós-venda com dono que não existe mais em
 *      profiles; status fora do vocabulário que o código entende; negócio
 *      numa etapa que não existe no funil da loja;
 *   6. CÓDIGO × BANCO: as colunas de que o CRM depende (COLUNAS_CRITICAS)
 *      existem? Confere com um select de uma linha por tabela — se a coluna
 *      sumiu, o PostgREST responde "column does not exist".
 *
 * Achado alto/urgente vira card para os gestores mestres; tudo vai num alerta
 * para a Diretora (equipe-vermelha.ts).
 */
import type { ContextoAgente, DefinicaoAgente, ResultadoAgente } from "../tipos";
import { faltaNoBanco } from "../util";
import { acharEtapa, FUNIL_PADRAO, type EtapaFunil } from "@/lib/funil";
import { carregarFunil } from "@/lib/funil-servidor";
import { lerTudo, plural } from "./comum";
import {
  assinaturaDoErro,
  COLUNAS_CRITICAS,
  cronAtrasado,
  INTERVALO_MAXIMO_DO_CRON_H,
  linkDeTelaValido,
  STATUS_LEAD,
  STATUS_POS_VENDA,
  type Risco,
} from "./equipe-vermelha-regras";
import { entregarRiscos } from "./equipe-vermelha";

export const ID_CACADOR_ERROS = "cacador-erros";

const HORA = 3_600_000;
/** A mesma falha de IA repetida isto ou mais vezes em 24 h é alta (abaixo, média). */
const FALHAS_IA_ALTA = 5;

async function executar(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb, agora } = ctx;
  const riscos: Risco[] = [];
  const desde24h = new Date(agora.getTime() - 24 * HORA).toISOString();

  // ---------- 1. falhas de IA ----------
  const falhas = await lerTudo<{ funcao: string; mensagem: string | null }>((de, ate) =>
    sb.from("ia_falhas").select("funcao, mensagem").gte("criado_em", desde24h).order("id").range(de, ate),
  );
  const grupos = new Map<string, { funcao: string; exemplo: string; n: number }>();
  for (const f of falhas) {
    const k = `${f.funcao}|${assinaturaDoErro(f.mensagem ?? "")}`;
    const g = grupos.get(k) ?? { funcao: f.funcao, exemplo: (f.mensagem ?? "sem mensagem").slice(0, 200), n: 0 };
    g.n += 1;
    grupos.set(k, g);
  }
  for (const g of [...grupos.values()].sort((a, b) => b.n - a.n).slice(0, 10)) {
    const corte = /cortad|max_tokens|limite de \d+ tokens/i.test(g.exemplo);
    riscos.push({
      chave: `ia-falha:${g.funcao}:${assinaturaDoErro(g.exemplo).slice(0, 60)}`,
      severidade: g.n >= FALHAS_IA_ALTA ? "alta" : "media",
      titulo: `IA falhando em ${g.funcao} (${plural(g.n, "vez", "vezes")} em 24 h)`,
      detalhe: `Mensagem: ${g.exemplo}`,
      comoArrumar: corte
        ? `A resposta passa do teto de tokens: aumentar o maxTokens de ${g.funcao} ou mandar lotes menores.`
        : /saldo|credit|billing|429|rate/i.test(g.exemplo)
          ? "Conferir o saldo e o limite de uso da chave da Anthropic (Gestor › Custo da IA)."
          : `Ver o detalhe em ia_falhas (funcao = '${g.funcao}') e o log do servidor no mesmo horário.`,
    });
  }

  // ---------- 2. crons ----------
  const execCron = await lerTudo<{ nome: string; inicio: string; ok: boolean }>((de, ate) =>
    sb
      .from("aura_execucoes_cron")
      .select("nome, inicio, ok")
      .gte("inicio", new Date(agora.getTime() - 9 * 24 * HORA).toISOString())
      .order("id")
      .range(de, ate),
  );
  const ultimoCron = new Map<string, string>();
  const errosCron = new Map<string, number>();
  for (const e of execCron) {
    if (e.inicio > (ultimoCron.get(e.nome) ?? "")) ultimoCron.set(e.nome, e.inicio);
    if (!e.ok && e.inicio >= desde24h) errosCron.set(e.nome, (errosCron.get(e.nome) ?? 0) + 1);
  }
  let cronsNunca = 0;
  for (const nome of Object.keys(INTERVALO_MAXIMO_DO_CRON_H)) {
    const situacao = cronAtrasado(nome, ultimoCron.get(nome) ?? null, agora);
    if (situacao === "nunca") {
      cronsNunca += 1;
      continue; // sem nenhum registro em 9 dias: crontab ainda não instalado (vai no resumo, não em card)
    }
    if (situacao === "parou") {
      riscos.push({
        chave: `cron-parou:${nome}`,
        severidade: "alta",
        titulo: `O cron ${nome} parou de rodar`,
        detalhe: `A última execução registrada foi em ${new Date(ultimoCron.get(nome) as string).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}; o esperado é no máximo a cada ${INTERVALO_MAXIMO_DO_CRON_H[nome]} h.`,
        comoArrumar: "Na VPS: conferir /etc/cron.d/aura (linha do cron e CRON_SECRET) e o /var/log/aura-cron.log.",
      });
    }
  }
  for (const [nome, n] of errosCron) {
    riscos.push({
      chave: `cron-erro:${nome}`,
      severidade: n >= 3 ? "alta" : "media",
      titulo: `O cron ${nome} falhou ${plural(n, "vez", "vezes")} em 24 h`,
      detalhe: "O motivo está no campo detalhe da execução em aura_execucoes_cron.",
      comoArrumar: `Abrir Gestor › Saúde do sistema (ou aura_execucoes_cron, nome = '${nome}') e corrigir o erro registrado.`,
    });
  }

  // ---------- 3. agentes ----------
  const { data: rodadas } = await sb
    .from("aura_agente_execucoes")
    .select("agente_id, status, inicio, erro")
    .gte("inicio", desde24h)
    .order("inicio", { ascending: false })
    .limit(2000);
  const porAgente = new Map<string, { erros: number; ultimoErro: string | null; ultimaOk: boolean | null }>();
  for (const r of (rodadas ?? []) as Array<{ agente_id: string; status: string; inicio: string; erro: string | null }>) {
    const a = porAgente.get(r.agente_id) ?? { erros: 0, ultimoErro: null, ultimaOk: null };
    if (a.ultimaOk === null && r.status !== "rodando") a.ultimaOk = r.status === "ok";
    if (r.status === "erro") {
      a.erros += 1;
      a.ultimoErro ??= (r.erro ?? "").split("\n")[0].slice(0, 200);
    }
    if (r.status === "rodando" && Date.parse(r.inicio) < agora.getTime() - 30 * 60_000) {
      riscos.push({
        chave: `agente-preso:${r.agente_id}`,
        severidade: "media",
        titulo: `Rodada do agente ${r.agente_id} presa em "rodando"`,
        detalhe: "Começou há mais de 30 minutos e não terminou: o processo caiu no meio (deploy ou queda da VPS).",
        comoArrumar: "Nada a fazer na hora: a próxima rodada do agente marca esta como interrompida. Se repetir, ver o log do servidor.",
      });
    }
    porAgente.set(r.agente_id, a);
  }
  for (const [id, a] of porAgente) {
    if (!a.erros || id === ID_CACADOR_ERROS) continue;
    riscos.push({
      chave: `agente-erro:${id}`,
      severidade: a.ultimaOk === false && a.erros >= 2 ? "alta" : "media",
      titulo: `Agente ${id} falhou ${plural(a.erros, "vez", "vezes")} em 24 h`,
      detalhe: `Último erro: ${a.ultimoErro || "sem mensagem"}.${a.ultimaOk === false ? " A última rodada também falhou." : ""}`,
      comoArrumar: /prazo/i.test(a.ultimoErro ?? "")
        ? "A rodada passou do tempo: diminuir o lote do agente ou ver qual chamada de IA está demorando."
        : "Abrir o agente no escritório (Gestor › Agentes) e ver o erro completo nas rodadas dele.",
    });
  }

  // ---------- 4. links dos cards ----------
  const pendentes = await lerTudo<{ agente: string | null; acao_url: string | null }>((de, ate) =>
    sb.from("aura_recomendacoes").select("agente, acao_url").eq("status", "pendente").not("acao_url", "is", null).order("id").range(de, ate),
  );
  const linksRuins = new Map<string, { n: number; agente: string }>();
  for (const p of pendentes) {
    if (linkDeTelaValido(p.acao_url)) continue;
    const caminho = String(p.acao_url).split(/[?#]/)[0];
    const atual = linksRuins.get(caminho) ?? { n: 0, agente: p.agente ?? "supervisão" };
    atual.n += 1;
    linksRuins.set(caminho, atual);
  }
  for (const [caminho, l] of linksRuins) {
    riscos.push({
      chave: `link-quebrado:${caminho}`,
      severidade: "media",
      titulo: `${plural(l.n, "card leva", "cards levam")} a uma tela que não existe`,
      detalhe: `O botão abre ${caminho} (cards de ${l.agente}), que não está na lista de telas do app: a pessoa cai no "página não encontrada".`,
      comoArrumar: `Corrigir o acaoUrl no agente ${l.agente}, ou acrescentar a tela nova em TELAS_DO_APP (equipe-vermelha-regras.ts) se ela existe.`,
    });
  }

  // ---------- 5. integridade dos dados ----------
  const perfis = await lerTudo<{ id: string }>((de, ate) => sb.from("profiles").select("id").order("id").range(de, ate));
  const existe = new Set(perfis.map((p) => p.id));
  const [ops, rels, pvs, leads] = await Promise.all([
    lerTudo<{ owner_id: string | null; empresa: string; etapa: string | null }>((de, ate) =>
      sb.from("oportunidades").select("owner_id, empresa, etapa").order("id").range(de, ate),
    ),
    lerTudo<{ owner_id: string | null }>((de, ate) => sb.from("relacionamentos").select("owner_id").order("id").range(de, ate)),
    lerTudo<{ vendedor_id: string | null; responsavel_id: string | null; status: string | null }>((de, ate) =>
      sb.from("pos_vendas").select("vendedor_id, responsavel_id, status").order("id").range(de, ate),
    ),
    lerTudo<{ status: string | null }>((de, ate) => sb.from("leads_recebidos").select("status").order("id").range(de, ate)),
  ]);
  const orfaos = {
    oportunidades: ops.filter((o) => !o.owner_id || !existe.has(o.owner_id)).length,
    relacionamentos: rels.filter((r) => !r.owner_id || !existe.has(r.owner_id)).length,
    pos_vendas: pvs.filter(
      (p) => (p.vendedor_id && !existe.has(p.vendedor_id)) || (p.responsavel_id && !existe.has(p.responsavel_id)),
    ).length,
  };
  for (const [tabela, n] of Object.entries(orfaos)) {
    if (!n) continue;
    riscos.push({
      chave: `orfao:${tabela}`,
      severidade: "media",
      titulo: `${tabela}: ${plural(n, "registro", "registros")} com dono que não existe`,
      detalhe: `O dono (perfil) foi apagado ou nunca existiu: ninguém vê nem cobra esses ${n} registro(s) no CRM.`,
      comoArrumar: "Transferir a carteira para alguém da loja (Gestor › Usuários › transferir carteira).",
    });
  }
  const statusRuins = {
    pos_vendas: pvs.filter((p) => p.status && !STATUS_POS_VENDA.has(p.status)).map((p) => p.status as string),
    leads_recebidos: leads.filter((l) => l.status && !STATUS_LEAD.has(l.status)).map((l) => l.status as string),
  };
  for (const [tabela, lista] of Object.entries(statusRuins)) {
    if (!lista.length) continue;
    const valores = [...new Set(lista)].slice(0, 5);
    riscos.push({
      chave: `status-desconhecido:${tabela}:${valores.join(",")}`,
      severidade: "media",
      titulo: `${tabela}: ${plural(lista.length, "registro", "registros")} com status que o código não conhece`,
      detalhe: `Valores fora do vocabulário: ${valores.join(", ")}. As telas não sabem em que coluna mostrar esses registros.`,
      comoArrumar: "Corrigir os valores no banco para um status válido, ou ensinar o código o status novo (tipos e telas).",
    });
  }
  // Etapa que não existe no funil da loja.
  const funis = new Map<string, EtapaFunil[]>();
  const semEtapa = new Map<string, Set<string>>();
  let negociosSemEtapa = 0;
  for (const o of ops) {
    if (!o.etapa) continue;
    let funil = funis.get(o.empresa);
    if (!funil) {
      funil = await carregarFunil(sb, o.empresa).catch(() => FUNIL_PADRAO);
      funis.set(o.empresa, funil);
    }
    if (acharEtapa(o.etapa, funil)) continue;
    negociosSemEtapa += 1;
    const s = semEtapa.get(o.empresa) ?? new Set<string>();
    s.add(o.etapa);
    semEtapa.set(o.empresa, s);
  }
  for (const [empresa, etapas] of semEtapa) {
    const lista = [...etapas].sort().slice(0, 5);
    riscos.push({
      chave: `etapa-inexistente:${empresa}:${lista.join(",")}`,
      severidade: "media",
      titulo: `${empresa}: negócios numa etapa que não existe no funil`,
      detalhe: `Etapas: ${lista.join(", ")}. Esses negócios somem do pipeline (nenhuma coluna os mostra).`,
      comoArrumar: "Mover os negócios para uma etapa do funil, ou recriar a etapa em Gestor › Funil.",
    });
  }

  // ---------- 6. código × banco ----------
  let colunasConferidas = 0;
  for (const [tabela, colunas] of Object.entries(COLUNAS_CRITICAS)) {
    const { error } = await sb.from(tabela).select(colunas.join(", ")).limit(1);
    if (!error) {
      colunasConferidas += colunas.length;
      continue;
    }
    if (!faltaNoBanco(error)) continue; // erro passageiro: não é falta de coluna
    // Descobre qual coluna (ou a tabela) sumiu, uma por uma.
    const { error: erroTabela } = await sb.from(tabela).select("*").limit(1);
    const faltando: string[] = [];
    if (!erroTabela) {
      for (const c of colunas) {
        const { error: e } = await sb.from(tabela).select(c).limit(1);
        if (e && faltaNoBanco(e)) faltando.push(c);
      }
    }
    riscos.push({
      chave: `esquema:${tabela}:${erroTabela ? "tabela" : faltando.join(",")}`,
      severidade: "urgente",
      titulo: erroTabela ? `Tabela ${tabela} não existe no banco` : `${tabela}: falta ${faltando.join(", ")}`,
      detalhe: erroTabela
        ? `O código lê a tabela ${tabela} e o banco não a tem: as telas e agentes que dependem dela quebram.`
        : `O código lê ${faltando.map((c) => `${tabela}.${c}`).join(", ")} e o banco não tem: as telas e agentes que dependem disso quebram.`,
      comoArrumar: "Aplicar a migração que cria isso (pasta supabase/migrations), ou corrigir o nome no código se a coluna foi renomeada.",
    });
  }

  return entregarRiscos(ctx, {
    agente: ID_CACADOR_ERROS,
    nome: "Caçador de Erros",
    rotulo: "Erro",
    riscos,
    resumoOk: `Nada quebrando: IA, crons, agentes, links, dados e ${colunasConferidas} colunas do banco conferidos.`,
    metricas: {
      falhasIA24h: falhas.length,
      cronsComErro24h: errosCron.size,
      cronsSemRegistro: cronsNunca,
      agentesComErro24h: [...porAgente.values()].filter((a) => a.erros > 0).length,
      linksQuebrados: [...linksRuins.values()].reduce((s, l) => s + l.n, 0),
      orfaos: orfaos.oportunidades + orfaos.relacionamentos + orfaos.pos_vendas,
      negociosSemEtapa,
      colunasConferidas,
    },
  });
}

export const agenteCacadorErros: DefinicaoAgente = {
  id: ID_CACADOR_ERROS,
  nome: "Caçador de Erros",
  cargo: "Equipe Vermelha: erros e dados",
  setor: "seguranca",
  icone: "Bug",
  missao:
    "De 6 em 6 horas procura o que está quebrando sem ninguém ver — IA falhando, cron parado, agente com erro, link de card quebrado, dado órfão e coluna que sumiu do banco — e diz como arrumar. Só lê; nunca muda nada.",
  agenda: { tipo: "intervalo", minutos: 360 },
  usaIA: true,
  orcamentoMensalUsd: 0.5,
  tipo: "nativo",
  executar,
};
