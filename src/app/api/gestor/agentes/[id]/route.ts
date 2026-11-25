import { NextResponse } from "next/server";
import { administra, getEmpresaAutenticada, vejoTodasAsLojas } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { carregarRegistro, temMigracao108 } from "@/lib/agentes/motor";
import { MOTIVO_SEM_108, setorParaOBanco } from "@/lib/agentes/util";
import { TabelaFaltando, montarPainelDoAgente } from "@/lib/agentes/painel-dados";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O painel do agente (o que abre ao clicar nele no escritório): o que ele
 * falou e ouviu, as rodadas dele, os achados que criou e o resumo de hoje.
 * Formato em src/lib/agentes/painel.ts (PainelDoAgente).
 *
 * Só gestor aprovado. O gestor de uma loja vê as falas e os achados da
 * própria loja; o gestor mestre vê tudo. Só leitura: nada é gravado aqui.
 * Sem a migração 110 responde 409 com o motivo (a ficha continua na tela).
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Faça login novamente." }, { status: 401 });
  if (!administra(auth)) {
    return NextResponse.json({ erro: "Só o gestor aprovado vê o escritório dos agentes." }, { status: 403 });
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });

  try {
    const com108 = await temMigracao108(sb);
    if (!com108) return NextResponse.json({ erro: MOTIVO_SEM_108, motivo: MOTIVO_SEM_108 }, { status: 409 });
    const registro = await carregarRegistro(sb, true);
    const agente = registro.find((a) => a.id === id);
    if (!agente) return NextResponse.json({ erro: "Agente não encontrado." }, { status: 404 });

    const painel = await montarPainelDoAgente(sb, {
      agente,
      registro,
      empresa: vejoTodasAsLojas(auth) ? null : auth.empresa,
    });
    return NextResponse.json(painel);
  } catch (e) {
    if (e instanceof TabelaFaltando) {
      return NextResponse.json({ erro: MOTIVO_SEM_108, motivo: MOTIVO_SEM_108 }, { status: 409 });
    }
    console.error("[gestor/agentes/[id] GET]", e);
    return NextResponse.json({ erro: "Não consegui abrir o painel deste agente agora." }, { status: 500 });
  }
}

/** Teto de sanidade do orçamento de um agente: erro de digitação não vira conta. */
const ORCAMENTO_MAXIMO_USD = 200;

/**
 * Liga/desliga um agente e muda o orçamento mensal dele. Só o gestor mestre.
 *
 * Corpo: { ativo?: boolean, orcamentoMensalUsd?: number }
 *
 * O agente nativo vive no código; a mudança vira (ou atualiza) a linha dele
 * em aura_agentes, que SOBREPÕE o padrão do código. Rotina do sistema
 * (sentinela, backup…) liga e desliga no crontab, não aqui.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await getEmpresaAutenticada(request);
  if (!auth) return NextResponse.json({ erro: "Faça login novamente." }, { status: 401 });
  if (!vejoTodasAsLojas(auth)) {
    return NextResponse.json({ erro: "Só o gestor mestre muda a equipe de agentes." }, { status: 403 });
  }
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 });
  if (!(await temMigracao108(sb))) return NextResponse.json({ erro: MOTIVO_SEM_108 }, { status: 409 });

  let corpo: { ativo?: unknown; orcamentoMensalUsd?: unknown };
  try {
    corpo = (await request.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
  }

  const mudar: Record<string, unknown> = {};
  if (corpo.ativo !== undefined) {
    if (typeof corpo.ativo !== "boolean") return NextResponse.json({ erro: "ativo deve ser verdadeiro ou falso." }, { status: 400 });
    mudar.ativo = corpo.ativo;
  }
  if (corpo.orcamentoMensalUsd !== undefined) {
    const v = Number(corpo.orcamentoMensalUsd);
    if (!Number.isFinite(v) || v < 0 || v > ORCAMENTO_MAXIMO_USD) {
      return NextResponse.json({ erro: `Orçamento deve ficar entre 0 e ${ORCAMENTO_MAXIMO_USD} dólares por mês.` }, { status: 400 });
    }
    mudar.orcamento_mensal_usd = Math.round(v * 100) / 100;
  }
  if (!Object.keys(mudar).length) return NextResponse.json({ erro: "Nada para mudar." }, { status: 400 });

  const registro = await carregarRegistro(sb, true);
  const agente = registro.find((a) => a.id === id);
  if (!agente) return NextResponse.json({ erro: "Agente não encontrado." }, { status: 404 });
  if (agente.tipo === "sistema") {
    return NextResponse.json({ erro: "Rotina do sistema: liga e desliga pelo crontab da VPS." }, { status: 400 });
  }

  const { data: existe } = await sb.from("aura_agentes").select("id").eq("id", id).maybeSingle();
  const { error } = existe
    ? await sb.from("aura_agentes").update(mudar).eq("id", id)
    : await sb.from("aura_agentes").insert({
        id: agente.id,
        nome: agente.nome,
        cargo: agente.cargo,
        // A mesa usa o setor do código; aqui só precisa caber na regra do banco.
        setor: setorParaOBanco(agente.setor),
        icone: agente.icone,
        missao: agente.missao,
        tipo: agente.tipo,
        ativo: agente.ativo,
        agenda: agente.agenda,
        usa_ia: agente.usaIA,
        orcamento_mensal_usd: agente.orcamentoMensalUsd,
        criado_por: "sistema",
        ...mudar,
      });
  if (error) {
    console.error("[gestor/agentes PATCH]", error.message);
    return NextResponse.json({ erro: "Não consegui salvar a mudança." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id, ...corpo });
}
