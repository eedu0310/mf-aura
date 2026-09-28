import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { calcularNota, carregarConfigRanking, type Insumos } from "@/lib/ranking/nota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ranking do grupo — nota de 0 a 10, com os critérios que o gestor definiu.
 *
 * O que NÃO sai daqui é carteira: nenhum nome de cliente, nenhum negócio
 * individual. Só nome, loja, nota e o quanto cada um fez em cada critério.
 *
 * A MF é fábrica e vende para revendedor, não para cliente final — disputar
 * com as lojas distorce os dois lados. Ela fica de fora por padrão, e o
 * gestor liga pela tela quando quiser.
 */

const MF = "MF International";

export async function GET(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Usuário não autenticado." }, { status: 401 });

  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const dias = Number(searchParams.get("dias") ?? 0);
  const agora = new Date();
  const desde =
    dias > 0
      ? new Date(agora.getTime() - dias * 86400_000)
      : new Date(agora.getFullYear(), agora.getMonth(), 1);
  const desdeIso = desde.toISOString();
  const desdeDia = desdeIso.slice(0, 10);

  const cfg = await carregarConfigRanking();
  const bonusMinimo = Number(cfg?.config?.bonus_crm_minimo ?? 80);
  const mfEntra = Boolean(cfg?.config?.mf_no_ranking_do_grupo);
  const criterios = cfg?.criterios ?? [];

  const [
    { data: pessoas, error: erroPessoas },
    { data: vendas },
    { data: vendasAnteriores },
    { data: relacionamentos },
    { data: atividades },
    { data: avaliacoes },
    { data: oportunidades },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,nome,empresa")
      .in("cargo", ["Vendedor", "Vendedor Interno"])
      .eq("ativo", true),
    supabase
      .from("vendas")
      .select("owner_id,valor_fechado,valor,relacionamento_id")
      .gte("data", desdeDia),
    supabase.from("vendas").select("relacionamento_id").lt("data", desdeDia),
    supabase
      .from("relacionamentos")
      .select("id,owner_id,categoria,proximo_contato_em,ultimo_contato_em,created_at")
      .limit(5000),
    supabase.from("atividades").select("owner_id").gte("created_at", desdeIso),
    supabase
      .from("pedidos_avaliacao")
      .select("vendedor_id,aberto_em,confirmado_em")
      .gte("criado_em", desdeIso),
    supabase.from("oportunidades").select("owner_id,relacionamento_id,etapa"),
  ]);

  if (erroPessoas) {
    return NextResponse.json({ erro: "Não consegui carregar o ranking." }, { status: 500 });
  }

  // O gestor da MF sempre vê a própria equipe; quem é de loja só vê a MF
  // quando a chave está ligada.
  const souDaMF = auth.empresa === MF;
  const time = (pessoas ?? [])
    .filter((p) => mfEntra || souDaMF || p.empresa !== MF)
    .map((p) => ({
      id: p.id,
      nome: p.nome ?? "Sem nome",
      loja: p.empresa ?? "Sem loja",
    }));

  const insumos: Insumos = {
    vendas: (vendas ?? []) as Insumos["vendas"],
    vendasAnteriores: (vendasAnteriores ?? []) as Insumos["vendasAnteriores"],
    relacionamentos: (relacionamentos ?? []) as Insumos["relacionamentos"],
    atividades: (atividades ?? []) as Insumos["atividades"],
    avaliacoes: (avaliacoes ?? []) as Insumos["avaliacoes"],
    oportunidades: (oportunidades ?? []) as Insumos["oportunidades"],
  };

  const notas = time
    .map((p) => calcularNota(p, criterios, insumos, desdeIso, bonusMinimo))
    .sort((a, b) => b.nota - a.nota || a.nome.localeCompare(b.nome, "pt-BR"))
    .map((n, i) => ({ ...n, posicao: i + 1 }));

  // Uma disputa por critério, para quem quiser ver o detalhe de cada frente.
  const rankings = criterios
    .filter((c) => c.ativo)
    .map((c) => ({
      id: c.id,
      titulo: c.titulo,
      descricao: c.descricao ?? "",
      unidade: c.medida === "faturamento" ? ("moeda" as const) : ("quantidade" as const),
      linhas: notas
        .map((n) => {
          const parcela = n.parcelas.find((p) => p.criterioId === c.id);
          return { id: n.vendedorId, nome: n.nome, loja: n.loja, valor: parcela?.feito ?? 0 };
        })
        .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, "pt-BR"))
        .map((l, i) => ({ ...l, posicao: i + 1 })),
    }));

  // Formato antigo, que as telas atuais ainda consomem.
  const ranking = notas.map((n) => ({
    id: n.vendedorId,
    nome: n.nome,
    empresa: n.loja,
    posicao: n.posicao,
    pontos: n.nota,
    nota: n.nota,
    crmEmDia: n.crmEmDia,
    bonus: n.bonus,
    faturamento: insumos.vendas
      .filter((v) => v.owner_id === n.vendedorId)
      .reduce((s, v) => s + Number(v.valor_fechado ?? v.valor ?? 0), 0),
    vendas: insumos.vendas.filter((v) => v.owner_id === n.vendedorId).length,
    atividades: insumos.atividades.filter((a) => a.owner_id === n.vendedorId).length,
    relacionamentos: insumos.relacionamentos.filter((r) => r.owner_id === n.vendedorId).length,
  }));

  return NextResponse.json({
    ranking,
    notas,
    rankings,
    criterios,
    eu: auth.userId,
    periodo: dias > 0 ? `Últimos ${dias} dias` : "Este mês",
    bonus: {
      crmMinimo: bonusMinimo,
      descricao: cfg?.config?.bonus_descricao ?? "Bônus mensal da equipe",
    },
    mfNoRanking: mfEntra,
  });
}
