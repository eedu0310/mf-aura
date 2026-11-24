import { administra, vejoTodasAsLojas } from "@/lib/auth-empresa";
import { rodarCron } from "@/lib/cron/execucao";
import { inicioDoDiaEmSaoPaulo } from "@/lib/fuso";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { CARGOS_QUE_VENDEM } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const TZ = "America/Sao_Paulo";

/**
 * Cobrança da meta do mês.
 *
 * Até aqui o ciclo mensal dependia só de um banner no Meu Dia — e esse banner
 * ficava escondido do dia 1 ao dia 4. Quem não abrisse a tela não sabia que
 * devia meta, e o gestor só descobria olhando a lista. Resultado real: o mês
 * de outubro virou sem uma única meta aprovada em nenhuma das quatro lojas.
 *
 * Então aqui a cobrança sai como notificação, do dia 1 ao dia 7, uma vez por
 * dia enquanto a meta não existir, e para de sair no instante em que o
 * vendedor manda. O gestor também é avisado, com a lista de quem está devendo.
 */
const PRIMEIRO_DIA = 1;
const ULTIMO_DIA = 7;
const TITULO_VENDEDOR = "Mande sua meta do mês";
const TITULO_GESTOR = "Metas do mês em falta";

function hojeBR(quando = new Date()) {
  const dia = quando.toLocaleDateString("en-CA", { timeZone: TZ });
  return { dia, mes: dia.slice(0, 7), numeroDoDia: Number(dia.slice(8, 10)) };
}

export async function GET(request: Request) {
  return rodarCron(request, "cobrar-metas", () => cobrar(request));
}

async function cobrar(request: Request): Promise<Record<string, unknown>> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase não configurado.");

  const { dia, mes, numeroDoDia } = hojeBR();
  const forcar = new URL(request.url).searchParams.get("forcar") === "1";

  if (!forcar && (numeroDoDia < PRIMEIRO_DIA || numeroDoDia > ULTIMO_DIA)) {
    return { pulado: `dia ${numeroDoDia} fora da janela 1-${ULTIMO_DIA}` };
  }

  const [rPessoas, rMetas] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome, cargo, empresa, ativo, gestor_mestre, gestor_aprovado")
      .eq("ativo", true),
    supabase.from("compromissos_mensais").select("vendedor_id").eq("mes", mes),
  ]);

  // Erro de leitura não pode virar "ninguém está devendo".
  if (rPessoas.error) {
    throw new Error(`Falha ao ler a equipe: ${rPessoas.error.message}`);
  }
  if (rMetas.error) {
    throw new Error(`Falha ao ler as metas: ${rMetas.error.message}`);
  }

  const jaMandaram = new Set((rMetas.data ?? []).map((m) => String(m.vendedor_id)));
  const pessoas = rPessoas.data ?? [];
  const devendo = pessoas.filter(
    (p) =>
      (CARGOS_QUE_VENDEM as readonly string[]).includes(String(p.cargo)) &&
      !jaMandaram.has(String(p.id)),
  );

  if (devendo.length === 0) {
    return { mes, devendo: 0 };
  }

  /*
   * Uma cobrança por pessoa por dia. Sem isso, um cron que roda de novo (ou
   * uma tentativa repetida da Vercel) entope a sineta do vendedor com o mesmo
   * aviso cinco vezes, e ele passa a ignorar todas.
   */
  const { data: jaAvisadosHoje, error: erroAvisos } = await supabase
    .from("notificacoes")
    .select("vendedor_id")
    .in("titulo", [TITULO_VENDEDOR, TITULO_GESTOR])
    // criada_em é timestamp sem fuso, gravado em UTC: o "-03:00" no texto era
    // descartado e o corte caía às 21h da véspera. Vai o instante UTC.
    .gte("criada_em", inicioDoDiaEmSaoPaulo());
  if (erroAvisos) {
    throw new Error(`Falha ao conferir avisos já enviados: ${erroAvisos.message}`);
  }
  const avisadoHoje = new Set((jaAvisadosHoje ?? []).map((n) => String(n.vendedor_id)));

  const avisos = devendo
    .filter((p) => !avisadoHoje.has(String(p.id)))
    .map((p) => ({
      vendedor_id: String(p.id),
      titulo: TITULO_VENDEDOR,
      mensagem:
        `Sua meta deste mês ainda não foi enviada para o gestor aprovar. ` +
        `Abra o Meu Dia e preencha o Compromisso do Mês.`,
      tipo: "compromisso",
      acao_url: "/meu-dia",
    }));

  /*
   * O gestor recebe a lista de quem está devendo.
   *
   * Duas correções que só apareceram quando fui conferir o resultado da
   * primeira execução no banco, em vez de confiar no "ok" da resposta:
   *
   * - A visão de todas as lojas estava presa ao cargo "Diretor", que NINGUÉM
   *   tem no sistema. Quem enxerga o grupo inteiro é o gestor mestre, e ele
   *   recebia só a lista da própria loja. Importa de verdade: a Sole
   *   Aquecimento não tem gestor nenhum cadastrado, então as três pessoas de
   *   lá ficavam devendo meta sem que ninguém fosse avisado.
   *
   * - Gestor não aprovado recebia o alerta e não conseguia abrir a tela, que
   *   exige gestor_aprovado na RLS. Avisar alguém sobre algo que ele não tem
   *   permissão de ver é pior do que não avisar: gasta a atenção dele e não
   *   oferece saída. Enquanto não for aprovado, a cobrança da equipe dele
   *   fica com o gestor mestre, que enxerga todas as lojas.
   */
  const comoAuth = (p: Record<string, unknown>) => ({
    cargo: String(p.cargo),
    gestorAprovado: p.gestor_aprovado === true,
    gestorMestre: p.gestor_mestre === true,
  });
  // Mesma régua das rotas (auth-empresa): "Diretor" cru recebia a lista das
  // quatro lojas sem aprovação nenhuma.
  const vêTodasAsLojas = (p: Record<string, unknown>) => vejoTodasAsLojas(comoAuth(p));

  const gestores = pessoas.filter((p) => administra(comoAuth(p)));
  for (const g of gestores) {
    if (avisadoHoje.has(String(g.id))) continue;
    const daLoja = vêTodasAsLojas(g)
      ? devendo
      : devendo.filter((p) => String(p.empresa) === String(g.empresa));
    if (daLoja.length === 0) continue;
    avisos.push({
      vendedor_id: String(g.id),
      titulo: TITULO_GESTOR,
      mensagem:
        `${daLoja.length} ${daLoja.length === 1 ? "pessoa" : "pessoas"} sem meta deste mês: ` +
        `${daLoja
          .map((p) =>
            vêTodasAsLojas(g)
              ? `${String(p.nome ?? "sem nome")} (${String(p.empresa ?? "sem loja")})`
              : String(p.nome ?? "sem nome"),
          )
          .join(", ")}.`,
      tipo: "alerta",
      acao_url: "/gestor/compromissos-mensais",
    });
  }

  if (avisos.length === 0) {
    return { mes, devendo: devendo.length, enviados: 0, motivo: "já avisados hoje" };
  }

  const { data, error } = await supabase.from("notificacoes").insert(avisos).select("id");
  if (error) {
    throw new Error(`Falha ao gravar as cobranças: ${error.message}`);
  }

  return {
    mes,
    devendo: devendo.length,
    quem: devendo.map((p) => String(p.nome ?? "sem nome")),
    enviados: data?.length ?? 0,
  };
}
