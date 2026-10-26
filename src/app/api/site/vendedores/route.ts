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

  const url = new URL(request.url);
  const empresa = url.searchParams.get("empresa") ?? "";
  // ?todos=1: qualquer cargo (para cliente/parceiro, que pode ir ao pós-venda).
  const todos = url.searchParams.get("todos") === "1";
  if (!EMPRESAS.some((e) => e.nome === empresa)) return NextResponse.json({ vendedores: [] });

  let q = sb.from("profiles").select("id, nome, cargo").eq("empresa", empresa).eq("ativo", true).is("excluido_em", null);
  if (!todos) q = q.in("cargo", ["Vendedor", "Vendedor Interno", "SDR", "Gestor"]);
  const { data } = await q.order("nome");
  return NextResponse.json({ vendedores: data ?? [] });
}
