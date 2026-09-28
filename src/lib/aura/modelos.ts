/**
 * Qual modelo para qual trabalho.
 *
 * O gasto da AURA não está distribuído por igual: o supervisor do WhatsApp e
 * os recados fazem 96% das chamadas, e são trabalho de triagem — ler uma
 * conversa e dizer se é lead, resumir o dia, classificar etapa. O Coach e o
 * resumo do gestor são 4% e é neles que a qualidade do raciocínio aparece
 * para quem lê.
 *
 * Por isso o modelo é escolhido por tipo de trabalho, não um só para tudo:
 * o barato onde é volume, o bom onde é conversa.
 *
 *   AURA_IA_MODEL         raciocínio  (Coach, resumo do gestor, rascunhos)
 *   AURA_IA_MODEL_RAPIDO  volume      (supervisor do WhatsApp, recados)
 *
 * Sem nada configurado, tudo continua como estava. WHATSAPP_IA_MODEL segue
 * valendo para o volume, que é o que o nome sempre quis dizer.
 */

const PADRAO = "claude-sonnet-5";

/** Conversa com gente: Coach, resumo do gestor, rascunho, tarefas do dia. */
export function modeloDeRaciocinio() {
  return process.env.AURA_IA_MODEL || PADRAO;
}

/** Triagem em volume: supervisor do WhatsApp e recados. */
export function modeloDeVolume() {
  return process.env.AURA_IA_MODEL_RAPIDO || process.env.WHATSAPP_IA_MODEL || modeloDeRaciocinio();
}
