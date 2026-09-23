import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Usuário não autenticado." }, { status: 401 });

  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ erro: "Supabase não configurado." }, { status: 500 });

  // Esta rota usa a chave de serviço (ignora as regras do banco), então o
  // recorte por loja precisa ser feito aqui: vendedor vê só a própria loja,
  // o gestor vê todas.
  const vejoTudo = auth.cargo === "Gestor";
  const loja = auth.empresa;

  interface LinhaVendedor { id: string; nome: string | null; empresa: string | null }
  interface LinhaVenda { owner_id: string | null; valor_fechado: number | null; valor: number | null }
  interface LinhaDona { owner_id: string | null }

  const qVendedores = supabase
    .from("profiles")
    .select("id,nome,empresa")
    .in("cargo", ["Vendedor", "Vendedor Interno"])
    .eq("ativo", true);
  const qVendas = supabase.from("vendas").select("owner_id,valor_fechado,valor,empresa");
  const qAtividades = supabase.from("atividades").select("owner_id,tipo,subtipo,empresa");
  const qRelacionamentos = supabase.from("relacionamentos").select("owner_id,id,empresa");

  const [{ data: vendedores, error: vendedoresError }, { data: vendas }, { data: atividades }, { data: relacionamentos }] =
    await Promise.all([
      (vejoTudo ? qVendedores : qVendedores.eq("empresa", loja)).returns<LinhaVendedor[]>(),
      (vejoTudo ? qVendas : qVendas.eq("empresa", loja)).returns<LinhaVenda[]>(),
      (vejoTudo ? qAtividades : qAtividades.eq("empresa", loja)).returns<LinhaDona[]>(),
      (vejoTudo ? qRelacionamentos : qRelacionamentos.eq("empresa", loja)).returns<LinhaDona[]>(),
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
