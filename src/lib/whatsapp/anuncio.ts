/**
 * De qual anúncio veio a conversa.
 *
 * Quando alguém clica em "Enviar mensagem" num anúncio do Facebook ou do
 * Instagram, o WhatsApp carimba a PRIMEIRA mensagem com um bloco
 * `externalAdReply` dentro do contextInfo. É o mesmo carimbo que o vendedor vê
 * na tela como "Anúncio do Facebook · Mostrar detalhes".
 *
 * POR QUE EXTRAIR NA CHEGADA, e não depois: o `raw` da mensagem só é guardado
 * quando ela tem mídia, e boa parte dos leads de anúncio chega como texto
 * puro. Lendo aqui, no momento em que o objeto completo existe, nenhum lead
 * se perde — e o dado fica preso à mensagem, que já é persistida em disco.
 */

export interface AnuncioDeOrigem {
  /** Título do anúncio, como aparece no card. */
  titulo: string | null;
  corpo: string | null;
  /** Identificador do anúncio na Meta. É por ele que a campanha é agrupada. */
  anuncioId: string | null;
  /** Link do post ou do anúncio. */
  url: string | null;
  /** "facebook" | "instagram" | "meta" quando não dá para distinguir. */
  plataforma: "facebook" | "instagram" | "meta";
  /** "ad" (anúncio pago) ou "post" (publicação orgânica). */
  tipo: string | null;
  /** Identificador do clique, útil para bater com o relatório da Meta. */
  cliqueId: string | null;
}

/** Descasca os envelopes que o WhatsApp usa (efêmera, ver uma vez, etc). */
function desembrulhar(message: any): any {
  if (!message) return null;
  return (
    message.ephemeralMessage?.message ??
    message.viewOnceMessage?.message ??
    message.viewOnceMessageV2?.message ??
    message.viewOnceMessageV2Extension?.message ??
    message.documentWithCaptionMessage?.message ??
    message.editedMessage?.message ??
    message
  );
}

/**
 * O carimbo pode vir pendurado em qualquer tipo de mensagem (texto, imagem,
 * vídeo...), então procuramos o contextInfo em todos eles em vez de supor que
 * é sempre extendedTextMessage — que foi a primeira coisa que eu ia fazer e
 * teria perdido todo lead que chega com foto.
 */
function acharExternalAdReply(message: any): any {
  const m = desembrulhar(message);
  if (!m || typeof m !== "object") return null;
  for (const chave of Object.keys(m)) {
    const valor = (m as Record<string, any>)[chave];
    const anuncio = valor?.contextInfo?.externalAdReply;
    if (anuncio && typeof anuncio === "object") return anuncio;
  }
  return m.contextInfo?.externalAdReply ?? null;
}

function plataformaDe(url: string | null, bruto: any): AnuncioDeOrigem["plataforma"] {
  const texto = `${url ?? ""} ${bruto?.sourceApp ?? ""}`.toLowerCase();
  if (texto.includes("instagram") || texto.includes("ig.me")) return "instagram";
  if (texto.includes("facebook") || texto.includes("fb.me") || texto.includes("fb.com")) {
    return "facebook";
  }
  return "meta";
}

function texto(valor: unknown): string | null {
  const t = typeof valor === "string" ? valor.trim() : "";
  return t ? t.slice(0, 300) : null;
}

/**
 * Lê o anúncio de origem de uma mensagem crua do Baileys.
 * Devolve null quando a mensagem não veio de anúncio nenhum.
 */
export function extrairAnuncio(msg: any): AnuncioDeOrigem | null {
  const bruto = acharExternalAdReply(msg?.message);
  if (!bruto) return null;

  const url = texto(bruto.sourceUrl);
  const anuncioId = texto(bruto.sourceId);
  const cliqueId = texto(bruto.ctwaClid);
  const titulo = texto(bruto.title);

  /*
   * Sem NENHUM identificador não dá para agrupar nem conferir com a Meta
   * depois, e um "lead de anúncio" que não sabe de qual anúncio veio só
   * suja o relatório do marketing. Melhor não classificar.
   */
  if (!anuncioId && !url && !cliqueId && !titulo) return null;

  return {
    titulo,
    corpo: texto(bruto.body),
    anuncioId,
    url,
    plataforma: plataformaDe(url, bruto),
    tipo: texto(bruto.sourceType),
    cliqueId,
  };
}

/**
 * A chave que agrupa leads do mesmo anúncio numa campanha só.
 *
 * Preferimos o id do anúncio; sem ele, a URL; sem ela, o título. O cliqueId
 * NUNCA serve: ele é único por clique, então cada lead viraria uma campanha
 * com uma pessoa dentro e o relatório não diria nada.
 */
export function chaveDaCampanha(a: AnuncioDeOrigem): string | null {
  if (a.anuncioId) return `id:${a.anuncioId}`;
  if (a.url) return `url:${a.url}`;
  if (a.titulo) return `titulo:${a.titulo.toLowerCase()}`;
  return null;
}

/** Nome legível da campanha, para quem for olhar a aba de marketing. */
export function nomeDaCampanha(a: AnuncioDeOrigem): string {
  const plataforma = a.plataforma === "meta" ? "Meta" : a.plataforma === "facebook" ? "Facebook" : "Instagram";
  if (a.titulo) return `${plataforma} · ${a.titulo}`;
  if (a.anuncioId) return `${plataforma} · anúncio ${a.anuncioId}`;
  if (a.url) return `${plataforma} · ${a.url}`;
  return `${plataforma} · anúncio sem título`;
}
