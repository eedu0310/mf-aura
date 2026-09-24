import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * O que o vendedor precisa saber ao começar o dia.
 *
 * A mesma função serve o cron das 7h e o primeiro acesso do dia, para os
 * dois nunca contarem histórias diferentes.
 */

export interface ItemBriefing {
  tipo: "compromisso" | "followup" | "whatsapp" | "avaliacao";
  titulo: string;
  detalhe?: string;
  hora?: string;
  link: string;
}

export interface Briefing {
  vendedorId: string;
  nome: string;
  dia: string;
  itens: ItemBriefing[];
  resumo: string;
}

/** Hoje no fuso de Brasília, que é fixo em UTC-3. */
export function hojeBR(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

export async function montarBriefing(vendedorId: string): Promise<Briefing | null> {
  const sb = getSupabaseServiceClient();
  if (!sb) return null;

  const dia = hojeBR();

  const [{ data: perfil }, { data: compromissos }, { data: relacionamentos }, { data: avaliacoes }] =
    await Promise.all([
      sb.from("profiles").select("nome").eq("id", vendedorId).maybeSingle(),
      sb
        .from("compromissos")
        .select("titulo, tipo, hora, local, relacionamento_nome, concluido")
        .eq("owner_id", vendedorId)
        .eq("data", dia)
        .order("hora"),
      sb
        .from("relacionamentos")
        .select("id, nome, proximo_contato_em, temperatura")
        .eq("owner_id", vendedorId)
        .not("proximo_contato_em", "is", null)
        .lte("proximo_contato_em", `${dia}T23:59:59`),
      sb
        .from("pedidos_avaliacao")
        .select("id, cliente")
        .eq("vendedor_id", vendedorId)
        .is("enviado_em", null),
    ]);

  const itens: ItemBriefing[] = [];

  for (const c of compromissos ?? []) {
    if (c.concluido) continue;
    itens.push({
      tipo: "compromisso",
      titulo: c.relacionamento_nome ? `${c.tipo}: ${c.relacionamento_nome}` : c.titulo,
      detalhe: c.local ?? undefined,
      hora: c.hora ?? undefined,
      link: "/agenda",
    });
  }

  for (const r of relacionamentos ?? []) {
    const atrasado = String(r.proximo_contato_em).slice(0, 10) < dia;
    itens.push({
      tipo: "followup",
      titulo: `Follow-up: ${r.nome}`,
      detalhe: atrasado ? "atrasado" : "para hoje",
      link: `/relacionamentos?id=${r.id}`,
    });
  }

  for (const a of avaliacoes ?? []) {
    itens.push({
      tipo: "avaliacao",
      titulo: `Pedir avaliação de ${a.cliente ?? "cliente"}`,
      detalhe: "vale ponto no ranking",
      link: "/meu-dia",
    });
  }

  // Ordem do dia: hora marcada primeiro, depois o que está atrasado.
  itens.sort((a, b) => {
    if (a.hora && b.hora) return a.hora.localeCompare(b.hora);
    if (a.hora) return -1;
    if (b.hora) return 1;
    if (a.detalhe === "atrasado" && b.detalhe !== "atrasado") return -1;
    if (b.detalhe === "atrasado" && a.detalhe !== "atrasado") return 1;
    return 0;
  });

  const compromissosHoje = itens.filter((i) => i.tipo === "compromisso").length;
  const followups = itens.filter((i) => i.tipo === "followup").length;
  const pedidos = itens.filter((i) => i.tipo === "avaliacao").length;

  const partes: string[] = [];
  if (compromissosHoje) partes.push(`${compromissosHoje} compromisso${compromissosHoje > 1 ? "s" : ""}`);
  if (followups) partes.push(`${followups} follow-up${followups > 1 ? "s" : ""}`);
  if (pedidos) partes.push(`${pedidos} avaliação${pedidos > 1 ? "ões" : ""} para pedir`);

  const resumo = partes.length
    ? `Hoje: ${partes.join(", ")}.`
    : "Nada marcado para hoje. Bom momento para prospectar.";

  return { vendedorId, nome: perfil?.nome ?? "", dia, itens, resumo };
}
