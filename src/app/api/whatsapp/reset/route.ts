import { NextResponse } from "next/server";
import { resetarBaileys } from "@/lib/whatsapp/baileys-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const resultado = await resetarBaileys();
    return NextResponse.json(resultado, { status: 202 });
  } catch (error) {
    console.error("Erro na rota de reset do WhatsApp:", error);
    return NextResponse.json(
      {
        sucesso: false,
        erro:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar um novo QR Code.",
      },
      { status: 500 },
    );
  }
}
