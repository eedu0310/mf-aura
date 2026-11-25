/**
 * Foto, vídeo e áudio que o vendedor manda pelo direct do Instagram.
 *
 * A Meta não recebe o arquivo: ela busca por um endereço público. Então o
 * arquivo vai primeiro para o bucket `instagram` do Supabase e o endereço
 * segue no envio.
 *
 * O áudio gravado no navegador sai em WebM/Opus (Chrome) ou MP4 (Safari); o
 * Instagram só toca AAC/M4A, WAV ou MP4. O ffmpeg do servidor converte para
 * M4A antes de subir — o mesmo ffmpeg que já prepara os áudios do WhatsApp.
 */
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import { readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { RECADO_SEM_FFMPEG, temFfmpeg } from "@/lib/whatsapp/voz";
import type { getSupabaseServiceClient } from "@/lib/supabase/service";

type ClienteServico = NonNullable<ReturnType<typeof getSupabaseServiceClient>>;

const LIMITE_FOTO = 8 * 1024 * 1024;
const LIMITE_OUTROS = 25 * 1024 * 1024;

const FOTO: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "jpg" };
const VIDEO: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov" };

export type TipoMidia = "image" | "audio" | "video";

function paraM4a(entrada: Buffer): Promise<Buffer> {
  // Sai para um arquivo temporário (e não por pipe) para o índice do MP4 ir
  // para o começo (+faststart): MP4 fragmentado nem todo celular toca.
  const saida = join(tmpdir(), `aura-ig-${randomUUID()}.m4a`);
  return new Promise<Buffer>((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", "pipe:0",
      "-vn", "-c:a", "aac", "-b:a", "64k", "-ac", "1", "-ar", "44100",
      "-movflags", "+faststart",
      saida,
    ]);
    const erros: Buffer[] = [];
    ff.stderr.on("data", (d) => erros.push(d as Buffer));
    ff.on("error", () => reject(new Error(RECADO_SEM_FFMPEG)));
    ff.on("close", async (code) => {
      try {
        const pronto = code === 0 ? await readFile(saida) : null;
        if (pronto?.length) return resolve(pronto);
        const detalhe = Buffer.concat(erros).toString().trim().split("\n").slice(-1)[0] ?? "";
        reject(new Error(`Não consegui preparar o áudio.${detalhe ? ` (${detalhe})` : ""}`));
      } catch (e) {
        reject(e as Error);
      } finally {
        void unlink(saida).catch(() => {});
      }
    });
    ff.stdin.on("error", () => {});
    ff.stdin.end(entrada);
  });
}

/** Sobe o arquivo e devolve o endereço público e o tipo que a Meta espera. */
export async function salvarMidia(
  sb: ClienteServico,
  empresa: string,
  arquivo: File,
): Promise<{ url: string; tipo: TipoMidia } | { erro: string }> {
  const mime = (arquivo.type || "").split(";")[0].trim().toLowerCase();
  let tipo: TipoMidia;
  let ext: string;
  let conteudo: Buffer = Buffer.from(await arquivo.arrayBuffer());
  let contentType = mime;

  if (FOTO[mime]) {
    if (arquivo.size > LIMITE_FOTO) return { erro: "Foto grande demais (máximo 8 MB)." };
    tipo = "image";
    ext = FOTO[mime];
  } else if (VIDEO[mime]) {
    if (arquivo.size > LIMITE_OUTROS) return { erro: "Vídeo grande demais (máximo 25 MB)." };
    tipo = "video";
    ext = VIDEO[mime];
  } else if (mime.startsWith("audio/")) {
    if (arquivo.size > LIMITE_OUTROS) return { erro: "Áudio grande demais (máximo 25 MB)." };
    if (!(await temFfmpeg())) return { erro: RECADO_SEM_FFMPEG };
    try {
      conteudo = await paraM4a(conteudo);
    } catch (e) {
      return { erro: (e as Error).message };
    }
    tipo = "audio";
    ext = "m4a";
    contentType = "audio/mp4";
  } else {
    return { erro: "O Instagram aceita foto (JPG, PNG, GIF), vídeo (MP4, MOV) ou áudio." };
  }

  const pasta = empresa.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  const caminho = `${pasta}/${randomUUID()}.${ext}`;
  const { error } = await sb.storage.from("instagram").upload(caminho, conteudo, { contentType, upsert: false });
  if (error) return { erro: `Não consegui guardar o arquivo: ${error.message}` };
  return { url: sb.storage.from("instagram").getPublicUrl(caminho).data.publicUrl, tipo };
}

/** Texto curto para a lista de conversas. */
export function resumoDaMidia(tipo: string): string {
  if (tipo === "image") return "📷 Foto";
  if (tipo === "audio") return "🎤 Áudio";
  if (tipo === "video") return "🎬 Vídeo";
  if (tipo === "share" || tipo === "ig_reel" || tipo === "reel") return "🔗 Publicação";
  if (tipo === "story_mention") return "📣 Marcou a loja no story";
  return "📎 Anexo";
}
