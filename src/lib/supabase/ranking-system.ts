import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface VendedorStats {
  vendedorId: string;
  vendedorNome: string;
  empresa: string;
  pontos: number;
  pontosDetalhes: {
    clientesNovos: number;
    arquitetos: number;
    construtoras: number;
    obrasContato: number;
    vendasRealizadas: number;
    faturamento: number;
  };
  badges: string[];
}

export async function calcularPontuacaoVendedores(empresa?: string): Promise<VendedorStats[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  // Buscar vendedores.
  //
  // Faltava aqui o filtro de conta ativa que as outras telas tinham: este
  // ranking somava conta de teste e gente que ja saiu da empresa, e o
  // vendedor via a si mesmo em "7o de 11" disputando com fantasmas.
  let queryVendedores = supabase
    .from("profiles")
    .select("id, nome, empresa")
    .in("cargo", ["Vendedor", "Vendedor Interno"])
    .neq("ativo", false)
    .is("excluido_em", null);

  if (empresa) {
    queryVendedores = queryVendedores.eq("empresa", empresa);
  }

  const { data: vendedores } = await queryVendedores;

  const resultados: VendedorStats[] = [];

  for (const v of vendedores || []) {
    // Vendas
    const { data: vendas } = await supabase
      .from("vendas")
      .select("valor")
      .eq("owner_id", v.id);

    const faturamento = (vendas || []).reduce((s, venda) => s + (venda.valor || 0), 0);
    const vendasRealizadas = (vendas || []).length;

    // Relacionamentos (clientes, arquitetos, construtoras)
    const { data: relacionamentos } = await supabase
      .from("relacionamentos")
      .select("categoria")
      .eq("owner_id", v.id);

    const clientesNovos = (relacionamentos || []).filter(
      (r) => r.categoria === "Cliente Final"
    ).length;
    const arquitetos = (relacionamentos || []).filter(
      (r) => r.categoria === "Arquiteto"
    ).length;
    const construtoras = (relacionamentos || []).filter(
      (r) => r.categoria === "Construtora"
    ).length;

    // Atividades (obras com contato)
    const { data: atividades } = await supabase
      .from("atividades")
      .select("tipo")
      .eq("owner_id", v.id);

    const obrasContato = (atividades || []).filter(
      (a) => a.tipo === "Obra com contato"
    ).length;

    // Calcular pontos
    const pontos =
      clientesNovos * 1 +
      arquitetos * 3 +
      construtoras * 4 +
      obrasContato * 5 +
      vendasRealizadas * 3 +
      Math.floor(faturamento / 1000); // 1 ponto por R$1000

    // Badges
    const badges: string[] = [];
    if (vendasRealizadas >= 5) badges.push("🔥 Fogo Constante");
    if (arquitetos >= 3) badges.push("🏛️ Rei Arquitetos");
    if (faturamento >= 50000) badges.push("💰 Milionário");
    if (clientesNovos >= 5) badges.push("🎯 Caçador");

    resultados.push({
      vendedorId: v.id,
      vendedorNome: v.nome,
      empresa: v.empresa,
      pontos,
      pontosDetalhes: {
        clientesNovos: clientesNovos * 1,
        arquitetos: arquitetos * 3,
        construtoras: construtoras * 4,
        obrasContato: obrasContato * 5,
        vendasRealizadas: vendasRealizadas * 3,
        faturamento: Math.floor(faturamento / 1000),
      },
      badges,
    });
  }

  // Ordenar por pontos
  return resultados.sort((a, b) => b.pontos - a.pontos);
}
