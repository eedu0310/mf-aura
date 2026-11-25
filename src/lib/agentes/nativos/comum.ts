/**
 * Peças que todos os agentes de função usam.
 *
 * Os agentes rodam no servidor, pelo cron, com a chave de serviço: enxergam
 * as quatro lojas de uma vez. Por isso quase todo problema aqui é de ROTA —
 * quem deve receber cada achado. A regra da casa, escrita uma vez só:
 *
 *   - item de carteira vai para o DONO (o vendedor), se ele está ativo;
 *   - dono saiu da empresa → vai para o GESTOR DA LOJA;
 *   - loja sem gestor próprio (hoje a LF e a Sole) → o item não vai solto
 *     para o gestor mestre. Mestre enxerga o grupo inteiro e receberia
 *     centenas de cards; ele recebe só RESUMO, um por agente.
 *
 * Também ficam aqui o corte de achados por pessoa (no máximo 10 por agente
 * por dia, os mais importantes primeiro), as chaves estáveis e as contas de
 * data no fuso de São Paulo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Achado, Prioridade } from "../tipos";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";
import { diasEntre, formatarMoeda, somarDias } from "@/components/pos-venda/regras";
import { ehFechada, ehLeadFrio, ehPosVenda, FUNIL_PADRAO, type EtapaFunil } from "@/lib/funil";
import { carregarFunil } from "@/lib/funil-servidor";

export const DIA_MS = 86_400_000;
export const HORA_MS = 3_600_000;

/** Teto de achados que um agente entrega a UMA pessoa por rodada. */
export const MAX_ACHADOS_POR_PESSOA = 10;

/** Cargos que atendem cliente (mesma lista de src/lib/types.ts). */
export const CARGOS_DE_VENDA = ["Vendedor", "Vendedor Interno"];

export { diasEntre, somarDias, formatarMoeda };

/* ------------------------------------------------------------------ */
/* Equipe: quem é quem, por loja                                        */
/* ------------------------------------------------------------------ */

export interface LinhaPerfil {
  id: string;
  nome: string | null;
  empresa: string | null;
  cargo: string | null;
  ativo: boolean | null;
  gestor_mestre: boolean | null;
  gestor_aprovado: boolean | null;
  excluido_em: string | null;
}

export interface Pessoa {
  id: string;
  nome: string;
  empresa: string;
  cargo: string;
  /** Gestor mestre aprovado: enxerga todas as lojas. */
  mestre: boolean;
}

/** Para onde vai algo que é da LOJA (não de um vendedor). */
export interface DestinoDaLoja {
  ids: string[];
  /** true = a loja não tem ninguém próprio e caiu nos gestores mestres (mande resumo, não item). */
  mestres: boolean;
}

export interface Responsaveis {
  pessoa(id: string | null | undefined): Pessoa | null;
  /** Lojas com alguém ativo, mais as quatro do grupo. */
  lojas(): string[];
  doCargo(empresa: string, cargo: string): Pessoa[];
  vendedores(empresa?: string): Pessoa[];
  /** Gestores aprovados DA loja, sem os mestres. */
  gestoresDaLoja(empresa: string): Pessoa[];
  mestres(): Pessoa[];
  /** Gestor da loja; sem nenhum, os mestres (marcado). */
  gestoresPara(empresa: string): DestinoDaLoja;
  /** Pós-venda da loja → gestor da loja → mestres. */
  posVendaPara(empresa: string): DestinoDaLoja;
  /** Marketing da loja → gestor da loja → mestres. */
  marketingPara(empresa: string): DestinoDaLoja;
  /** SDR da loja → gestor da loja → mestres. */
  sdrPara(empresa: string): DestinoDaLoja;
  /**
   * Item de carteira: o dono, se ativo; senão um gestor (não mestre) da loja.
   * Nulo quando sobraria só o mestre — aí o item entra no resumo dele.
   */
  destinoDoItem(ownerId: string | null | undefined, empresa: string): string | null;
}

const LOJAS_DO_GRUPO = ["MF International", "LF Lareiras", "A&G Aquecimento", "Sole Aquecimento"];

/**
 * Perfil que pode receber trabalho: ativo, não excluído e — se for gestor —
 * aprovado. Gestor sem aprovação não abre as telas de gestor (a RLS exige),
 * e avisar alguém de algo que ele não consegue ver só gasta a atenção dele.
 */
