/**
 * GET /api/meu-dia/por-origem[?mes=YYYY-MM][&loja=...]
 *
 * Leads, vendas e faturamento separados por origem — loja, MF, marketing,
 * prospecção própria, indicação.
 *
 * Lê a view retorno_por_origem, que é a mesma base do painel do gestor e do
 * relatório do marketing. De propósito: três telas lendo a mesma conta não
 * divergem. Se cada uma somasse por conta, um dia o número do vendedor não
 * bateria com o do gestor e ninguém saberia qual acreditar.
 *
 * Não escreve nada na planilha de indicadores que a equipe digita à mão. São
 * dois escritores na mesma linha e o automático apagaria o que a pessoa
 * digitou. Este painel mostra o que os registros dizem; a planilha segue sendo
 * dela.
 */
import { NextRequest, NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  const { data: eu } = await sb
    .from("profiles")
    .select("cargo, empresa, gestor_mestre, gestor_aprovado")
    .eq("id", auth.userId)
    .maybeSingle();

  /**
   * Gestor aprovado, não só quem escolheu o cargo "Gestor" na tela de cadastro.
   *
   * A conta nasce com o cargo e espera aprovação de um gestor mestre; conferir
   * só o cargo deixava quem acabou de se cadastrar entrar aqui antes de alguém
   * aprovar. O mestre passa por cima, como em todo lugar.
   */
  const gestor =
    !!eu &&
    ((/gestor/i.test(eu.cargo ?? "") && eu.gestor_aprovado === true) || !!eu.gestor_mestre);

  const mes = req.nextUrl.searchParams.get("mes") || new Date().toISOString().slice(0, 7);

  let q = sb.from("retorno_por_origem").select("*").eq("mes", mes);

  if (gestor) {
    // O gestor vê a loja inteira; o mestre pode pedir outra loja.
    const pedida = req.nextUrl.searchParams.get("loja");
    const loja = eu!.gestor_mestre && pedida ? pedida : eu!.empresa;
    q = q.eq("empresa", loja);
  } else {
    // O vendedor vê só o que é dele. Filtro explícito, não só a RLS: esta rota
    // usa o cliente de serviço, que passa por cima da RLS.
    q = q.eq("owner_id", auth.userId);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const linhas = data ?? [];

  // Junta por origem: a view tem o grão vendedor+campanha, e aqui o que
  // interessa é o retrato por origem.
  const porOrigem = new Map<
    string,
    { origem: string; leads: number; vendas: number; faturamento: number; perdidas: number }
  >();

  for (const l of linhas) {
    const k = (l.origem_lead as string) ?? "sem";
    const atual =
      porOrigem.get(k) ?? { origem: k, leads: 0, vendas: 0, faturamento: 0, perdidas: 0 };
    atual.leads += Number(l.leads ?? 0);
    atual.vendas += Number(l.vendas ?? 0);
    atual.faturamento += Number(l.faturamento ?? 0);
    atual.perdidas += Number(l.perdidas ?? 0);
    porOrigem.set(k, atual);
  }

  const lista = [...porOrigem.values()]
    .map((o) => ({
      ...o,
      // Mesma regra do resto do sistema: conversão sobre o que foi decidido.
      conversao: o.vendas + o.perdidas > 0
        ? Math.round((o.vendas / (o.vendas + o.perdidas)) * 100)
        : null,
    }))
    .sort((a, b) => b.faturamento - a.faturamento || b.leads - a.leads);

  return NextResponse.json({
    mes,
    gestor,
    origens: lista,
    totais: {
      leads: lista.reduce((s, o) => s + o.leads, 0),
      vendas: lista.reduce((s, o) => s + o.vendas, 0),
      faturamento: lista.reduce((s, o) => s + o.faturamento, 0),
      perdidas: lista.reduce((s, o) => s + o.perdidas, 0),
    },
    // Campanhas detalhadas só interessam ao gestor/marketing.
    campanhas: gestor
      ? linhas
          .filter((l) => l.campanha_id)
          .map((l) => ({
            campanha: l.campanha as string,
            investido: Number(l.investido ?? 0),
            faturamento: Number(l.faturamento ?? 0),
            leads: Number(l.leads ?? 0),
            vendas: Number(l.vendas ?? 0),
            retorno: l.retorno_sobre_investido,
          }))
      : [],
  });
}
