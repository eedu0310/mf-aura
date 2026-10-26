import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { equipeDoSite } from "@/lib/site-mf/servidor";
import { EMPRESAS } from "@/lib/companies";

export const runtime = "nodejs";

/**
 * Quem pode receber um lead transferido pela MF, por loja. A equipe da MF não
 * enxerga a equipe das outras lojas pelo banco (cada loja só vê a sua), então
 * a lista sai daqui, só com nome e cargo.
 */
export async function GET(request: Request) {
  const auth = await equipeDoSite(request);
  if (!auth) return NextResponse.json({ erro: "Só a equipe da MF usa esta área." }, { status: 403 });
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Sistema indisponível." }, { status: 503 });

  const empresa = new URL(request.url).searchParams.get("empresa") ?? "";
  if (!EMPRESAS.some((e) => e.nome === empresa)) return NextResponse.json({ vendedores: [] });

  const { data } = await sb
    .from("profiles")
    .select("id, nome, cargo")
    .eq("empresa", empresa)
    .eq("ativo", true)
    .is("excluido_em", null)
    .in("cargo", ["Vendedor", "Vendedor Interno", "SDR", "Gestor"])
    .order("nome");
  return NextResponse.json({ vendedores: data ?? [] });
}
