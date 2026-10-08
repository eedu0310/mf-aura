import { clienteDeAudio } from "@/lib/openai-client";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { getMedia, type WaMessage } from "./live-manager";

/**
 * Transcreve os áudios de uma conversa para a AURA poder LER o que foi falado.
 *
 * Por que existe: a transcrição que vai para a IA mostrava áudio apenas como
 * um rótulo, sem conteúdo. A IA lia "CLIENTE: áudio / VENDEDOR: catálogo" e
 * concluía que o vendedor respondeu sem diagnosticar — quando o pedido estava
 * dentro do áudio. Um vendedor da A&G foi cobrado assim por um atendimento
 * correto. Dezessete por cento das conversas da semana têm áudio.
 *
 * Três travas de custo, porque isto roda em cima de centenas de conversas:
 *
 * 1. CACHE POR MENSAGEM. A mesma conversa é analisada cerca de cinco vezes na
 *    semana. Sem cache, pagaríamos cinco vezes pelo mesmo minuto de áudio. O
 *    id da mensagem do WhatsApp não muda, então transcreveu uma vez, acabou.
 * 2. TETO POR ANÁLISE. No máximo TETO_POR_ANALISE áudios novos de cada vez.
 *    Uma conversa com cem áudios acumulados não vira uma conta inesperada; ela
 *    se completa ao longo das próximas análises.
 * 3. TETO DE TAMANHO. Áudio muito grande é pulado. O Whisper recusa acima de
 *    25 MB, e um arquivo enorme quase sempre é vídeo ou engano.
 *
 * Sem OPENAI_API_KEY nada disso roda e a conversa segue com o marcador de
 * áudio não transcrito. É degradação, não quebra.
 */

const TETO_POR_ANALISE = 8;
const TETO_BYTES = 20 * 1024 * 1024;

/** Transcrições já guardadas, por id de mensagem. */
async function jaTranscritos(ids: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (!ids.length) return mapa;

  const sb = getSupabaseServiceClient();
  if (!sb) return mapa;

  const { data, error } = await sb
    .from("whatsapp_transcricoes")
    .select("msg_id, texto")
    .in("msg_id", ids);

  if (error) {
    // Erro de leitura não pode virar "nada transcrito ainda": isso mandaria
    // tudo para o Whisper de novo e pagaríamos duas vezes. Melhor seguir sem
    // transcrição nenhuma nesta rodada.
    console.error("[transcrever] não consegui ler o cache:", error.message);
    return mapa;
  }

  for (const linha of data ?? []) {
    mapa.set(String(linha.msg_id), String(linha.texto ?? ""));
  }
  return mapa;
}

export async function transcricoesDaConversa(
  userId: string,
  empresa: string | null,
  chatJid: string,
  msgs: WaMessage[],
): Promise<Map<string, string>> {
  const audios = msgs.filter((m) => m.type === "audio" && m.id);
  if (!audios.length) return new Map();

  const mapa = await jaTranscritos(audios.map((m) => m.id));

  const openai = clienteDeAudio();
  if (!openai) return mapa;

  const faltando = audios.filter((m) => !mapa.has(m.id)).slice(-TETO_POR_ANALISE);
  if (!faltando.length) return mapa;

  const sb = getSupabaseServiceClient();
  const novas: Record<string, unknown>[] = [];

  for (const m of faltando) {
    try {
      const midia = await getMedia(userId, m.id);
      const buffer = midia?.buffer;
      if (!buffer || buffer.length === 0 || buffer.length > TETO_BYTES) continue;

      const arquivo = new File([new Uint8Array(buffer)], `${m.id}.ogg`, {
        type: m.mimetype || "audio/ogg",
      });

      const resp = await openai.audio.transcriptions.create({
        file: arquivo,
        model: "whisper-1",
        // O áudio é de cliente brasileiro falando de lareira e aquecimento.
        // Dizer a língua evita o Whisper "adivinhar" espanhol num áudio curto.
        language: "pt",
      });

      const texto = String(resp.text ?? "").trim();
      if (!texto) continue;

      mapa.set(m.id, texto);
      novas.push({
        msg_id: m.id,
        owner_id: userId,
        empresa,
        chat_jid: chatJid,
        texto,
        bytes: buffer.length,
      });
    } catch (e) {
      // Um áudio que falha não derruba a análise da conversa inteira.
      console.error(`[transcrever] áudio ${m.id} falhou:`, e instanceof Error ? e.message : e);
    }
  }

  if (sb && novas.length) {
    const { error } = await sb.from("whatsapp_transcricoes").upsert(novas, { onConflict: "msg_id" });
    if (error) {
      // Transcreveu mas não guardou: funciona agora e seria refeito (e pago)
      // na próxima análise. Precisa aparecer no log.
      console.error("[transcrever] não consegui guardar as transcrições:", error.message);
    }
  }

  return mapa;
}
