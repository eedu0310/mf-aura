import { NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { gerarRelatorioVendedor, gerarRelatorioLoja } from "@/lib/gerar-relatorio";
import { NOMES_EMPRESAS } from "@/lib/companies";

export const runtime = "nodejs";

function inicioDaSemana(): Date {
  const hoje = new Date();
  const d = new Date(hoje);
  d.setDate(hoje.getDate() - hoje.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function inicioDoMes(): Date {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
}

export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { tipo, vendedorId, vendedorNome } = await request.json();
  const agora = new Date();

  try {
    if (tipo === "semanal_vendedor") {
      const alvoId = vendedorId ?? auth.userId;
      let nome = vendedorNome;
      if (!nome) {
        const { data } = await auth.supabase.from("profiles").select("nome").eq("id", alvoId).single();
        nome = data?.nome ?? "Vendedor";
      }
      const resultado = await gerarRelatorioVendedor(
        auth.supabase,
        alvoId,
        nome,
        auth.empresa,
        inicioDaSemana(),
        agora
      );
      if (resultado.erro) return NextResponse.json({ erro: resultado.erro }, { status: 500 });
      return NextResponse.json({ conteudo: resultado.conteudo });
    }

    if (tipo === "semanal_gestor" || tipo === "mensal_diretor") {
      if (!["Gestor"].includes(auth.cargo)) {
        return NextResponse.json({ erro: "Só o Gestor pode gerar esse relatório." }, { status: 403 });
      }
      const periodoInicio = tipo === "mensal_diretor" ? inicioDoMes() : inicioDaSemana();

      // Um relatório POR LOJA — nunca misturado. Cada loja tem sua
      // própria equipe e seus próprios números.
      const resultadosPorLoja = await Promise.all(
        NOMES_EMPRESAS.map(async (empresa) => ({
          empresa,
          resultado: await gerarRelatorioLoja(auth.supabase, empresa, periodoInicio, agora, tipo),
        }))
      );

      const gerados = resultadosPorLoja.filter((r) => r.resultado.conteudo);
      const semDados = resultadosPorLoja.filter((r) => !r.resultado.conteudo);

      if (gerados.length === 0) {
        return NextResponse.json(
          {
            erro: `Nenhuma loja gerou relatório. Detalhes: ${semDados
              .map((r) => `${r.empresa}: ${r.resultado.erro}`)
              .join(" | ")}`,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        geradas: gerados.map((r) => r.empresa),
        semDados: semDados.map((r) => r.empresa),
      });
    }

    return NextResponse.json({ erro: "Tipo de relatório inválido." }, { status: 400 });
  } catch (err) {
    console.error("Erro ao gerar relatório:", err);
    const detalhe = err instanceof Error ? err.message : "Erro interno desconhecido.";
    return NextResponse.json({ erro: `Não consegui gerar o relatório agora: ${detalhe}` }, { status: 500 });
  }
}
