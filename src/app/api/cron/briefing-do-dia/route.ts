import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { montarBriefing, hojeBR } from "@/lib/aura/briefing";
import { rodarCron } from "@/lib/cron/execucao";
import { inicioDoDiaEmSaoPaulo } from "@/lib/fuso";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Às 7h da manhã, cada vendedor recebe o que tem para hoje.
 *
 * Roda em UTC: "0 10 * * *" é 7h de Brasília. O vendedor que abrir o
 * sistema antes disso vê a mesma coisa pelo /api/briefing — o cron é a
 * rede de segurança para quem não abre.
 */
export async function GET(request: Request) {
  return rodarCron(request, "briefing-do-dia", async () => {
    const sb = getSupabaseServiceClient();
    if (!sb) throw new Error("Supabase não configurado.");

    const { data: time, error: erroTime } = await sb
      .from("profiles")
      .select("id")
      .in("cargo", ["Vendedor", "Vendedor Interno", "SDR"])
      .eq("ativo", true);

    /**
     * Sem essa checagem o erro virava lista vazia: o cron das 7h respondia
     * {ok: true, enviados: 0} e a equipe inteira ficava sem briefing sem que
     * nada no log indicasse falha.
     */
    if (erroTime) throw new Error(`Não consegui listar o time: ${erroTime.message}`);

    const dia = hojeBR();
    /*
     * A trava "um por dia" nunca travou: filtrava por created_at, coluna que
     * notificacoes não tem (a dela é criada_em), então a consulta dava erro,
     * voltava vazia e o cron rodado duas vezes mandava dois briefings. E o
     * corte "${dia}T00:00:00" sem fuso era meia-noite UTC — 21h de Brasília
     * da véspera. criada_em é timestamp sem fuso gravado por now() em UTC,
     * por isso o corte vai como o instante UTC da meia-noite de São Paulo.
     */
    const desde = inicioDoDiaEmSaoPaulo();
    let enviados = 0;
    let falhas = 0;

    for (const pessoa of time ?? []) {
      const briefing = await montarBriefing(pessoa.id);
      if (!briefing) continue;

      // Quem não tem nada marcado não recebe aviso: notificação que não pede
      // nada vira ruído e a pessoa para de abrir as outras.
      if (!briefing.itens.length) continue;

      // Um por dia, mesmo que o cron rode duas vezes.
      const { data: jaTem, error: erroJaTem } = await sb
        .from("notificacoes")
        .select("id")
        .eq("vendedor_id", pessoa.id)
        .eq("tipo", "saudacao")
        .gte("criada_em", desde)
        .limit(1);
      // Na dúvida, não manda (um briefing a menos é melhor que dois iguais),
      // mas conta, para o diário do cron mostrar que algo falhou.
      if (erroJaTem) {
        falhas += 1;
        continue;
      }
      if ((jaTem ?? []).length > 0) continue;

      const primeiros = briefing.itens
        .slice(0, 3)
        .map((i) => (i.hora ? `${i.hora} ${i.titulo}` : i.titulo))
        .join(" · ");

      await sb.from("notificacoes").insert({
        vendedor_id: pessoa.id,
        titulo: briefing.resumo,
        mensagem: primeiros,
        tipo: "saudacao",
        acao_url: "/meu-dia",
      });
      enviados += 1;
    }

    return { dia, enviados, falhas };
  });
}
