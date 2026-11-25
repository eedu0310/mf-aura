/**
 * ANALISTA DE FOLLOW-UP — toda manhã, antes de a loja abrir, separa para cada
 * vendedor os clientes que ele prometeu chamar e não chamou.
 *
 * Três situações, na ordem do que mais custa venda:
 *   1. follow-up vencido: a data do próximo contato passou (com meio dia de
 *      folga — a mesma regra do Meu Dia, src/lib/relacionamento-atencao.ts);
 *   2. negócio aberto sem próximo contato marcado: ninguém sabe quando o
 *      cliente vai ser chamado de novo, e é assim que o orçamento morre;
 *   3. parceiro esfriando: arquiteto, construtora, engenheiro… há 15 dias ou
 *      mais sem contato e sem nada marcado. Cliente final sem negócio aberto
 *      fica de fora de propósito: são mais de mil, e quem cuida de cliente
 *      antigo é o Agente de Reativação.
 *
 * A lista de cada vendedor vem ordenada pelo dinheiro em jogo (valor do
 * negócio aberto, depois a etapa, depois os dias) e é cortada em 10.
 *
 * Quem tem follow-up vencido há mais de 7 dias aparece no resumo do gestor da
 * loja — um card por gestor, não um por cliente.
 */
import type { Achado, ContextoAgente, DefinicaoAgente, MensagemEscritorio, Prioridade, ResultadoAgente } from "../tipos";
import type { EtapaFunil } from "@/lib/funil";
import { acharEtapa } from "@/lib/funil";
import { diasSemContato, followupVencido } from "@/lib/relacionamento-atencao";
import {
  anotar, chaveDe, DIA_MS, formatarMoeda, funilDe, funisDasLojas, haDias, lerTudo, limitarPorPessoa,
  negocioEmAberto, num, plural, responsaveisDaLoja, resumosPorGestor,
} from "./comum";

export interface RelFollowup {
  id: string;
  owner_id: string;
  empresa: string;
  nome: string;
  categoria: string | null;
  proximo_contato_em: string | null;
  ultimo_contato_em: string | null;
  created_at: string;
  observacao?: string | null;
}

export interface OpFollowup {
  id: string;
  owner_id: string;
  empresa: string;
  relacionamento_id: string | null;
  cliente: string;
  valor: number;
  etapa: string;
}

export type TipoFollowup = "vencido" | "sem_proximo" | "esfriando";

export interface ItemFollowup {
  tipo: TipoFollowup;
  rel: RelFollowup;
  /** vencido: dias de atraso; sem_proximo/esfriando: dias sem contato. */
  dias: number;
  valorAberto: number;
  /** A etapa mais avançada entre os negócios abertos (nula sem negócio). */
  etapa: string | null;
  etapaOrdem: number;
}

/** Categorias de relacionamento que são parceria (indicam obra), não cliente final. */
export const CATEGORIAS_PARCEIRO = ["Arquiteto", "Construtora", "Engenheiro", "Designer de Interiores", "Obra", "Distribuidor"];

export const DIAS_ESFRIANDO = 15;
/** A partir daqui o negócio está "parado" e é do Analista de Pipeline (mesmo limite dele). */
export const DIAS_NEGOCIO_PARADO = 7;
export const DIAS_PARA_GESTOR = 7;

/**
 * Em que situação está este cliente (nulo = nada a cobrar).
 * `ops` são só os negócios EM ABERTO deste cliente.
 */
export function classificarFollowup(
  rel: RelFollowup,
  ops: OpFollowup[],
  funil: EtapaFunil[],
  agora: number,
): ItemFollowup | null {
  const valorAberto = ops.reduce((s, o) => s + (Number(o.valor) || 0), 0);
  let etapa: string | null = null;
  let etapaOrdem = 0;
  for (const o of ops) {
    const ordem = acharEtapa(o.etapa, funil)?.ordem ?? 0;
    if (ordem >= etapaOrdem) {
      etapaOrdem = ordem;
      etapa = o.etapa;
    }
  }
  const base = { rel, valorAberto, etapa, etapaOrdem };

  if (followupVencido({ proximoContatoEm: rel.proximo_contato_em ?? undefined }, agora)) {
    const dias = Math.max(0, Math.floor((agora - Date.parse(rel.proximo_contato_em as string)) / DIA_MS));
    return { tipo: "vencido", dias, ...base };
  }
  // Próximo contato marcado (hoje ou adiante): está sob controle.
  if (rel.proximo_contato_em) return null;

  const semContato = diasSemContato({ ultimoContatoEm: rel.ultimo_contato_em ?? undefined, criadoEm: rel.created_at }, agora) ?? 0;
  /*
   * Negócio aberto sem próximo contato: só enquanto a conversa é RECENTE
   * (menos de 7 dias). Daí em diante o negócio está "parado" e quem cobra é o
   * Analista de Pipeline — antes os dois mandavam cartão sobre o mesmo cliente
   * (simulação de 25/11: ~17 cartões por vendedor no primeiro dia).
   */
  if (ops.length > 0) {
    return semContato < DIAS_NEGOCIO_PARADO ? { tipo: "sem_proximo", dias: semContato, ...base } : null;
  }
  if (semContato >= DIAS_ESFRIANDO && CATEGORIAS_PARCEIRO.includes(rel.categoria ?? "")) {
    return { tipo: "esfriando", dias: semContato, ...base };
  }
  return null;
}

