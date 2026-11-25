/**
 * COORDENADOR DE PÓS-VENDA — todo dia às 8h olha o quadro de pós-venda das
 * quatro lojas e diz a quem cuida do pós-venda o que pede ação hoje.
 *
 * A regra de "o que pede atenção" é a MESMA da tela (motivoDeAtencao, em
 * src/components/pos-venda/regras.ts), na mesma ordem de urgência:
 *   instalação atrasada → reclamação aberta → instalação pendente →
 *   venda sem data de instalação há mais de 7 dias → concluída sem avaliação.
 * Duas travas a mais, para não fazer barulho:
 *   - reclamação só vira card depois de 48 horas aberta (antes disso é o
 *     tempo normal de resolver);
 *   - "sem avaliação" só se ninguém pediu ainda (pedidos_avaliacao).
 *
 * Quem recebe: o responsável do card; senão a pessoa de Pós-venda da loja;
 * senão o gestor da loja. Loja sem ninguém disso cai num resumo para os
 * gestores mestres — um card com a lista, não um por cliente.
 */
import type { Achado, ContextoAgente, DefinicaoAgente, Prioridade, ResultadoAgente } from "../tipos";
import type { Motivo } from "@/components/pos-venda/regras";
import { diasEntre, motivoDeAtencao } from "@/components/pos-venda/regras";
import { anotar, chaveDe, horasDesde, lerPorIds, limitarPorPessoa, plural, responsaveisDaLoja, resumosPorGestor } from "./comum";
import { lerPosVendas, type PosVendaAgente } from "./pos-venda-linhas";

export const HORAS_RECLAMACAO = 48;

const PRIORIDADE: Record<Motivo["chave"], Prioridade> = {
  atrasada: "alta",
  reclamacao: "urgente",
  pendente: "media",
  sem_agendar: "media",
  sem_avaliacao: "baixa",
};

const TITULO: Record<Motivo["chave"], string> = {
  atrasada: "Instalação atrasada",
  reclamacao: "Reclamação sem solução",
  pendente: "Instalação para reagendar",
  sem_agendar: "Venda sem data de instalação",
  sem_avaliacao: "Peça a avaliação",
};

const SECAO: Record<Motivo["chave"], string> = {
  atrasada: "instalacoes",
  reclamacao: "reclamacoes",
  pendente: "instalacoes",
  sem_agendar: "instalacoes",
  sem_avaliacao: "avaliacoes",
};

/**
 * O motivo que vale para o agente (nulo = nada a cobrar hoje).
 * `pedidoFeito`: já existe pedido de avaliação para esta venda.
 */
export function motivoDoAgente(pv: PosVendaAgente, hoje: string, agora: Date, pedidoFeito: boolean): Motivo | null {
  const m = motivoDeAtencao(pv, hoje);
  if (!m) return null;
  if (m.chave === "reclamacao") {
    const horas = horasDesde(pv.reclamacaoAbertaEm ?? pv.criadoEm ?? null, agora);
    if (horas !== null && horas < HORAS_RECLAMACAO) return null;
  }
  if (m.chave === "sem_avaliacao" && pedidoFeito) return null;
  return m;
}