export function perfilValido(l: LinhaPerfil): boolean {
  if (l.ativo === false || l.excluido_em) return false;
  if (!l.id || !l.empresa) return false;
  if (l.cargo === "Gestor") return l.gestor_aprovado === true || l.gestor_mestre === true;
  return true;
}

/** Monta a equipe a partir das linhas de profiles (puro: os testes usam). */
export function montarResponsaveis(linhas: LinhaPerfil[]): Responsaveis {
  const pessoas: Pessoa[] = linhas.filter(perfilValido).map((l) => ({
    id: l.id,
    nome: (l.nome ?? "").trim() || "Sem nome",
    empresa: String(l.empresa),
    cargo: String(l.cargo ?? "Vendedor"),
    mestre: l.cargo === "Gestor" && l.gestor_mestre === true && l.gestor_aprovado === true,
  }));
  const porId = new Map(pessoas.map((p) => [p.id, p]));
  const doCargo = (empresa: string, cargo: string) =>
    pessoas.filter((p) => p.empresa === empresa && p.cargo === cargo && !p.mestre);
  const mestres = () => pessoas.filter((p) => p.mestre);
  const gestoresDaLoja = (empresa: string) => doCargo(empresa, "Gestor");

  const comFallback = (primeiro: Pessoa[], empresa: string): DestinoDaLoja => {
    if (primeiro.length) return { ids: primeiro.map((p) => p.id), mestres: false };
    const g = gestoresDaLoja(empresa);
    if (g.length) return { ids: g.map((p) => p.id), mestres: false };
    return { ids: mestres().map((p) => p.id), mestres: true };
  };

  return {
    pessoa: (id) => (id ? porId.get(id) ?? null : null),
    lojas: () => [...new Set([...LOJAS_DO_GRUPO, ...pessoas.map((p) => p.empresa)])],
    doCargo,
    vendedores: (empresa) =>
      pessoas.filter((p) => CARGOS_DE_VENDA.includes(p.cargo) && (!empresa || p.empresa === empresa)),
    gestoresDaLoja,
    mestres,
    gestoresPara: (empresa) => comFallback([], empresa),
    posVendaPara: (empresa) => comFallback(doCargo(empresa, "Pós-venda"), empresa),
    marketingPara: (empresa) => comFallback(doCargo(empresa, "Marketing"), empresa),
    sdrPara: (empresa) => comFallback(doCargo(empresa, "SDR"), empresa),
    destinoDoItem: (ownerId, empresa) => {
      const dono = ownerId ? porId.get(ownerId) : undefined;
      if (dono) return dono.id;
      return gestoresDaLoja(empresa)[0]?.id ?? null;
    },
  };
}

/**
 * A equipe lida UMA vez por rodada do cron. Os agentes da mesma rodada
 * recebem o mesmo cliente `sb`, então o cache é por cliente e dura dois
 * minutos — o bastante para a rodada, pouco para ficar com gente desligada.
 */
const TTL_EQUIPE = 2 * 60 * 1000;
const cacheEquipe = new WeakMap<object, { em: number; valor: Promise<Responsaveis> }>();

export function responsaveisDaLoja(sb: SupabaseClient): Promise<Responsaveis> {
  const lembrado = cacheEquipe.get(sb);
  if (lembrado && Date.now() - lembrado.em < TTL_EQUIPE) return lembrado.valor;
  const valor = (async () => {
    const { data, error } = await sb
      .from("profiles")
      .select("id, nome, empresa, cargo, ativo, gestor_mestre, gestor_aprovado, excluido_em")
      .eq("ativo", true)
      .is("excluido_em", null);
    // Erro de leitura não pode virar "ninguém na equipe": aí todo achado
    // seria descartado em silêncio. Falha alto, o motor registra o erro.
    if (error) throw new Error(`Não consegui ler a equipe: ${error.message}`);
    return montarResponsaveis((data ?? []) as LinhaPerfil[]);
  })();
  cacheEquipe.set(sb, { em: Date.now(), valor });
  valor.catch(() => cacheEquipe.delete(sb));
  return valor;
}

