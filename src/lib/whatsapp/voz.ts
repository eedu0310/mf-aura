/**
 * Prepara o áudio gravado no navegador para virar mensagem de voz.
 *
 * O WhatsApp só mostra a bolinha de voz — com onda, play e velocidade — se o
 * áudio chegar como Opus dentro de um OGG. O que o navegador grava é Opus
 * dentro de um WebM: mesmo som, embalagem diferente. Sem converter, o cliente
 * recebe um arquivo anexado que boa parte dos celulares nem toca.
 *
 * A conversão é feita pelo ffmpeg, que não é dependência do projeto e sim do
 * servidor. Quando ele não está instalado, a gravação é recusada com o
 * recado de como instalar — melhor que mandar ao cliente um áudio mudo.
 */
import { spawn } from "child_process";

const g = globalThis as unknown as { __auraTemFfmpeg?: boolean };

export const RECADO_SEM_FFMPEG =
  "O servidor ainda não converte áudio. Peça para instalar o ffmpeg (sudo apt install -y ffmpeg) e reiniciar a AURA.";

/** O ffmpeg existe nesta máquina? A resposta é lembrada até reiniciar. */
export async function temFfmpeg(): Promise<boolean> {
  if (typeof g.__auraTemFfmpeg === "boolean") return g.__auraTemFfmpeg;
  g.__auraTemFfmpeg = await new Promise<boolean>((resolve) => {
    try {
      const p = spawn("ffmpeg", ["-version"]);
      p.on("error", () => resolve(false));
      p.on("close", (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
  return g.__auraTemFfmpeg;
}

function jaEhOggOpus(mimetype: string) {
  return /ogg/i.test(mimetype) && !/webm/i.test(mimetype);
}

/**
 * Devolve o áudio pronto para `ptt`. Lança com um recado legível quando não
 * dá para converter — a tela mostra esse texto ao vendedor.
 */
export async function paraVozOpus(buffer: Buffer, mimetype: string): Promise<Buffer> {
  if (jaEhOggOpus(mimetype)) return buffer;
  if (!(await temFfmpeg())) throw new Error(RECADO_SEM_FFMPEG);

  return new Promise<Buffer>((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-vn",
      "-c:a", "libopus",
      "-b:a", "32k",     // voz: mais que isto não melhora e pesa no 3G do cliente
      "-ar", "48000",
      "-ac", "1",
      "-f", "ogg",
      "pipe:1",
    ]);

    const pedacos: Buffer[] = [];
    const erros: Buffer[] = [];
    ff.stdout.on("data", (d) => pedacos.push(d as Buffer));
    ff.stderr.on("data", (d) => erros.push(d as Buffer));
    ff.on("error", () => reject(new Error(RECADO_SEM_FFMPEG)));
    ff.on("close", (code) => {
      const saida = Buffer.concat(pedacos);
      if (code === 0 && saida.length) return resolve(saida);
      const detalhe = Buffer.concat(erros).toString().trim().split("\n").slice(-1)[0] ?? "";
      reject(new Error(`Não consegui preparar o áudio para envio.${detalhe ? ` (${detalhe})` : ""}`));
    });

    ff.stdin.on("error", () => {
      /* o close acima já trata */
    });
    ff.stdin.end(buffer);
  });
}
