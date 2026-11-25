import { NextResponse } from "next/server";
import { getEmpresaAutenticada, vejoTodasAsLojas } from "@/lib/auth-empresa";
import { rodarAgente } from "@/lib/agentes/motor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * "Rodar agora": o gestor mestre não precisa esperar o horário do agente.
 * Roda mesmo desligado (é um teste pedido por quem manda). Devolve o
 * resultado da rodada (ResultadoRodada, ver src/lib/agentes/motor.ts).
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Faça login novamente." }, { status: 401 });
  if (!vejoTodasAsLojas(auth)) {
    return NextResponse.json({ erro: "Só o gestor mestre roda um agente fora de hora." }, { status: 403 });
  }
  try {
    const rodada = await rodarAgente(id, { forcar: true, limiteMs: 240_000 });
    if (rodada.status === "aguardando_migracao") return NextResponse.json({ erro: rodada.mensagem, rodada }, { status: 409 });
    if (rodada.status === "ocupado") return NextResponse.json({ erro: rodada.mensagem, rodada }, { status: 409 });
    if (rodada.status === "ignorado") return NextResponse.json({ erro: rodada.mensagem, rodada }, { status: 400 });
    if (rodada.erro === "Agente desconhecido.") return NextResponse.json({ erro: rodada.erro }, { status: 404 });
    return NextResponse.json({ ok: rodada.status === "ok", rodada });
  } catch (e) {
    console.error("[gestor/agentes/rodar]", e);
    return NextResponse.json({ erro: "Não consegui rodar o agente agora." }, { status: 500 });
  }
}