/* ------------------------------------------------------------------ */
/* Corte por pessoa                                                     */
/* ------------------------------------------------------------------ */

export const PESO_PRIORIDADE: Record<Prioridade, number> = { urgente: 4, alta: 3, media: 2, baixa: 1 };

/**
 * No máximo `max` achados por pessoa, os mais importantes primeiro.
 *
 * Dentro da mesma prioridade vale a ORDEM DE ENTRADA: o agente já entrega a
 * lista ordenada pelo que pesa no negócio dele (valor do negócio, dias de
 * atraso), e o corte respeita isso. Chave repetida conta uma vez só.
 */
export function limitarPorPessoa(
  achados: Achado[],
  max = MAX_ACHADOS_POR_PESSOA,
): { achados: Achado[]; cortados: number } {
  const vistos = new Set<string>();
  const unicos: { a: Achado; i: number }[] = [];
  achados.forEach((a, i) => {
    if (!a.destinatarioId || vistos.has(a.chave)) return;
    vistos.add(a.chave);
    unicos.push({ a, i });
  });
  unicos.sort((x, y) => PESO_PRIORIDADE[y.a.prioridade] - PESO_PRIORIDADE[x.a.prioridade] || x.i - y.i);
  const porPessoa = new Map<string, number>();
  const saida: { a: Achado; i: number }[] = [];
  for (const u of unicos) {
    const n = porPessoa.get(u.a.destinatarioId) ?? 0;
    if (n >= max) continue;
    porPessoa.set(u.a.destinatarioId, n + 1);
    saida.push(u);
  }
  return { achados: saida.map((u) => u.a), cortados: unicos.length - saida.length };
}

/* ------------------------------------------------------------------ */
/* Chaves e resumos                                                     */
/* ------------------------------------------------------------------ */

/** "followup:vencido:<id>" — partes vazias somem. */
export function chaveDe(...partes: Array<string | number | null | undefined>): string {
  return partes
    .filter((p) => p !== null && p !== undefined && p !== "")
    .map((p) => String(p).trim().replace(/\s+/g, "-"))
    .join(":");
}

/**
 * Uma lista curta em texto: "• item" por linha, no máximo `max`, e um
 * "… e mais N" no fim. É o que cabe num card sem virar relatório.
 */
export function listaCurta(itens: string[], max = 8): string {
  const mostra = itens.slice(0, max).map((t) => `• ${t}`);
  if (itens.length > max) mostra.push(`… e mais ${itens.length - max}`);
  return mostra.join("\n");
}

/**
 * Um achado-resumo para cada gestor mestre (ou gestor), com a lista por
 * loja. É o jeito de o mestre saber do problema sem receber cada item.
 */
export function resumosPorGestor(opcoes: {
  agente: string;
  tipo: string;
  /** gestorId → linhas (já com o nome da loja na frente, se for o caso). */
  linhas: Map<string, string[]>;
  empresaDe: (gestorId: string) => string;
  titulo: (total: number) => string;
  abertura: string;
  prioridade: Prioridade;
  acaoUrl?: string;
  expiraEmDias?: number;
}): Achado[] {
  const saida: Achado[] = [];
  for (const [gestorId, linhas] of opcoes.linhas) {
    if (!linhas.length) continue;
    saida.push({
      chave: chaveDe(opcoes.agente, opcoes.tipo, gestorId),
      empresa: opcoes.empresaDe(gestorId),
      destinatarioId: gestorId,
      titulo: opcoes.titulo(linhas.length),
      descricao: `${opcoes.abertura}\n${listaCurta(linhas)}`,
      prioridade: opcoes.prioridade,
      entidadeTipo: "perfil",
      entidadeId: gestorId,
      acaoUrl: opcoes.acaoUrl,
      expiraEmDias: opcoes.expiraEmDias ?? 1,
    });
  }
  return saida;
}

/** Acrescenta uma linha na lista de um gestor. */
export function anotar(mapa: Map<string, string[]>, id: string, linha: string) {
  const l = mapa.get(id);
  if (l) l.push(linha);
  else mapa.set(id, [linha]);
}

/* ------------------------------------------------------------------ */
/* Datas (São Paulo)                                                    */
/* ------------------------------------------------------------------ */

