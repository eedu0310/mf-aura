/**
 * Mês corrente da meta mensal, no horário de Brasília (AAAA-MM).
 *
 * Antes o mês saía de `toISOString()`, que é UTC: das 21h do último dia do
 * mês em diante o sistema já achava que era o mês seguinte, e a meta enviada
 * nessa noite ficava gravada no mês errado.
 */
export function mesEmBrasilia(agora: Date = new Date()): string {
  return agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
}

/** Primeiro mês em que a meta enviada é obrigatória para usar o CRM. */
export const PRIMEIRO_MES_DA_TRAVA = "2026-12";

export function travaVale(mes: string): boolean {
  return mes >= PRIMEIRO_MES_DA_TRAVA;
}
