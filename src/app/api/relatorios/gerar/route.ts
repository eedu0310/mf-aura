import { NextResponse } from "next/server";
import { getEmpresaAutenticada, mandaNaLoja, vejoTodasAsLojas } from "@/lib/auth-empresa";
import { gerarRelatorioVendedor, gerarRelatorioLoja } from "@/lib/gerar-relatorio";
import { NOMES_EMPRESAS } from "@/lib/companies";
import { diaEmSaoPaulo, inicioDoMesEmSaoPaulo } from "@/lib/fuso";

export const runtime = "nodejs";

/**
 * Domingo 00:00 de Brasília. setDate/setHours usavam o relógio do servidor:
 * numa VPS em UTC a semana começava às 21h do sábado.
 */
function inicioDaSemana(): Date {
  const dia = diaEmSaoPaulo();
  const dow = new Date(`${dia}T12:00:00-03:00`).getUTCDay();
  const d = new Date(`${dia}T00:00:00-03:00`);
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

function inicioDoMes(): Date {
  return new Date(inicioDoMesEmSaoPaulo());
}

export async function POST(request: Request) {
  const auth = await getEmpresaAutenticada();
  if (!auth) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  // JSON inválido estourava antes do try e virava 500 sem mensagem.
  const corpo = await request.json().catch(() => null);
  if (!corpo || typeof corpo !== "object") {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }
  const { tipo, vendedorId, vendedorNome } = corpo as {
    tipo?: string;
    vendedorId?: string;
    vendedorNome?: string;
  };
  const agora = new Date();

  try {
    if (tipo === "semanal_vendedor") {
      const alvoId = vendedorId ?? auth.userId;
      let nome = vendedorNome;
      let empresaAlvo = auth.empresa;
      /*
       * Relatório de outra pessoa só para o gestor dela. Antes qualquer
       * vendedor mandava o id de um colega (até de outra loja) e gravava um
       * relatório no nome dele, rotulado com a loja de quem pediu.
       */
      if (alvoId !== auth.userId) {
        if (!mandaNaLoja(auth)) {
          return NextResponse.json({ erro: "Você só gera o seu próprio relatório." }, { status: 403 });
        }
        const { data: alvo } = await auth.supabase
          .from("profiles")
          .select("nome, empresa")
          .eq("id", alvoId)
          .maybeSingle();
        if (!alvo || (alvo.empresa !== auth.empresa && !vejoTodasAsLojas(auth))) {
          return NextResponse.json({ erro: "Esta pessoa não é da sua loja." }, { status: 403 });
        }
        empresaAlvo = alvo.empresa as string;
        nome = nome || (alvo.nome as string);
      }
      if (!nome) {
        const { data } = await auth.supabase.from("profiles").select("nome").eq("id", alvoId).single();
        nome = data?.nome ?? "Vendedor";
      }
      const resultado = await gerarRelatorioVendedor(
        auth.supabase,
        alvoId,
        nome ?? "Vendedor",
        empresaAlvo,
        inicioDaSemana(),
        agora
      );
      if (resultado.erro) return NextResponse.json({ erro: resultado.erro }, { status: 500 });
      return NextResponse.json({ conteudo: resultado.conteudo });
    }

    if (tipo === "semanal_gestor" || tipo === "mensal_diretor") {
      if (!mandaNaLoja(auth)) {
        return NextResponse.json({ erro: "Só o Gestor pode gerar esse relatório." }, { status: 403 });
      }
      const periodoInicio = tipo === "mensal_diretor" ? inicioDoMes() : inicioDaSemana();

      // Um relatório POR LOJA — nunca misturado. Cada loja tem sua
      // própria equipe e seus próprios números. Só o mestre gera as quatro:
      // o gestor de loja gerava também as outras três, com os números que a
      // RLS dele não deixa ver (zerados), e o relatório vazio ia para elas.
      const lojas = vejoTodasAsLojas(auth) ? NOMES_EMPRESAS : [auth.empresa];
      const resultadosPorLoja = await Promise.all(
        lojas.map(async (empresa) => ({
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