/** 0 = domingo … 6 = sábado, de um dia "AAAA-MM-DD". */
export function diaDaSemana(dia: string): number {
  return new Date(`${dia.slice(0, 10)}T12:00:00Z`).getUTCDay();
}

export function diasNoMes(dia: string): number {
  const [a, m] = dia.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

/** Mês 1–12 de "AAAA-MM-DD". */
export function mesDoAno(dia: string): number {
  return Number(dia.slice(5, 7));
}

/** Hora cheia (0–23) em São Paulo. */
export function horaEmSaoPaulo(agora: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(agora),
  ) % 24;
}

/** Dias inteiros desde um instante (nulo se vazio ou inválido). */
export function diasDesde(iso: string | null | undefined, agora: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.floor((agora.getTime() - t) / DIA_MS) : null;
}

export function horasDesde(iso: string | null | undefined, agora: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? (agora.getTime() - t) / HORA_MS : null;
}

/** "há 1 dia", "há 12 dias". */
export function haDias(n: number): string {
  return n <= 0 ? "hoje" : `há ${n} dia${n === 1 ? "" : "s"}`;
}

export function plural(n: number, um: string, varios = `${um}s`): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Primeiro nome, para título curto de card. */
export function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? "").trim().split(/\s+/)[0] || "Cliente";
}

/* ------------------------------------------------------------------ */
/* Texto para a IA                                                      */
/* ------------------------------------------------------------------ */

/**
 * Tira do texto o que identifica o cliente antes de ir para a IA: e-mail,
 * telefone (8+ dígitos com ou sem separador), CPF/CNPJ, links e, se
 * informado, o nome do contato. Fica o assunto, que é o que interessa.
 */
export function limparPII(texto: string, nomes: Array<string | null | undefined> = []): string {
  let t = texto
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
    .replace(/https?:\/\/\S+/gi, "[link]")
    .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[documento]")
    .replace(/\(?\+?\d[\d\s().-]{7,}\d/g, "[telefone]");
  for (const nome of nomes) {
    for (const parte of (nome ?? "").split(/\s+/)) {
      if (parte.length < 3) continue;
      const seguro = parte.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Borda com letras acentuadas: "\b" do JS não enxerga o "é" de "José".
      t = t.replace(new RegExp(`(?<![\\p{L}\\d])${seguro}(?![\\p{L}\\d])`, "giu"), "o cliente");
    }
  }
  return t;
}

/* ------------------------------------------------------------------ */
/* Leitura                                                              */
/* ------------------------------------------------------------------ */

/** Atalho do todasAsLinhas com tipagem solta (as linhas vêm do PostgREST). */
export function lerTudo<T>(
  montar: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  return todasAsLinhas<T>(montar as (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>);
}

/** Lê em blocos de 150 ids (a URL do filtro .in() tem limite). */
export async function lerPorIds<T>(
  ids: string[],
  montar: (bloco: string[], de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const unicos = [...new Set(ids.filter(Boolean))];
  const saida: T[] = [];
  for (let i = 0; i < unicos.length; i += 150) {
    const bloco = unicos.slice(i, i + 150);
    saida.push(...(await lerTudo<T>((de, ate) => montar(bloco, de, ate))));
  }
  return saida;
}

/* ------------------------------------------------------------------ */
/* Funil                                                                */
/* ------------------------------------------------------------------ */

/**
 * Negócio em andamento: nem ganho, nem perdido, nem já no pós-venda, nem na
 * coluna de leads frios (que é contato para reaquecer, não negócio parado).
 */
export function negocioEmAberto(etapa: string | null | undefined, funil: EtapaFunil[]): boolean {
  if (!etapa) return false;
  return !ehFechada(etapa, funil) && !ehPosVenda(etapa, funil) && !ehLeadFrio(etapa, funil);
}

/** O funil de cada loja (com o cache de cinco minutos do funil-servidor). */
export async function funisDasLojas(sb: SupabaseClient, lojas: string[]): Promise<Map<string, EtapaFunil[]>> {
  const pares = await Promise.all(lojas.map(async (l) => [l, await carregarFunil(sb, l)] as const));
  return new Map(pares);
}

export function funilDe(funis: Map<string, EtapaFunil[]>, empresa: string): EtapaFunil[] {
  return funis.get(empresa) ?? FUNIL_PADRAO;
}

export const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
