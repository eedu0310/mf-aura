import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { gerarRelatorioLoja } from "@/lib/gerar-relatorio";
import { gerarRelatorioSemanalDaLoja } from "@/lib/relatorio-semanal/gerar";
import { NOMES_EMPRESAS } from "@/lib/companies";
import { rodarCron } from "@/lib/cron/execucao";

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
  return rodarCron(request, "gerar-relatorios", () => gerar(request));
}

async function gerar(request: Request): Promise<Record<string, unknown>> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase não configurado.");

  const hoje = new Date();
  /**
   * Sábado, pelo calendário de Brasília. Usar o getDay() do servidor daria
   * sexta ou domingo dependendo do fuso em que a VPS estiver.
   */
  const ehSabado = diaDaSemanaBR(hoje) === 6;
  const ehPrimeiroDiaDoMes = Number(diaBR(hoje).slice(8, 10)) === 1;
  /** Para chamar na mão fora de sábado: ?forcar=semanal (ou ?forcar=mensal) */
  const forcar = new URL(request.url).searchParams.get("forcar");

  let gerados = 0;
  /**
   * Falhas ficam na resposta, não só no console. Um cron que responde
   * {ok: true, gerados: 0} é indistinguível de um domingo sem vendedor
   * ativo: ninguém recebe relatório e ninguém descobre por quê.
   */
  const falhas: string[] = [];

  const avisos: string[] = [];
  /** Lojas cujo relatório do período já existia e não foi refeito. */
  const pulados: string[] = [];

  /**
   * Já existe relatório desta loja para este período? Quando o dia 1 cai num
   * sábado, o cron roda às 08h (linha do mensal) e às 16h (linha do semanal),
   * e as duas execuções geravam tudo de novo: o mensal saía duplicado na tela
   * e o semanal gastava duas rodadas de IA. ?forcar= refaz de propósito.
   */
  async function jaExiste(empresa: string, tipo: string, periodoInicio: string, periodoFim: string) {
    const { data, error } = await supabase!
      .from("relatorios_periodicos")
      .select("id")
      .eq("empresa", empresa)
      .eq("tipo", tipo)
      .eq("periodo_inicio", periodoInicio)
      .eq("periodo_fim", periodoFim)
      .is("vendedor_id", null)
      .limit(1);
    // Na dúvida, gera: relatório repetido é menos grave que relatório faltando.
    if (error) return false;
    return (data ?? []).length > 0;
  }

  /*
   * O semanal é o das 16h. No dia 1 que cai num sábado, a execução das 08h
   * vem pela linha do mensal: um semanal feito de manhã deixaria de fora as
   * vendas do próprio sábado e, já existindo, ainda barraria o das 16h.
   */
  const horaBR = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(hoje),
  );
  const semanalDeVerdade = ehSabado && !(ehPrimeiroDiaDoMes && horaBR < 12);

  if (semanalDeVerdade || forcar === "semanal") {
    const { inicio, fim } = semanaQueTermina(hoje);
    // Os mesmos rótulos que coletarSemanaDaLoja grava (fim exclusivo → último dia coberto).
    const periodoInicio = inicio.toISOString().slice(0, 10);
    const periodoFim = new Date(fim.getTime() - 86_400_000).toISOString().slice(0, 10);

    /**
     * Uma loja por vez. O gerador já avalia os vendedores dela em paralelo,
     * de três em três; soltar as quatro lojas juntas seria doze chamadas de
     * IA simultâneas, e a primeira recusa por limite de taxa derrubaria o
     * relatório de todo mundo.
     */
    for (const empresa of NOMES_EMPRESAS) {
      if (forcar !== "semanal" && (await jaExiste(empresa, "semanal_gestor", periodoInicio, periodoFim))) {
        pulados.push(`${empresa}: semanal ${periodoInicio} a ${periodoFim} já existia`);
        continue;
      }
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

  /*
   * O mensal só saía se o dia 1 caísse num sábado: a linha do cron era só
   * "sábado 16h". Agora há uma linha própria no dia 1 (deploy/aura-crons) e
   * ?forcar=mensal para gerar na mão.
   */
  if (ehPrimeiroDiaDoMes || forcar === "mensal") {
    const { inicio, fim } = inicioDoMesPassado();
    const periodoInicio = inicio.toISOString().slice(0, 10);
    const periodoFim = fim.toISOString().slice(0, 10);
    /*
     * Uma loja que falha não derruba as outras. Antes o laço não tinha
     * try/catch: uma exceção na primeira loja deixava as outras três sem o
     * mensal, e o {erro} devolvido pelo gerador era ignorado em silêncio.
     */
    for (const empresa of NOMES_EMPRESAS) {
      if (forcar !== "mensal" && (await jaExiste(empresa, "mensal_diretor", periodoInicio, periodoFim))) {
        pulados.push(`${empresa}: mensal ${periodoInicio} já existia`);
        continue;
      }
      try {
        const relatorioMensal = await gerarRelatorioLoja(supabase, empresa, inicio, fim, "mensal_diretor");
        if (relatorioMensal.conteudo) gerados++;
        else falhas.push(`${empresa} (mensal): ${relatorioMensal.erro}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "erro desconhecido";
        console.error(`Cron de relatórios: mensal de ${empresa} falhou:`, err);
        falhas.push(`${empresa} (mensal): ${msg}`);
      }
    }
  }

  return {
    ok: falhas.length === 0,
    gerados,
    ehSabado,
    ehPrimeiroDiaDoMes,
    ...(avisos.length ? { avisos } : {}),
    ...(pulados.length ? { pulados } : {}),
    ...(falhas.length ? { falhas } : {}),
  };
}
