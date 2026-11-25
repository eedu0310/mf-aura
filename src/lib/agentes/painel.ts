/**
 * PAINEL DO AGENTE: o que abre quando o gestor clica num agente do escritório.
 *
 * Pedido do Elton (25/11/2026): "quando eu clicar no agente tem que mostrar o
 * que ele está falando, o que ele fez etc." — a ficha técnica (missão,
 * agenda, orçamento, comandos) continua existindo, mas numa aba ao lado.
 *
 * Aqui ficam o contrato de GET /api/gestor/agentes/[id] e as peças PURAS que
 * a rota e a tela usam (testáveis sem banco: painel.teste.ts):
 *   - juntarAtividade: falas + rodadas numa linha do tempo só, mais nova em cima;
 *   - agruparPorDia: "Hoje", "Ontem", "seg., 23 de nov." no fuso de São Paulo;
 *   - filtrarAchados: as abas Abertos / Resolvidos / Todos;
 *   - primeiraLinha, truncar, duracaoMs, linkInterno: pequenos ajustes de texto.
 *
 * Nada aqui fala com o banco nem com o navegador.
 */
import { diaEmSaoPaulo } from "@/lib/fuso";
import type { FalaEscritorio, Prioridade } from "./tipos";

/* ------------------------------------------------------------------ */
/* Contrato da rota                                                    */
/* ------------------------------------------------------------------ */

/** Alguém numa fala: agente, pessoa (gestor) ou o mural. */
export interface ParteDaFala {
  id: string;
  nome: string;
  /** "agente" abre a ficha dele; "pessoa" é um gestor; "mural" é a sala toda. */
  quem: "agente" | "pessoa" | "mural";
}

export interface FalaNoPainel {
  tipo: "fala";
  id: string;
  em: string;
  /** "enviou" = o agente do painel falou; "recebeu" = falaram com ele. */
  direcao: "enviou" | "recebeu";
  tipoFala: FalaEscritorio["tipo"];
  de: ParteDaFala;
  para: ParteDaFala;
  texto: string;
  empresa: string | null;
}

export interface RodadaNoPainel {
  tipo: "rodada";
  id: string;
  em: string; // início da rodada
  fim: string | null;
  status: "ok" | "erro" | "rodando";
  resumo: string;
  achados: number;
  custoUsd: number;
  /** Só a primeira linha do erro (o resto é log de servidor). */
  erro: string | null;
  duracaoMs: number | null;
}

export type ItemAtividade = FalaNoPainel | RodadaNoPainel;

export type StatusAchado = "pendente" | "concluida" | "dispensada" | "expirada" | "resolvida_sozinha";

export interface AchadoNoPainel {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: Prioridade;
  status: StatusAchado | string;
  empresa: string | null;
  /** Quem recebeu (profiles.nome do vendedor_id). */
  destinatarioNome: string | null;
  criadoEm: string;
  atualizadoEm: string | null;
  acaoUrl: string | null;
}

export interface PainelDoAgente {
  atividade: ItemAtividade[];
  achados: { abertos: number; resolvidos30d: number; lista: AchadoNoPainel[] };
  resumoHoje: { rodadas: number; achadosNovos: number; custoUsd: number };
}

/* ------------------------------------------------------------------ */
/* Texto                                                               */
/* ------------------------------------------------------------------ */

export const LIMITE_ATIVIDADE = 40;
export const LIMITE_DESCRICAO = 300;

/** A primeira linha com conteúdo (o erro gravado traz o log depois). */
export function primeiraLinha(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const linha = texto.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
  return linha ?? null;
}

/** Corta no limite sem partir palavra no meio quando dá, com "…" no fim. */
export function truncar(texto: string | null | undefined, limite: number): string {
  const t = (texto ?? "").trim();
  if (t.length <= limite) return t;
  const corte = t.slice(0, limite - 1);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > limite * 0.6 ? corte.slice(0, espaco) : corte).trimEnd()}…`;
}

/** Duração da rodada em ms (null se ainda roda ou se as datas não batem). */
export function duracaoMs(inicio: string, fim: string | null | undefined): number | null {
  if (!fim) return null;
  const d = new Date(fim).getTime() - new Date(inicio).getTime();
  return Number.isFinite(d) && d >= 0 ? d : null;
}

/** Quanto a rodada levou: "3 s", "2 min", "1 h 5 min". */
export function textoDuracao(ms: number | null): string | null {
  if (ms === null) return null;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${h} h ${resto} min` : `${h} h`;
}