async function executar(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb, hoje, agora } = ctx;
  const equipe = await responsaveisDaLoja(sb);
  const cards = await lerPosVendas(sb);

  const vendasConcluidas = cards.filter((c) => c.status === "pos_venda_realizado" && c.vendaId).map((c) => c.vendaId as string);
  const pedidos = await lerPorIds<{ venda_id: string }>(vendasConcluidas, (bloco, de, ate) =>
    sb.from("pedidos_avaliacao").select("venda_id").in("venda_id", bloco).order("id").range(de, ate),
  );
  const comPedido = new Set(pedidos.map((p) => p.venda_id));

  const ordem: Motivo["chave"][] = ["reclamacao", "atrasada", "pendente", "sem_agendar", "sem_avaliacao"];
  const itens = cards
    .map((pv) => ({ pv, m: motivoDoAgente(pv, hoje, agora, pv.vendaId ? comPedido.has(pv.vendaId) : false) }))
    .filter((x): x is { pv: PosVendaAgente; m: Motivo } => x.m !== null)
    .sort((a, b) => ordem.indexOf(a.m.chave) - ordem.indexOf(b.m.chave) || b.pv.valor - a.pv.valor);

  const achados: Achado[] = [];
  const resumoMestres = new Map<string, string[]>();
  const contagem: Record<string, number> = {};
  for (const { pv, m } of itens) {
    contagem[m.chave] = (contagem[m.chave] ?? 0) + 1;
    const responsavel = equipe.pessoa(pv.responsavelId);
    const destino = responsavel ? { ids: [responsavel.id], mestres: false } : equipe.posVendaPara(pv.empresa);
    if (destino.mestres) {
      for (const id of destino.ids) anotar(resumoMestres, id, `${pv.empresa}: ${pv.cliente} — ${m.texto.toLowerCase()}`);
      continue;
    }
    if (!destino.ids[0]) continue;
    let prioridade = PRIORIDADE[m.chave];
    if (m.chave === "sem_agendar" && (diasEntre(pv.dataVenda, hoje) ?? 0) > 21) prioridade = "alta";
    achados.push({
      chave: chaveDe("pos-venda", pv.id),
      empresa: pv.empresa,
      destinatarioId: destino.ids[0],
      titulo: `${TITULO[m.chave]}: ${pv.cliente}`,
      descricao: `${m.texto}${pv.produto ? ` (${pv.produto})` : ""}. Próximo passo: ${m.acao.toLowerCase()}.`,
      prioridade,
      entidadeTipo: "pos_venda",
      entidadeId: pv.id,
      acaoUrl: `/pos-venda?secao=${SECAO[m.chave]}`,
      expiraEmDias: 2,
      podeGerarMensagem: m.chave !== "reclamacao",
    });
  }

  const resumos = resumosPorGestor({
    agente: "pos-venda",
    tipo: "resumo",
    linhas: resumoMestres,
    empresaDe: (id) => equipe.pessoa(id)?.empresa ?? "",
    titulo: (n) => `Pós-venda: ${plural(n, "cliente")} pedindo ação`,
    abertura: "Lojas sem pessoa de pós-venda. O que pede ação hoje:",
    prioridade: (contagem.reclamacao ?? 0) > 0 ? "alta" : "media",
    acaoUrl: "/pos-venda",
  });

  const { achados: final, cortados } = limitarPorPessoa(achados);
  return {
    resumo: itens.length
      ? `${plural(itens.length, "pós-venda", "pós-vendas")} pedindo ação: ${contagem.atrasada ?? 0} atrasadas, ${contagem.reclamacao ?? 0} reclamações, ${contagem.sem_agendar ?? 0} sem data.`
      : "Pós-venda em dia.",
    achados: [...final, ...resumos],
    metricas: {
      atrasadas: contagem.atrasada ?? 0,
      reclamacoes48h: contagem.reclamacao ?? 0,
      pendentes: contagem.pendente ?? 0,
      semAgendar: contagem.sem_agendar ?? 0,
      semPedidoDeAvaliacao: contagem.sem_avaliacao ?? 0,
      cortadosPeloTeto: cortados,
    },
  };
}

export const agentePosVenda: DefinicaoAgente = {
  id: "pos-venda",
  nome: "Coordenador de Pós-venda",
  cargo: "Coordenador de pós-venda",
  setor: "pos-venda",
  icone: "Wrench",
  missao: "Garante que toda venda vire lareira instalada, reclamação resolvida e avaliação pedida.",
  agenda: { tipo: "diario", horas: [8], minuto: 0, diasSemana: [1, 2, 3, 4, 5, 6] },
  usaIA: false,
  orcamentoMensalUsd: 0,
  tipo: "nativo",
  executar,
};
