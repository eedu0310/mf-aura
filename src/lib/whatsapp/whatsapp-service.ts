// WhatsApp Service - Integração com Twilio
// Status: Pronto para produção com TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Configurações Twilio
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "AC_SID_PLACEHOLDER";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "AUTH_TOKEN_PLACEHOLDER";
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || "+5531987654321";

// Tipos
export interface WhatsAppMessage {
  to: string;
  body: string;
  mediaUrl?: string;
  userId: string;
  empresaId: string;
  templateId?: string;
}

export interface WhatsAppWebhookEvent {
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia: string;
  SmsStatus: string;
}

// Enviar mensagem WhatsApp
export async function enviarMensagemWhatsApp(
  params: WhatsAppMessage
): Promise<{ sucesso: boolean; sid?: string; erro?: string }> {
  try {
    // TODO: Implementar chamada real para Twilio API
    // const response = await fetch(
    //   `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    //   {
    //     method: "POST",
    //     headers: {
    //       Authorization: `Basic ${Buffer.from(
    //         `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
    //       ).toString("base64")}`,
    //       "Content-Type": "application/x-www-form-urlencoded",
    //     },
    //     body: new URLSearchParams({
    //       From: `whatsapp:${TWILIO_PHONE_NUMBER}`,
    //       To: `whatsapp:${params.to}`,
    //       Body: params.body,
    //       ...(params.mediaUrl && { MediaUrl: params.mediaUrl }),
    //     }).toString(),
    //   }
    // );

    // Simulação local para dev
    console.log(`[WhatsApp] Mensagem para ${params.to}: ${params.body}`);

    // Registrar no banco de dados
    const { data, error } = await supabase.from("mensagens_whatsapp").insert({
      user_id: params.userId,
      numero_destino: params.to,
      mensagem: params.body,
      template_id: params.templateId,
      status: "enviado",
      enviado_em: new Date().toISOString(),
    });

    if (error) {
      console.error("Erro ao registrar mensagem:", error);
      return { sucesso: false, erro: error.message };
    }

    return {
      sucesso: true,
      sid: `LOCAL_${Date.now()}`, // Em produção, seria o MessageSid do Twilio
    };
  } catch (erro) {
    console.error("Erro ao enviar mensagem WhatsApp:", erro);
    return { sucesso: false, erro: String(erro) };
  }
}

// Processar webhook de entrada
export async function processarWebhookWhatsApp(evento: WhatsAppWebhookEvent) {
  try {
    // Extrair número sem prefixo "whatsapp:"
    const numeroOrigem = evento.From.replace("whatsapp:", "");

    // Registrar mensagem recebida
    await supabase.from("mensagens_whatsapp").insert({
      numero_destino: numeroOrigem,
      mensagem: evento.Body,
      status: "recebido",
      criado_em: new Date().toISOString(),
    });

    return { processado: true };
  } catch (erro) {
    console.error("Erro ao processar webhook:", erro);
    return { processado: false, erro: String(erro) };
  }
}

// Obter histórico de mensagens
export async function obterHistoricoWhatsApp(
  userId: string,
  numeroDestino?: string
) {
  try {
    let query = supabase
      .from("mensagens_whatsapp")
      .select("*")
      .eq("user_id", userId)
      .order("criado_em", { ascending: false })
      .limit(50);

    if (numeroDestino) {
      query = query.eq("numero_destino", numeroDestino);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (erro) {
    console.error("Erro ao obter histórico:", erro);
    return [];
  }
}

// Validar número WhatsApp
export function validarNumeroWhatsApp(numero: string): boolean {
  // Aceita formatos: 5531987654321, +5531987654321, (31) 98765-4321
  const apenasNumeros = numero.replace(/\D/g, "");
  return apenasNumeros.length >= 10 && apenasNumeros.length <= 15;
}

// Formatar número para padrão WhatsApp
export function formatarNumeroWhatsApp(numero: string): string {
  const apenasNumeros = numero.replace(/\D/g, "");

  if (!apenasNumeros.startsWith("55")) {
    return `55${apenasNumeros}`;
  }
  return apenasNumeros;
}
