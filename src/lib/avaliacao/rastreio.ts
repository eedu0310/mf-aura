/**
 * Rastreio do pedido de avaliação no Google pela conversa do WhatsApp
 * (pedido do Elton, 27/11/2026: "os agentes rastreiem esses envios de links
 * do Google e contabilize quando o vendedor enviar, quando o cliente abrir e
 * avaliar").
 *
 * Antes, o envio só contava se o vendedor tocasse no botão do painel; quem
 * colava o link à mão ou mandava do celular ficava com zero no ranking. Aqui
 * a AURA lê a mensagem que JÁ passou pela conversa (só lê; não manda nada, não
 * mexe na conexão) e marca:
 *   - vendedor mandou link de avaliação  → enviado_em;
 *   - cliente abriu o link /av/…         → aberto_em (na rota /av/[token]);
 *   - cliente disse que avaliou          → confirmado_em (o gestor pode desfazer).
 *
 * Este arquivo só tem as regras (sem banco), para serem testadas.
 */

const TOKEN_AV = /\/av\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/** Link que só existe para avaliar: conta sempre. */
const LINK_DE_AVALIAR = [/search\.google\.[a-z.]+\/local\/writereview/i, /g\.page\/r\/[\w-]+/i, /g\.page\/[\w-]+\/review/i];

/**
 * Link do Google Maps em geral: pode ser só o endereço da loja ("estamos
 * aqui"). Conta apenas quando a mensagem fala de avaliação junto.
 */
const LINK_DO_MAPS = [/maps\.app\.goo\.gl\/\w+/i, /goo\.gl\/maps\/\w+/i, /g\.co\/kgs\/\w+/i, /google\.[a-z.]+\/maps\//i];
const FALA_DE_AVALIACAO = /avali|estrela|review|opini[ãa]o|depoimento|coment[áa]rio/i;

export function normalizarLink(u: string): string {
  return u
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/[/?#]+$/, "")
    .toLowerCase();
}

export interface LinkAchado {
  /** Token do link curto da AURA (/av/<token>), quando foi ele. */
  token: string | null;
  /** Loja dona do link, quando é o link cadastrado de uma loja. */
  empresa: string | null;
}

/**
 * A mensagem do vendedor leva um link de avaliação?
 * `linksDasLojas`: o link do Google cadastrado de cada loja (config_avaliacao).
 */
export function linkDeAvaliacao(
  texto: string,
  linksDasLojas: { empresa: string; link: string | null }[] = [],
): LinkAchado | null {
  if (!texto) return null;
  const token = TOKEN_AV.exec(texto)?.[1]?.toLowerCase() ?? null;
  if (token) return { token, empresa: null };

  const normal = normalizarLink(texto.replace(/\s+/g, " "));
  for (const l of linksDasLojas) {
    const alvo = l.link ? normalizarLink(l.link) : "";
    if (alvo.length >= 8 && normal.includes(alvo)) return { token: null, empresa: l.empresa };
  }
  if (LINK_DE_AVALIAR.some((r) => r.test(texto))) return { token: null, empresa: null };
  if (LINK_DO_MAPS.some((r) => r.test(texto)) && FALA_DE_AVALIACAO.test(texto)) return { token: null, empresa: null };
  return null;
}

/** "Ainda não avaliei", "não consegui deixar a avaliação". */
const NEGA = /\b(n[ãa]o|nem|naum)\b[^.!?\n]{0,25}(avali|estrela|coment)/i;

const AVALIOU = [
  /\b(j[áa]\s+)?avaliei\b/i,
  /\bj[áa]\s+avaliamos\b/i,
  /\bj[áa]\s+(foi\s+|est[áa]\s+)?avaliad[oa]\b/i,
  /\b(deixei|fiz|dei|coloquei|mandei|postei|registrei|deixamos|fizemos|demos)\s+(a\s+|minha\s+|nossa\s+|uma\s+|o\s+|meu\s+|as\s+|um\s+|l[áa]\s+)?(avalia[çc][ãa]o|5\s+estrelas|cinco\s+estrelas|estrelas|coment[áa]rio|review)/i,
  /\bavalia[çc][ãa]o\s+(feita|enviada|postada|deixada|dada|registrada)\b/i,
];

/**
 * "Avaliei" também é "analisei": "avaliei o orçamento e achei caro". Se a
 * frase fala de orçamento, proposta, preço ou modelo e não fala de Google ou
 * estrelas, não é avaliação no Google.
 */
const OUTRO_ASSUNTO = /or[çc]amento|proposta|valor|pre[çc]o|modelo|op[çc][õo]es|projeto|condi[çc][õo]es/i;
const DO_GOOGLE = /google|estrela|⭐|review|l[áa]\s+no\s+(google|maps)/i;

/** O cliente diz que já avaliou? */
export function clienteDizQueAvaliou(texto: string): boolean {
  const t = (texto ?? "").trim();
  if (!t || t.length > 400) return false;
  if (NEGA.test(t)) return false;
  if (!AVALIOU.some((r) => r.test(t))) return false;
  if (OUTRO_ASSUNTO.test(t) && !DO_GOOGLE.test(t)) return false;
  return true;
}

/** Os 8 últimos dígitos (o número sem DDD e sem o 9 extra). */
export function fimDoTelefone(telefone: string | null | undefined): string | null {
  const d = String(telefone ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-8) : null;
}
