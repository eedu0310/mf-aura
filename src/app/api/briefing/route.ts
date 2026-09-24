import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { montarBriefing } from "@/lib/aura/briefing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** O briefing de hoje do vendedor logado — usado no primeiro acesso do dia. */
export async function GET() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const briefing = await montarBriefing(auth.userId);
  if (!briefing) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  return NextResponse.json(briefing);
}
