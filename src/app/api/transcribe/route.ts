import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { clienteDeAudio } from "@/lib/openai-client";
import { registrarUsoIA } from "@/lib/aura/custo-ia";

export const runtime = "nodejs";

/**
 * Preço do Whisper: US$ 0,006 por minuto de áudio.
 *
 * A transcrição era o único gasto de IA que não entrava no painel de custo:
 * o Whisper cobra por minuto, não por token, e registrarUsoIA só sabia
 * contar token. Agora entra com o custo calculado pela duração.
 */
const USD_POR_MINUTO = 0.006;

/**
 * Bits por segundo típicos de cada formato, para ESTIMAR a duração quando a
 * OpenAI não a devolve. Erra para cima de propósito nos comprimidos (o
 * gravador do navegador grava opus a ~32 kbps): custo estimado a mais é
 * melhor que custo sumido.
 */
function estimarSegundos(bytes: number, tipo: string): number {
  const kbps = /webm|ogg|oga|opus/.test(tipo)
    ? 24
    : /mpeg|mp3|mpga|mp4|m4a/.test(tipo)
      ? 96
      : /flac/.test(tipo)
        ? 400
        : /wav|wave/.test(tipo)
          ? 256
          : 32;
  return (bytes * 8) / (kbps * 1000);
}

/**
 * O limite do Whisper é 25 MB, e os formatos são os que ele aceita. Antes a
 * rota recebia qualquer coisa de qualquer tamanho: o arquivo inteiro ia para a
 * memória do servidor e seguia para a OpenAI, que recusava — depois de nós já
 * termos pago o upload e segurado a requisição.
 */
const MAXIMO = 25 * 1024 * 1024;
const TIPOS_DE_AUDIO = new Set([
  "audio/webm", "video/webm",
  "audio/ogg", "audio/oga",
  "audio/mpeg", "audio/mp3", "audio/mpga", "video/mpeg",
  "audio/mp4", "audio/m4a", "audio/x-m4a", "video/mp4",
  "audio/wav", "audio/x-wav", "audio/wave",
  "audio/flac", "audio/x-flac",
]);

export async function POST(request: Request) {
  // Cada chamada aqui gasta crédito da OpenAI. A rota só era protegida pelo
  // proxy, que confere a sessão mas não o resto — e uma rota que custa
  // dinheiro por chamada precisa saber quem chamou.
  const auth = await getEmpresaAutenticada(request);
  if (!auth) {
    return NextResponse.json({ erro: "Faça login novamente." }, { status: 401 });
  }

  // Transcrição é a única coisa que não roda no Claude: ele não recebe áudio.
  // Por isso aqui vai o cliente dedicado da OpenAI, e não a ponte do Claude —
  // que não tem audio.transcriptions e falharia num catch genérico, dizendo
  // "não consegui transcrever" sem explicar que falta a chave.
  const openai = clienteDeAudio();

  if (!openai) {
    return NextResponse.json(
      { erro: "A transcrição de áudio está desligada: falta a OPENAI_API_KEY no servidor. Enquanto isso, use o Chrome (o texto aparece enquanto você fala) ou escreva o relato." },
      { status: 503 },
    );
  }

  // Confere o tamanho declarado antes de ler o corpo: formData() guarda tudo
  // na memória. A folga de 1 MB é para o envelope do multipart.
  if (Number(request.headers.get("content-length") ?? 0) > MAXIMO + 1024 * 1024) {
    return NextResponse.json({ erro: "Áudio grande demais: o limite é 25 MB." }, { status: 413 });
  }

  try {
    const formData = await request.formData();
    const arquivo = formData.get("audio");

    if (!arquivo || !(arquivo instanceof File)) {
      return NextResponse.json({ erro: "Nenhum áudio recebido." }, { status: 400 });
    }
    if (arquivo.size > MAXIMO) {
      return NextResponse.json({ erro: "Áudio grande demais: o limite é 25 MB." }, { status: 413 });
    }
    // "audio/webm;codecs=opus" vale como audio/webm.
    const tipo = arquivo.type.split(";")[0].trim().toLowerCase();
    if (!TIPOS_DE_AUDIO.has(tipo)) {
      return NextResponse.json({ erro: "Formato não aceito: mande um áudio (webm, ogg, mp3, m4a, wav)." }, { status: 415 });
    }

    // verbose_json traz a duração do áudio, que é o que o Whisper cobra.
    const transcricaoResp = await openai.audio.transcriptions.create({
      file: arquivo,
      model: "whisper-1",
      language: "pt",
      response_format: "verbose_json",
    });

    const segundos =
      typeof transcricaoResp.duration === "number" && transcricaoResp.duration > 0
        ? transcricaoResp.duration
        : estimarSegundos(arquivo.size, tipo);
    void registrarUsoIA({
      funcao: "transcricao",
      modelo: "whisper-1",
      custoUsd: (segundos / 60) * USD_POR_MINUTO,
      empresa: auth.empresa,
      usuarioId: auth.userId,
    });

    return NextResponse.json({ transcricao: transcricaoResp.text, simulado: false });
  } catch (err) {
    console.error("Erro ao transcrever áudio:", err);
    return NextResponse.json(
      { erro: "Não consegui transcrever o áudio. Use o Chrome para ditar ou escreva o relato." },
      { status: 500 }
    );
  }
}
