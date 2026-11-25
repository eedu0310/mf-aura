import { NextResponse } from "next/server";
import { rodadaDoAgente } from "@/lib/meta/agente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * De 10 em 10 minutos: o agente de IA do Instagram responde o direct que
 * esperou mais que o tempo configurado na loja (padrão 2h) sem resposta da
 * equipe e, se ligado, os comentários sem resposta.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (segredo && request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, ...(await rodadaDoAgente()) });
}
