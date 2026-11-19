/**
 * Os dois recortes da carteira que a AURA cobra no Meu Dia, com a MESMA regra
 * do servidor (src/lib/aura/metricas.ts), para o número do cartão e a lista
 * que abre ao tocar nele baterem sempre:
 *
 *  - follow-up vencido: o próximo contato marcado já passou (com meio dia de
 *    folga, para o "hoje à tarde" não aparecer como atrasado de manhã);
 *  - esfriando: 15 dias ou mais sem contato registrado.
 */
import type { Relacionamento } from "@/lib/types";

const DIA = 86_400_000;

export type FiltroAtencao = "vencidos" | "esfriando";

export const TEXTO_FILTRO_ATENCAO: Record<FiltroAtencao, string> = {
  vencidos: "Follow-ups vencidos",
  esfriando: "Esfriando: 15 dias ou mais sem contato",
};

export function lerFiltroAtencao(valor: string | null | undefined): FiltroAtencao | null {
  return valor === "vencidos" || valor === "esfriando" ? valor : null;
}

export function followupVencido(r: Pick<Relacionamento, "proximoContatoEm">, agora = Date.now()): boolean {
  if (!r.proximoContatoEm) return false;
  const t = new Date(r.proximoContatoEm).getTime();
  return Number.isFinite(t) && t < agora - DIA / 2;
}

export function diasSemContato(r: Pick<Relacionamento, "ultimoContatoEm" | "criadoEm">, agora = Date.now()): number | null {
  const iso = r.ultimoContatoEm ?? r.criadoEm;
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.floor((agora - t) / DIA) : null;
}

export function esfriando(r: Pick<Relacionamento, "ultimoContatoEm" | "criadoEm">, agora = Date.now()): boolean {
  const d = diasSemContato(r, agora);
  return d !== null && d >= 15;
}

export function passaNoFiltroAtencao(
  r: Pick<Relacionamento, "proximoContatoEm" | "ultimoContatoEm" | "criadoEm">,
  filtro: FiltroAtencao,
  agora = Date.now(),
): boolean {
  return filtro === "vencidos" ? followupVencido(r, agora) : esfriando(r, agora);
}
