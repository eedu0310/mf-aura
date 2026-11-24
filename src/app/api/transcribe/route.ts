import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { clienteDeAudio } from "@/lib/openai-client";

export const runtime = "nodejs";

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

    const transcricaoResp = await openai.audio.transcriptions.create({
      file: arquivo,
      model: "whisper-1",
      language: "pt",
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
