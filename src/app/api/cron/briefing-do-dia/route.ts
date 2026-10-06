import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { montarBriefing, hojeBR } from "@/lib/aura/briefing";

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
  const segredo = process.env.CRON_SECRET;
  const autorizacao = request.headers.get("authorization");
  if (segredo && autorizacao !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Supabase não configurado." }, { status: 500 });

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
  if (erroTime) {
    console.error("Cron do briefing: não consegui listar o time:", erroTime);
    return NextResponse.json(
      { ok: false, erro: `Não consegui listar o time: ${erroTime.message}` },
      { status: 500 },
    );
  }

  const dia = hojeBR();
  let enviados = 0;

  for (const pessoa of time ?? []) {
    const briefing = await montarBriefing(pessoa.id);
    if (!briefing) continue;

    // Quem não tem nada marcado não recebe aviso: notificação que não pede
    // nada vira ruído e a pessoa para de abrir as outras.
    if (!briefing.itens.length) continue;

    // Um por dia, mesmo que o cron rode duas vezes.
    const { data: jaTem } = await sb
      .from("notificacoes")
      .select("id")
      .eq("vendedor_id", pessoa.id)
      .eq("tipo", "saudacao")
      .gte("created_at", `${dia}T00:00:00`)
      .maybeSingle();
    if (jaTem) continue;

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

  return NextResponse.json({ ok: true, dia, enviados });
}
