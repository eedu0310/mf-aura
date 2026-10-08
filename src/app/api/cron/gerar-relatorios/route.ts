import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { gerarRelatorioLoja } from "@/lib/gerar-relatorio";
import { gerarRelatorioSemanalDaLoja } from "@/lib/relatorio-semanal/gerar";
import { NOMES_EMPRESAS } from "@/lib/companies";

export const runtime = "nodejs";
export const maxDuration = 300;

const TZ = "America/Sao_Paulo";

/** O dia de hoje no fuso de Brasília, como AAAA-MM-DD. */
function diaBR(quando = new Date()): string {
  return quando.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** 0 = domingo, 6 = sábado, no fuso de Brasília e não no do servidor. */
function diaDaSemanaBR(quando = new Date()): number {
  return new Date(`${diaBR(quando)}T12:00:00-03:00`).getUTCDay();
}

/**
 * A semana que está terminando: segunda 00:00 até domingo 00:00 de Brasília.
 *
 * O fim é exclusivo e cai no domingo DE PROPÓSITO. O relatório roda sábado à
 * tarde, e se a janela fechasse à meia-noite de sábado, tudo o que a loja
 * vendeu no próprio sábado — dia cheio no varejo — ficaria fora do relatório
 * que fala justamente dessa semana.
 */
function semanaQueTermina(quando = new Date()): { inicio: Date; fim: Date } {
  const dow = diaDaSemanaBR(quando);
  const recuoAteSegunda = dow === 0 ? 6 : dow - 1;

  const hoje = new Date(`${diaBR(quando)}T00:00:00-03:00`);
  const inicio = new Date(hoje);
  inicio.setUTCDate(inicio.getUTCDate() - recuoAteSegunda);

  const domingo = new Date(inicio);
  domingo.setUTCDate(domingo.getUTCDate() + 7);

  /**
   * O fim não passa do fim de HOJE. Rodando no sábado, a semana "segunda a
   * domingo" incluiria um domingo que ainda não aconteceu, e o relatório
   * sairia rotulado "05/10 a 11/10" num dia 10 — prometendo um dia de dado
   * que não existe. Então a janela fecha na virada de hoje para amanhã.
   */
  const amanha = new Date(hoje);
  amanha.setUTCDate(amanha.getUTCDate() + 1);

  return { inicio, fim: amanha < domingo ? amanha : domingo };
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
  /**
   * Sábado, pelo calendário de Brasília. Usar o getDay() do servidor daria
   * sexta ou domingo dependendo do fuso em que a VPS estiver.
   */
  const ehSabado = diaDaSemanaBR(hoje) === 6;
  const ehPrimeiroDiaDoMes = Number(diaBR(hoje).slice(8, 10)) === 1;
  /** Para chamar na mão fora de sábado: ?forcar=semanal */
  const forcar = new URL(request.url).searchParams.get("forcar");

  let gerados = 0;
  /**
   * Falhas ficam na resposta, não só no console. Um cron que responde
   * {ok: true, gerados: 0} é indistinguível de um domingo sem vendedor
   * ativo: ninguém recebe relatório e ninguém descobre por quê.
   */
  const falhas: string[] = [];

  const avisos: string[] = [];

  if (ehSabado || forcar === "semanal") {
    const { inicio, fim } = semanaQueTermina(hoje);

    /**
     * Uma loja por vez. O gerador já avalia os vendedores dela em paralelo,
     * de três em três; soltar as quatro lojas juntas seria doze chamadas de
     * IA simultâneas, e a primeira recusa por limite de taxa derrubaria o
     * relatório de todo mundo.
     */
    for (const empresa of NOMES_EMPRESAS) {
      try {
        const { relatorio, avisos: avisosDaLoja } = await gerarRelatorioSemanalDaLoja(
          supabase,
          empresa,
          inicio,
          fim,
        );
        gerados++;
        avisos.push(...avisosDaLoja);
        console.log(
          `Relatório semanal de ${empresa}: ${relatorio.vendedores.length} pessoas, ` +
            `${relatorio.periodoInicio} a ${relatorio.periodoFim}`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "erro desconhecido";
        console.error(`Cron de relatórios: ${empresa} falhou:`, err);
        falhas.push(`${empresa}: ${msg}`);
      }
    }
  }

  if (ehPrimeiroDiaDoMes) {
    const { inicio, fim } = inicioDoMesPassado();
    for (const empresa of NOMES_EMPRESAS) {
      const relatorioMensal = await gerarRelatorioLoja(supabase, empresa, inicio, fim, "mensal_diretor");
      if (relatorioMensal.conteudo) gerados++;
    }
  }

  return NextResponse.json({
    ok: falhas.length === 0,
    gerados,
    ehSabado,
    ehPrimeiroDiaDoMes,
    ...(avisos.length ? { avisos } : {}),
    ...(falhas.length ? { falhas } : {}),
  });
}
