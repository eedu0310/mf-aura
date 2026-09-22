/**
 * Envia uma mensagem de texto via WhatsApp Cloud API (Meta), usando o
 * Phone Number ID e o token configurados no .env.local.
 */
export async function enviarMensagemWhatsApp(phoneNumberId: string, para: string, texto: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    console.error("WHATSAPP_ACCESS_TOKEN não configurado — não foi possível enviar a mensagem.");
    return false;
  }

  try {
    const resposta = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: para,
        type: "text",
        text: { body: texto },
      }),
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text();
      console.error("Erro ao enviar mensagem via WhatsApp:", detalhe);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro ao enviar mensagem via WhatsApp:", err);
    return false;
  }
}
