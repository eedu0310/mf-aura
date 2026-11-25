import { NextResponse } from "next/server";
import { getEmpresaAutenticada, vejoTodasAsLojas } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { carregarRegistro, temMigracao108 } from "@/lib/agentes/motor";
import { configuracaoValida } from "@/lib/agentes/configuravel";
import { ID_DIRETORA } from "@/lib/agentes/diretora";
import { MOTIVO_SEM_108, ehUuid, setorParaOBanco, slug } from "@/lib/agentes/util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Orçamento inicial de um agente criado pela equipe; o mestre ajusta depois. */
const ORCAMENTO_INICIAL_USD = 2;

/**
 * O gestor mestre decide uma proposta de agente novo.
 *
 * Corpo: { decisao: "aprovar" | "recusar" }
 *
 * Aprovar cria o agente configurável (aura_agentes, ligado), marca a
 * proposta como "criada" e a Diretora apresenta o colega novo no mural.
 * A configuração é conferida de novo aqui: proposta com fonte ou
 * destinatário fora da lista fechada não vira agente.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Faça login novamente." }, { status: 401 });
  if (!vejoTodasAsLojas(auth)) {
    return NextResponse.json({ erro: "Só o gestor mestre aprova agente novo." }, { status: 403 });
  }
  if (!ehUuid(id)) return NextResponse.json({ erro: "Proposta inválida." }, { status: 400 });
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });
  if (!(await temMigracao108(sb))) return NextResponse.json({ erro: MOTIVO_SEM_108 }, { status: 409 });

  let corpo: { decisao?: unknown };
  try {
    corpo = (await request.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }
  if (corpo.decisao !== "aprovar" && corpo.decisao !== "recusar") {
    return NextResponse.json({ erro: 'decisao deve ser "aprovar" ou "recusar".' }, { status: 400 });
  }

  const { data: proposta } = await sb.from("aura_agente_propostas").select("*").eq("id", id).maybeSingle();
  if (!proposta) return NextResponse.json({ erro: "Proposta não encontrada." }, { status: 404 });
  if (proposta.status !== "proposta") {
    return NextResponse.json({ erro: "Esta proposta já foi decidida." }, { status: 409 });
  }
  const agora = new Date().toISOString();

  if (corpo.decisao === "recusar") {
    const { error } = await sb
      .from("aura_agente_propostas")
      .update({ status: "recusada", decidido_por: auth.userId, decidido_em: agora })
      .eq("id", id)
      .eq("status", "proposta");
    if (error) return NextResponse.json({ erro: "Não consegui registrar a decisão." }, { status: 500 });
    return NextResponse.json({ ok: true, status: "recusada" });
  }

  const config = configuracaoValida(proposta.config);
  if (!config) {
    return NextResponse.json({ erro: "A configuração desta proposta não é segura para virar agente." }, { status: 400 });
  }

  /*
   * Trava antes de criar: a proposta passa de "proposta" para "aprovada" só
   * se ainda estava aberta. Dois cliques (ou dois mestres ao mesmo tempo)
   * criavam dois agentes iguais; agora o segundo recebe 409.
   */
  const { data: travada, error: erroTrava } = await sb
    .from("aura_agente_propostas")
    .update({ status: "aprovada", decidido_por: auth.userId, decidido_em: agora })
    .eq("id", id)
    .eq("status", "proposta")
    .select("id");
  if (erroTrava) return NextResponse.json({ erro: "Não consegui registrar a decisão." }, { status: 500 });
  if (!travada?.length) return NextResponse.json({ erro: "Esta proposta já foi decidida." }, { status: 409 });

  // Id legível e único: "cfg-vigia-de-reclamacoes", "cfg-vigia-de-reclamacoes-2"…
  const registro = await carregarRegistro(sb, true);
  const base = `cfg-${slug(String(proposta.nome)) || "agente"}`;
  let agenteId = base;
  for (let n = 2; registro.some((a) => a.id === agenteId); n++) agenteId = `${base}-${n}`;

  const { error: erroAgente } = await sb.from("aura_agentes").insert({
    id: agenteId,
    nome: proposta.nome,
    cargo: "Agente criado pela equipe",
    setor: setorParaOBanco(String(proposta.setor)),
    icone: "Bot",
    missao: proposta.missao ?? "",
    tipo: "configuravel",
    ativo: true,
    agenda: config.agenda,
    usa_ia: true,
    orcamento_mensal_usd: ORCAMENTO_INICIAL_USD,
    config,
    criado_por: proposta.proposto_por === ID_DIRETORA ? "diretora" : "agente",
    proposta_id: proposta.id,
  });
  if (erroAgente) {
    console.error("[gestor/agentes/propostas]", erroAgente.message);
    // Devolve a proposta para a fila: o mestre pode tentar de novo.
    await sb.from("aura_agente_propostas").update({ status: "proposta", decidido_por: null, decidido_em: null }).eq("id", id);
    return NextResponse.json({ erro: "Não consegui criar o agente." }, { status: 500 });
  }

  await sb
    .from("aura_agente_propostas")
    .update({ status: "criada", decidido_por: auth.userId, decidido_em: agora })
    .eq("id", id);

  await sb.from("aura_escritorio_mensagens").insert({
    de_agente: ID_DIRETORA,
    para_agente: "todos",
    tipo: "relato",
    texto: `Temos colega novo: ${proposta.nome}. ${proposta.missao ?? ""} O gestor aprovou a proposta e ele começa na próxima rodada da agenda.`.trim(),
    dados: { chave: `novo-agente:${agenteId}`, agente: agenteId, proposta: proposta.id },
  });

  return NextResponse.json({ ok: true, status: "criada", agenteId });
}