export function prioridadeFollowup(item: ItemFollowup): Prioridade {
  if (item.tipo === "vencido") return item.valorAberto > 0 || item.dias > DIAS_PARA_GESTOR ? "alta" : "media";
  if (item.tipo === "sem_proximo") return item.valorAberto > 0 && item.etapaOrdem >= 4 ? "alta" : "media";
  return item.dias >= 30 ? "media" : "baixa";
}

/** Primeiro o dinheiro em jogo, depois a etapa, depois os dias. */
export function ordenarFollowups(itens: ItemFollowup[]): ItemFollowup[] {
  return [...itens].sort(
    (a, b) => b.valorAberto - a.valorAberto || b.etapaOrdem - a.etapaOrdem || b.dias - a.dias,
  );
}

function textoDoNegocio(item: ItemFollowup): string {
  if (!item.etapa) return "";
  return item.valorAberto > 0
    ? ` Negócio aberto em ${item.etapa}, ${formatarMoeda(item.valorAberto)}.`
    : ` Negócio aberto em ${item.etapa}, ainda sem valor.`;
}

export function achadoDeFollowup(item: ItemFollowup, destinatarioId: string): Achado {
  const r = item.rel;
  const comum = {
    empresa: r.empresa,
    destinatarioId,
    prioridade: prioridadeFollowup(item),
    entidadeTipo: "relacionamento" as const,
    entidadeId: r.id,
    acaoUrl: `/relacionamentos?id=${r.id}`,
    podeGerarMensagem: true,
  };
  if (item.tipo === "vencido") {
    return {
      ...comum,
      chave: chaveDe("followup", "vencido", r.id),
      titulo: `Follow-up vencido: ${r.nome}`,
      descricao: `O contato combinado venceu ${haDias(item.dias)}.${textoDoNegocio(item)} Fale hoje e marque a próxima data.`,
      expiraEmDias: 2,
    };
  }
  if (item.tipo === "sem_proximo") {
    return {
      ...comum,
      chave: chaveDe("followup", "sem-proximo", r.id),
      titulo: `Sem próximo contato: ${r.nome}`,
      descricao: `Último contato ${haDias(item.dias)}.${textoDoNegocio(item)} Marque quando vai falar de novo.`,
      expiraEmDias: 2,
    };
  }
  return {
    ...comum,
    chave: chaveDe("followup", "esfriando", r.id),
    titulo: `Parceiro esfriando: ${r.nome}`,
    descricao: `${r.categoria ?? "Parceiro"} há ${item.dias} dias sem contato. Um oi agora mantém as indicações vindo.`,
    expiraEmDias: 3,
  };
}

