import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { executarSupervisaoAura } from "@/lib/aura-supervisor";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  const autorizacao = request.headers.get("authorization");
  if (segredo && autorizacao !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ erro: "Supabase não configurado." }, { status: 500 });
  }

  try {
    const resultados = await executarSupervisaoAura(supabase);
    return NextResponse.json({ ok: true, executados: resultados.length, resultados });
  } catch (erro) {
    console.error("AURA Supervisor: erro geral", erro);
    return NextResponse.json({ erro: "Não foi possível executar a supervisão." }, { status: 500 });
  }
}
