import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { gerarRelatorioVendedor, gerarRelatorioLoja } from "@/lib/gerar-relatorio";
import { NOMES_EMPRESAS } from "@/lib/companies";
import { CARGOS_QUE_VENDEM } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

function inicioDaSemanaPassada(): { inicio: Date; fim: Date } {
  const hoje = new Date();
  const fim = new Date(hoje);
  fim.setHours(0, 0, 0, 0);
  const inicio = new Date(fim);
  inicio.setDate(inicio.getDate() - 7);
  return { inicio, fim };
}

function inicioDoMesPassado(): { inicio: Date; fim: Date } {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return { inicio, fim };
}

export async function GET(request: Request) {
  const segredoEsperado = process.env.CRON_SECRET;
  const cabecalhoAutorizacao = request.headers.get("authorization");
  if (segredoEsperado && cabecalhoAutorizacao !== `Bearer ${segredoEsperado}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) return NextResponse.json({ erro: "Supabase não configurado." }, { status: 500 });

  const hoje = new Date();
  const ehDomingo = hoje.getDay() === 0;
  const ehPrimeiroDiaDoMes = hoje.getDate() === 1;

  let gerados = 0;

  if (ehDomingo) {
    const { inicio, fim } = inicioDaSemanaPassada();

    for (const empresa of NOMES_EMPRESAS) {
      const { data: vendedores } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("empresa", empresa)
        .in("cargo", CARGOS_QUE_VENDEM)
        .eq("ativo", true);

      for (const v of vendedores ?? []) {
        const resultado = await gerarRelatorioVendedor(supabase, v.id, v.nome as string, empresa, inicio, fim);
        if (resultado.conteudo) gerados++;
      }

      const relatorioLoja = await gerarRelatorioLoja(supabase, empresa, inicio, fim, "semanal_gestor");
      if (relatorioLoja.conteudo) gerados++;
    }
  }

  if (ehPrimeiroDiaDoMes) {
    const { inicio, fim } = inicioDoMesPassado();
    for (const empresa of NOMES_EMPRESAS) {
      const relatorioMensal = await gerarRelatorioLoja(supabase, empresa, inicio, fim, "mensal_diretor");
      if (relatorioMensal.conteudo) gerados++;
    }
  }

  return NextResponse.json({ ok: true, gerados, ehDomingo, ehPrimeiroDiaDoMes });
}
