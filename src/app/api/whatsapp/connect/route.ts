import { NextResponse } from "next/server";
import { iniciarBaileys } from "@/lib/whatsapp/baileys-client";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    if (!(await getEmpresaAutenticada())) {
      return NextResponse.json({ sucesso: false, erro: "Usuário não autenticado." }, { status: 401 });
    }
    return NextResponse.json(await iniciarBaileys(), { status: 202 });
  } catch (error) {
    return NextResponse.json(
      {
        sucesso: false,
        erro:
          error instanceof Error
            ? error.message
            : "Erro ao iniciar o WhatsApp.",
      },
      { status: 500 },
    );
  }
}
