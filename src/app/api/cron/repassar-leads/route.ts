import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

/**
 * Roda automaticamente a cada 5 minutos (configurado em vercel.json).
 * Repassa pro vendedor qualquer lead cujo prazo do SDR tenha vencido
 * sem resposta.
 */
export async function GET(request: Request) {
  const segredoEsperado = process.env.CRON_SECRET;
  const cabecalhoAutorizacao = request.headers.get("authorization");

  if (segredoEsperado && cabecalhoAutorizacao !== `Bearer ${segredoEsperado}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json({ erro: "Supabase não configurado." }, { status: 500 });
  }

  const { data, error } = await supabase.rpc("repassar_leads_expirados");

  if (error) {
    console.error("Erro ao repassar leads expirados:", error);
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, leadsRepassados: data ?? 0 });
}