/**
 * O botão "Abrir" só leva para dentro do CRM: caminho que começa com "/"
 * (e não "//", que o navegador lê como outro site).
 */
export function linkInterno(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const u = url.trim();
  return u.startsWith("/") && !u.startsWith("//") && !u.startsWith("/\\") ? u : null;
}

/* ------------------------------------------------------------------ */
/* Linha do tempo                                                      */
/* ------------------------------------------------------------------ */

/** Falas e rodadas juntas, da mais nova para a mais antiga, no limite. */
export function juntarAtividade(
  falas: FalaNoPainel[],
  rodadas: RodadaNoPainel[],
  limite = LIMITE_ATIVIDADE,
): ItemAtividade[] {
  const vistos = new Set<string>();
  const todos: ItemAtividade[] = [];
  for (const item of [...falas, ...rodadas]) {
    const chave = `${item.tipo}:${item.id}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    todos.push(item);
  }
  // Data inválida vai para o fim; empate: rodada antes de fala (a fala costuma
  // ser o relato daquela rodada, então lida de cima para baixo faz sentido).
  const tempo = (i: ItemAtividade) => {
    const t = new Date(i.em).getTime();
    return Number.isFinite(t) ? t : -Infinity;
  };
  todos.sort((a, b) => tempo(b) - tempo(a) || (a.tipo === b.tipo ? 0 : a.tipo === "rodada" ? -1 : 1));
  return todos.slice(0, Math.max(0, limite));
}

export interface DiaDaAtividade<T> {
  /** "AAAA-MM-DD" em São Paulo. */
  dia: string;
  rotulo: string;
  itens: T[];
}

function diaAnterior(dia: string): string {
  // Meio-dia evita qualquer tropeço de fuso ao voltar 24 h.
  const d = new Date(`${dia}T12:00:00-03:00`);
  d.setTime(d.getTime() - 86_400_000);
  return diaEmSaoPaulo(d);
}

/** "Hoje", "Ontem" ou "seg., 23 de nov." (com o ano se não for o ano corrente). */
export function rotuloDoDia(dia: string, agora: Date = new Date()): string {
  const hoje = diaEmSaoPaulo(agora);
  if (dia === hoje) return "Hoje";
  if (dia === diaAnterior(hoje)) return "Ontem";
  const d = new Date(`${dia}T12:00:00-03:00`);
  if (!Number.isFinite(d.getTime())) return dia;
  return d.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(dia.slice(0, 4) !== hoje.slice(0, 4) ? { year: "numeric" } : {}),
  });
}

/** Agrupa por dia de São Paulo, mantendo a ordem em que os itens vieram. */
export function agruparPorDia<T extends { em: string }>(itens: T[], agora: Date = new Date()): Array<DiaDaAtividade<T>> {
  const grupos: Array<DiaDaAtividade<T>> = [];
  for (const item of itens) {
    const d = new Date(item.em);
    const dia = Number.isFinite(d.getTime()) ? diaEmSaoPaulo(d) : "sem-data";
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.itens.push(item);
    else grupos.push({ dia, rotulo: dia === "sem-data" ? "Sem data" : rotuloDoDia(dia, agora), itens: [item] });
  }
  return grupos;
}

/* ------------------------------------------------------------------ */
/* Achados                                                             */
/* ------------------------------------------------------------------ */

export type FiltroAchados = "abertos" | "resolvidos" | "todos";

export const STATUS_RESOLVIDO: ReadonlySet<string> = new Set(["concluida", "resolvida_sozinha"]);

export function filtrarAchados(lista: AchadoNoPainel[], filtro: FiltroAchados): AchadoNoPainel[] {
  if (filtro === "abertos") return lista.filter((a) => a.status === "pendente");
  if (filtro === "resolvidos") return lista.filter((a) => STATUS_RESOLVIDO.has(a.status));
  return lista;
}

/** Mais recente pelo último movimento (resolvido hoje sobe para o topo). */
export function ordenarAchados(lista: AchadoNoPainel[]): AchadoNoPainel[] {
  const t = (a: AchadoNoPainel) => {
    const v = new Date(a.atualizadoEm ?? a.criadoEm).getTime();
    return Number.isFinite(v) ? v : -Infinity;
  };
  return [...lista].sort((a, b) => t(b) - t(a));
}
