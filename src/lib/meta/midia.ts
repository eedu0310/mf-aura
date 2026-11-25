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
import { readFile, unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { RECADO_SEM_FFMPEG, temFfmpeg } from "@/lib/whatsapp/voz";
import type { getSupabaseServiceClient } from "@/lib/supabase/service";

type ClienteServico = NonNullable<ReturnType<typeof getSupabaseServiceClient>>;

const LIMITE_FOTO = 8 * 1024 * 1024;
const LIMITE_OUTROS = 25 * 1024 * 1024;

const FOTO: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif" };

export type TipoMidia = "image" | "audio" | "video";

/**
 * Roda o ffmpeg de arquivo para arquivo. Entrada em arquivo (e não por pipe)
 * porque o .mov do iPhone guarda o índice no fim e o ffmpeg precisa voltar
 * nele; saída em arquivo para o MP4 sair com o índice no começo (+faststart),
 * que é o que o Instagram e os celulares tocam sem travar.
 */
async function converter(entrada: Buffer, extEntrada: string, extSaida: string, args: string[]): Promise<Buffer> {
  const base = join(tmpdir(), `aura-ig-${randomUUID()}`);
  const de = `${base}-in.${extEntrada}`;
  const para = `${base}-out.${extSaida}`;
  await writeFile(de, entrada);
  try {
    await new Promise<void>((resolve, reject) => {
      const ff = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", de, ...args, para]);
      const erros: Buffer[] = [];
      ff.stderr.on("data", (d) => erros.push(d as Buffer));
      ff.on("error", () => reject(new Error(RECADO_SEM_FFMPEG)));
      ff.on("close", (code) => {
        if (code === 0) return resolve();
        const detalhe = Buffer.concat(erros).toString().trim().split("\n").slice(-1)[0] ?? "";
        reject(new Error(`Não consegui preparar o arquivo.${detalhe ? ` (${detalhe})` : ""}`));
      });
    });
    const pronto = await readFile(para);
    if (!pronto.length) throw new Error("Não consegui preparar o arquivo.");
    return pronto;
  } finally {
    void unlink(de).catch(() => {});
    void unlink(para).catch(() => {});
  }
}

/** Áudio gravado no navegador (WebM/Opus, OGG, MP4) → M4A/AAC, que o Instagram toca. */
function paraM4a(entrada: Buffer, ext: string) {
  return converter(entrada, ext, "m4a", ["-vn", "-c:a", "aac", "-b:a", "64k", "-ac", "1", "-ar", "44100", "-movflags", "+faststart"]);
}

/**
 * Qualquer vídeo (MOV do iPhone em HEVC, WebM, MP4 grande) → MP4 H.264 de até
 * 720p, que o Instagram aceita. Se ainda passar de 25 MB, comprime mais.
 */
async function paraMp4(entrada: Buffer, ext: string) {
  const tentativa = (crf: string, altura: number) =>
    converter(entrada, ext, "mp4", [
      "-vf", `scale=-2:'min(${altura},ih)'`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", crf, "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "96k", "-ac", "2",
      "-movflags", "+faststart",
    ]);
  const primeiro = await tentativa("28", 720);
  if (primeiro.length <= LIMITE_OUTROS) return primeiro;
  const segundo = await tentativa("32", 480);
  if (segundo.length <= LIMITE_OUTROS) return segundo;
  throw new Error("Vídeo longo demais para o Instagram mesmo comprimido (máximo 25 MB). Corte o vídeo e tente de novo.");
}

function extensaoDe(arquivo: File, mime: string) {
  const doNome = /\.([a-z0-9]{2,5})$/i.exec(arquivo.name || "")?.[1]?.toLowerCase();
  return doNome || mime.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "bin";
}

/** Sobe o arquivo e devolve o endereço público e o tipo que a Meta espera. */
export async function salvarMidia(
  sb: ClienteServico,
  empresa: string,
  arquivo: File,
): Promise<{ url: string; tipo: TipoMidia } | { erro: string }> {
  const mime = (arquivo.type || "").split(";")[0].trim().toLowerCase();
  const extOrig = extensaoDe(arquivo, mime);
  let tipo: TipoMidia;
  let ext: string;
  let conteudo: Buffer = Buffer.from(await arquivo.arrayBuffer());
  let contentType = mime;

  if (arquivo.size > LIMITE_OUTROS) {
    return { erro: "Arquivo grande demais (máximo 25 MB). Para vídeo, corte um trecho menor." };
  }
  if (/heic|heif/.test(mime) || /^(heic|heif)$/.test(extOrig)) {
    return { erro: "Foto do iPhone em HEIC: tire um print ou exporte como JPG e mande de novo." };
  }

  try {
    if (FOTO[mime]) {
      if (arquivo.size > LIMITE_FOTO) return { erro: "Foto grande demais (máximo 8 MB)." };
      tipo = "image";
      ext = FOTO[mime];
    } else if (mime.startsWith("image/")) {
      // WebP, BMP e afins: o Instagram não aceita; vira JPG.
      if (!(await temFfmpeg())) return { erro: RECADO_SEM_FFMPEG };
      conteudo = await converter(conteudo, extOrig, "jpg", ["-q:v", "3"]);
      tipo = "image";
      ext = "jpg";
      contentType = "image/jpeg";
    } else if (mime.startsWith("video/")) {
      if (!(await temFfmpeg())) return { erro: RECADO_SEM_FFMPEG };
      conteudo = await paraMp4(conteudo, extOrig);
      tipo = "video";
      ext = "mp4";
      contentType = "video/mp4";
    } else if (mime.startsWith("audio/")) {
      if (!(await temFfmpeg())) return { erro: RECADO_SEM_FFMPEG };
      conteudo = await paraM4a(conteudo, extOrig);
      tipo = "audio";
      ext = "m4a";
      contentType = "audio/mp4";
    } else {
      return { erro: "O Instagram aceita foto, GIF, vídeo ou áudio." };
    }
  } catch (e) {
    return { erro: (e as Error).message };
  }

  const pasta = empresa.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
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
  if (tipo === "like_heart") return "❤️";
  return "📎 Anexo";
}
