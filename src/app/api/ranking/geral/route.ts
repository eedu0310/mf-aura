import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ranking do grupo — todos os vendedores, de todas as lojas, na mesma lista.
 *
 * É de propósito que um vendedor da LF veja um da MF: a disputa é geral. O
 * que NÃO sai daqui é carteira: nenhum nome de cliente e nenhum negócio
 * individual. Só nome, loja, posição e o número de cada disputa.
 */

/** As disputas, e o que conta em cada uma. */
const PROSPECCOES = [
  { id: "arquiteto", titulo: "Prospecção de arquitetos", categorias: ["Arquiteto"] },
  { id: "consultor", titulo: "Prospecção de consultores", categorias: ["Consultor"] },
  { id: "obra", titulo: "Prospecção de obras", categorias: ["Obra", "Construtora"] },
  { id: "clientes", titulo: "Prospecção de clientes novos", categorias: ["Cliente Final", "Cliente"] },
] as const;

interface LinhaRanking {
  id: string;
  nome: string;
  loja: string;
  valor: number;
  posicao: number;
}

export async function GET(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Usuário não autenticado." }, { status: 401 });

  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  // Período: mês atual por padrão; "dias=90" olha os últimos 90 dias.
  const { searchParams } = new URL(request.url);
  const dias = Number(searchParams.get("dias") ?? 0);
  const agora = new Date();
  const desde =
    dias > 0
      ? new Date(agora.getTime() - dias * 86400_000)
      : new Date(agora.getFullYear(), agora.getMonth(), 1);
  const desdeIso = desde.toISOString();

  interface P { id: string; nome: string | null; empresa: string | null }
  interface V { owner_id: string | null; valor_fechado: number | null; valor: number | null }
  interface R { owner_id: string | null; categoria: string | null }
  interface A { owner_id: string | null }

  const [{ data: pessoas, error: erroPessoas }, { data: vendas }, { data: relacionamentos }, { data: atividades }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id,nome,empresa")
        .in("cargo", ["Vendedor", "Vendedor Interno"])
        .eq("ativo", true)
        .returns<P[]>(),
      supabase.from("vendas").select("owner_id,valor_fechado,valor").gte("data", desdeIso.slice(0, 10)).returns<V[]>(),
      supabase.from("relacionamentos").select("owner_id,categoria").gte("created_at", desdeIso).returns<R[]>(),
      supabase.from("atividades").select("owner_id").gte("created_at", desdeIso).returns<A[]>(),
    ]);

  if (erroPessoas) {
    return NextResponse.json({ erro: "Não consegui carregar o ranking." }, { status: 500 });
  }

  const time = (pessoas ?? []).map((p) => ({
    id: p.id,
    nome: p.nome ?? "Sem nome",
    loja: p.empresa ?? "Sem loja",
  }));

  /** Ordena e numera, deixando quem tem zero no fim, mas ainda na lista. */
  function classificar(valorPorPessoa: Map<string, number>): LinhaRanking[] {
    return time
      .map((p) => ({ ...p, valor: valorPorPessoa.get(p.id) ?? 0 }))
      .sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome, "pt-BR"))
      .map((linha, i) => ({ ...linha, posicao: i + 1 }));
  }

  const faturamentoPorPessoa = new Map<string, number>();
  for (const v of vendas ?? []) {
    if (!v.owner_id) continue;
    const valor = Number(v.valor_fechado ?? v.valor ?? 0);
    faturamentoPorPessoa.set(v.owner_id, (faturamentoPorPessoa.get(v.owner_id) ?? 0) + valor);
  }

  const rankings = [
    {
      id: "faturamento",
      titulo: "Faturamento",
      descricao: "Soma das vendas fechadas no período",
      unidade: "moeda" as const,
      linhas: classificar(faturamentoPorPessoa),
    },
    ...PROSPECCOES.map((disputa) => {
      const contagem = new Map<string, number>();
      for (const r of relacionamentos ?? []) {
        if (!r.owner_id || !r.categoria) continue;
        if (!(disputa.categorias as readonly string[]).includes(r.categoria)) continue;
        contagem.set(r.owner_id, (contagem.get(r.owner_id) ?? 0) + 1);
      }
      return {
        id: disputa.id,
        titulo: disputa.titulo,
        descricao: "Contatos novos cadastrados no período",
        unidade: "quantidade" as const,
        linhas: classificar(contagem),
      };
    }),
  ];

  // Mantém o formato antigo, que as telas atuais já consomem.
  const atividadesPorPessoa = new Map<string, number>();
  for (const a of atividades ?? []) {
    if (!a.owner_id) continue;
    atividadesPorPessoa.set(a.owner_id, (atividadesPorPessoa.get(a.owner_id) ?? 0) + 1);
  }
  const relacionamentosPorPessoa = new Map<string, number>();
  for (const r of relacionamentos ?? []) {
    if (!r.owner_id) continue;
    relacionamentosPorPessoa.set(r.owner_id, (relacionamentosPorPessoa.get(r.owner_id) ?? 0) + 1);
  }
  const vendasPorPessoa = new Map<string, number>();
  for (const v of vendas ?? []) {
    if (!v.owner_id) continue;
    vendasPorPessoa.set(v.owner_id, (vendasPorPessoa.get(v.owner_id) ?? 0) + 1);
  }

  const ranking = time
    .map((p) => {
      const faturamento = faturamentoPorPessoa.get(p.id) ?? 0;
      const qtdVendas = vendasPorPessoa.get(p.id) ?? 0;
      const qtdAtividades = atividadesPorPessoa.get(p.id) ?? 0;
      const qtdRelacionamentos = relacionamentosPorPessoa.get(p.id) ?? 0;
      return {
        id: p.id,
        nome: p.nome,
        empresa: p.loja,
        faturamento,
        vendas: qtdVendas,
        atividades: qtdAtividades,
        relacionamentos: qtdRelacionamentos,
        pontos: qtdVendas * 100 + qtdAtividades * 10 + qtdRelacionamentos * 2,
      };
    })
    .sort((a, b) => b.pontos - a.pontos || b.faturamento - a.faturamento)
    .map((item, i) => ({ ...item, posicao: i + 1 }));

  return NextResponse.json({
    ranking,
    eu: auth.userId,
    periodo: dias > 0 ? `Últimos ${dias} dias` : "Este mês",
    rankings,
  });
}
