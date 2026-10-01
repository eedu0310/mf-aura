import { NextResponse } from "next/server";
import { clienteDeAudio } from "@/lib/openai-client";

export const runtime = "nodejs";

export async function POST(request: Request) {
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

  try {
    const formData = await request.formData();
    const arquivo = formData.get("audio");

    if (!arquivo || !(arquivo instanceof File)) {
      return NextResponse.json({ erro: "Nenhum áudio recebido." }, { status: 400 });
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
