import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Usuário não autenticado." }, { status: 401 });

  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ erro: "Supabase não configurado." }, { status: 500 });

  const [{ data: vendedores, error: vendedoresError }, { data: vendas }, { data: atividades }, { data: relacionamentos }] = await Promise.all([
    supabase.from("profiles").select("id,nome,empresa").in("cargo", ["Vendedor", "Vendedor Interno"]).eq("ativo", true),
    supabase.from("vendas").select("owner_id,valor_fechado,valor,empresa"),
    supabase.from("atividades").select("owner_id,tipo,subtipo,empresa"),
    supabase.from("relacionamentos").select("owner_id,id,empresa"),
  ]);
  if (vendedoresError) return NextResponse.json({ erro: "Não foi possível carregar o ranking." }, { status: 500 });

  const ranking = (vendedores ?? []).map((v) => {
    const minhasVendas = (vendas ?? []).filter((item) => item.owner_id === v.id);
    const minhasAtividades = (atividades ?? []).filter((item) => item.owner_id === v.id);
    const meusRelacionamentos = (relacionamentos ?? []).filter((item) => item.owner_id === v.id);
    const faturamento = minhasVendas.reduce((s, item) => s + Number(item.valor_fechado ?? item.valor ?? 0), 0);
    const pontos = minhasVendas.length * 100 + minhasAtividades.length * 10 + meusRelacionamentos.length * 2;
    return { id: v.id, nome: v.nome, empresa: v.empresa, faturamento, vendas: minhasVendas.length, atividades: minhasAtividades.length, relacionamentos: meusRelacionamentos.length, pontos };
  }).sort((a, b) => b.pontos - a.pontos || b.faturamento - a.faturamento);

  return NextResponse.json({ ranking: ranking.map((item, index) => ({ ...item, posicao: index + 1 })) });
}
