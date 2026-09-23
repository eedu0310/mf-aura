import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai-client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const openai = getOpenAIClient();

  if (!openai) {
    return NextResponse.json({ erro: "Este navegador não transcreve sozinho. Use o Chrome (o texto aparece enquanto você fala) ou escreva o relato." }, { status: 503 });
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