async function executar(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb } = ctx;
  const agora = ctx.agora.getTime();
  const equipe = await responsaveisDaLoja(sb);
  const [rels, opsTodas, funis] = await Promise.all([
    lerTudo<RelFollowup>((de, ate) =>
      sb
        .from("relacionamentos")
        .select("id, owner_id, empresa, nome, categoria, proximo_contato_em, ultimo_contato_em, created_at, observacao")
        .order("id")
        .range(de, ate),
    ),
    lerTudo<OpFollowup>((de, ate) =>
      sb
        .from("oportunidades")
        .select("id, owner_id, empresa, relacionamento_id, cliente, valor, etapa")
        .order("id")
        .range(de, ate),
    ),
    funisDasLojas(sb, equipe.lojas()),
  ]);

  const opsPorRel = new Map<string, OpFollowup[]>();
  for (const o of opsTodas) {
    if (!o.relacionamento_id || !negocioEmAberto(o.etapa, funilDe(funis, o.empresa))) continue;
    const lista = opsPorRel.get(o.relacionamento_id) ?? [];
    lista.push({ ...o, valor: num(o.valor) });
    opsPorRel.set(o.relacionamento_id, lista);
  }

  const itens: ItemFollowup[] = [];
  for (const r of rels) {
    const item = classificarFollowup(r, opsPorRel.get(r.id) ?? [], funilDe(funis, r.empresa), agora);
    if (item) itens.push(item);
  }

  const achados: Achado[] = [];
  const paraGestor = new Map<string, string[]>();
  const empresaDoGestor = new Map<string, string>();
  // vendedor (ou "sem dono" da loja) → { vencidos > 7 dias, valor em jogo }
  const atrasoPorDono = new Map<string, { empresa: string; nome: string; qtd: number; valor: number }>();
  const pedidosDeLimpeza = new Map<string, string[]>();
  let semDestino = 0;

  for (const item of ordenarFollowups(itens)) {
    const r = item.rel;
    const destino = equipe.destinoDoItem(r.owner_id, r.empresa);
    if (destino) achados.push(achadoDeFollowup(item, destino));
    else semDestino++;

    if (item.tipo === "vencido" && item.dias > DIAS_PARA_GESTOR) {
      const dono = equipe.pessoa(r.owner_id);
      const k = `${r.empresa}|${dono?.id ?? "sem-dono"}`;
      const atual = atrasoPorDono.get(k) ?? { empresa: r.empresa, nome: dono?.nome ?? "sem dono ativo", qtd: 0, valor: 0 };
      atual.qtd++;
      atual.valor += item.valorAberto;
      atrasoPorDono.set(k, atual);
    }
    if (item.tipo === "vencido" && /limpeza|chamin|manuten/i.test(r.observacao ?? "")) {
      const l = pedidosDeLimpeza.get(r.empresa) ?? [];
      l.push(r.id);
      pedidosDeLimpeza.set(r.empresa, l);
    }
  }

  // Um card por gestor: quem da loja está com follow-up vencido há mais de 7 dias.
  for (const a of [...atrasoPorDono.values()].sort((x, y) => y.valor - x.valor || y.qtd - x.qtd)) {
    const destino = equipe.gestoresPara(a.empresa);
    const linha =
      `${destino.mestres ? `${a.empresa}: ` : ""}${a.nome} — ${plural(a.qtd, "cliente")} há mais de ${DIAS_PARA_GESTOR} dias` +
      (a.valor > 0 ? ` (${formatarMoeda(a.valor)} em negócios)` : "");
    for (const id of destino.ids) {
      anotar(paraGestor, id, linha);
      empresaDoGestor.set(id, equipe.pessoa(id)?.empresa ?? a.empresa);
    }
  }
  const resumos = resumosPorGestor({
    agente: "followup",
    tipo: "escalada",
    linhas: paraGestor,
    empresaDe: (id) => empresaDoGestor.get(id) ?? "",
    titulo: (n) => `Follow-ups atrasados: ${plural(n, "pessoa")} para cobrar`,
    abertura: `Clientes com contato vencido há mais de ${DIAS_PARA_GESTOR} dias:`,
    prioridade: "alta",
    acaoUrl: "/relacionamentos?filtro=vencidos",
  });

  const { achados: cortados, cortados: qtdCortados } = limitarPorPessoa(achados);

  const mensagens: MensagemEscritorio[] = [];
  for (const [empresa, ids] of pedidosDeLimpeza) {
    mensagens.push({
      de: "followup",
      para: "manutencao",
      tipo: "pedido",
      empresa,
      texto: `${plural(ids.length, "cliente")} com follow-up vencido na ${empresa} fala${ids.length === 1 ? "" : "m"} em limpeza ou manutenção. Confere se já estão na sua lista?`,
      dados: { relacionamentoIds: ids.slice(0, 50) },
    });
  }

  const conta = (t: TipoFollowup) => itens.filter((i) => i.tipo === t).length;
  const vencidos = conta("vencido");
  return {
    resumo:
      `${plural(vencidos, "follow-up vencido", "follow-ups vencidos")}, ${conta("sem_proximo")} negócios sem próximo contato ` +
      `e ${plural(conta("esfriando"), "parceiro esfriando", "parceiros esfriando")}; ${plural(cortados.length, "card")} para a equipe.`,
    achados: [...cortados, ...resumos],
    mensagens,
    metricas: {
      vencidos,
      vencidos7d: itens.filter((i) => i.tipo === "vencido" && i.dias > DIAS_PARA_GESTOR).length,
      semProximo: conta("sem_proximo"),
      esfriando: conta("esfriando"),
      cortadosPeloTeto: qtdCortados,
      semDonoAtivo: semDestino,
    },
  };
}

export const agenteFollowup: DefinicaoAgente = {
  id: "followup",
  nome: "Analista de Follow-up",
  cargo: "Analista de follow-up",
  setor: "vendas",
  icone: "PhoneCall",
  missao: "Toda manhã, entrega a cada vendedor os clientes que ele precisa chamar hoje, do negócio mais valioso para o menor.",
  agenda: { tipo: "diario", horas: [7], minuto: 40, diasSemana: [1, 2, 3, 4, 5, 6] },
  usaIA: false,
  orcamentoMensalUsd: 0,
  tipo: "nativo",
  executar,
};
