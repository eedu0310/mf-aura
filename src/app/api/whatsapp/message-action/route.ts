import { NextRequest, NextResponse } from "next/server";
import { reagirMensagemBaileys } from "@/lib/whatsapp/baileys-client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const conversaId = String(body?.conversaId || "");
    const whatsappMessageId = String(body?.whatsappMessageId || "");
    const reaction = String(body?.reaction || "");
    if (!conversaId || !whatsappMessageId || reaction.length > 8) {
      return NextResponse.json(
        { sucesso: false, erro: "Dados de reacção inválidos." },
        { status: 400 },
      );
    }
    const result = await reagirMensagemBaileys(
      conversaId,
      whatsappMessageId,
      reaction,
    );
    return NextResponse.json(result, { status: result.sucesso ? 200 : 503 });
  } catch (error) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: error instanceof Error ? error.message : "Erro ao reagir.",
      },
      { status: 500 },
    );
  }
}
