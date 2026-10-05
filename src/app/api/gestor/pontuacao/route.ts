/**
 * Pontuação, metas de prospecção e prêmios.
 *
 * GET  — as regras de pontos, a meta de cada vendedor, o placar do mês, o
 *        acumulado do ano e os prêmios já definidos.
 * POST — grava regra de pontos, meta de um vendedor, ou prêmio.
 *
 * A meta por pessoa mora em metas_indicadores, que já existia com o grão certo
 * (vendedor, mês, métrica). É isso que permite 200 para um representante e 400
 * para outro sem tabela nova.
 *
 * Os pontos vêm das views pontos_do_mes e pontos_do_ano, somados dos registros.
 * Ninguém digita placar: se o número pudesse ser editado à mão, a premiação
 * perderia a graça no primeiro mês.
 */
import { NextRequest, NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A métrica da meta de prospecção. Fixa, para a tela e a apuração concordarem. */
const METRICA_PROSPECCAO = "prospeccao_total";

async function somenteGestor() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }) };

  const sb = getSupabaseServiceClient();
  if (!sb) return { erro: NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 }) };

  const { data: eu } = await sb
    .from("profiles")
    .select("cargo, empresa, gestor_mestre")
    .eq("id", auth.userId)
    .maybeSingle();

  if (!eu || !(/gestor/i.test(eu.cargo ?? "") || eu.gestor_mestre)) {
    return {
      erro: NextResponse.json(
        { erro: "Só o gestor define pontuação, metas e prêmios." },
        { status: 403 },
      ),
    };
  }
  return { auth, sb, eu };
}

export async function GET(req: NextRequest) {
  const { erro, sb, eu } = await somenteGestor();
  if (erro) return erro;

  const mes = req.nextUrl.searchParams.get("mes") || new Date().toISOString().slice(0, 7);
  const ano = mes.slice(0, 4);
  const pedida = req.nextUrl.searchParams.get("loja");
  const loja = eu!.gestor_mestre && pedida ? pedida : eu!.empresa;

  const [regras, metas, doMes, doAno, premios, pessoas] = await Promise.all([
    sb!
      .from("pontuacao_regras")
      .select("id, mes, tipo, chave, pontos")
      .eq("empresa", loja)
      .or(`mes.eq.${mes},mes.eq.padrao`),
    sb!
      .from("metas_indicadores")
      .select("vendedor_id, meta")
      .eq("empresa", loja)
      .eq("mes", mes)
      .eq("metrica", METRICA_PROSPECCAO),
    sb!.from("pontos_do_mes").select("*").eq("empresa", loja).eq("mes", mes),
    sb!.from("pontos_do_ano").select("*").eq("empresa", loja).eq("ano", ano),
    sb!.from("premios").select("*").eq("empresa", loja).order("criado_em", { ascending: false }),
    // Só gente ativa: conta desativada continua no banco e, sem este filtro,
    // aparecia na lista de metas e na disputa do prêmio depois de a pessoa já
    // ter saído da empresa.
    sb!
      .from("profiles")
      .select("id, nome, cargo, ativo")
      .eq("empresa", loja)
      .neq("ativo", false)
      .is("excluido_em", null),
  ]);

  const nome = new Map((pessoas.data ?? []).map((p) => [p.id as string, p.nome as string]));
  const metaDe = new Map(
    (metas.data ?? []).map((m) => [m.vendedor_id as string, Number(m.meta ?? 0)]),
  );
  const pontosMes = new Map(
    (doMes.data ?? []).map((p) => [p.vendedor_id as string, p]),
  );

  // Só vendedores: o gestor não disputa o prêmio da equipe dele.
  const vendedores = (pessoas.data ?? [])
    .filter((p) => /vendedor|representante|sdr/i.test(p.cargo ?? ""))
    .map((p) => {
      const pm = pontosMes.get(p.id as string);
      const meta = metaDe.get(p.id as string) ?? null;
      const feitas = Number(pm?.atividades ?? 0);
      return {
        id: p.id as string,
        nome: p.nome as string,
        meta,
        prospeccoes: feitas,
        // Quanto falta para a meta do mês. É este número que o vendedor cobra
        // de si mesmo; a pontuação é o desempate.
        falta: meta != null ? Math.max(0, meta - feitas) : null,
        percentual: meta && meta > 0 ? Math.round((feitas / meta) * 100) : null,
        pontos: Number(pm?.pontos ?? 0),
        pontosAtividades: Number(pm?.pontos_atividades ?? 0),
        pontosEtapas: Number(pm?.pontos_etapas ?? 0),
      };
    })
    .sort((a, b) => b.pontos - a.pontos);

  const anual = (doAno.data ?? [])
    .map((a) => ({
      id: a.vendedor_id as string,
      nome: nome.get(a.vendedor_id as string) ?? "Sem nome",
      pontos: Number(a.pontos ?? 0),
      atividades: Number(a.atividades ?? 0),
      meses: Number(a.meses_com_registro ?? 0),
    }))
    .sort((a, b) => b.pontos - a.pontos);

  return NextResponse.json({
    loja,
    mes,
    ano,
    metricaProspeccao: METRICA_PROSPECCAO,
    regras: regras.data ?? [],
    vendedores,
    anual,
    premios: (premios.data ?? []).map((p) => ({
      ...p,
      vencedor: p.vencedor_id ? nome.get(p.vencedor_id as string) ?? null : null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { erro, sb, auth, eu } = await somenteGestor();
  if (erro) return erro;

  let c: {
    acao?: "regra" | "meta" | "premio";
    // regra
    mes?: string | null;
    tipo?: "atividade" | "etapa";
    chave?: string;
    pontos?: number;
    // meta
    vendedorId?: string;
    meta?: number;
    // premio
    escopo?: "mensal" | "anual";
    ano?: number;
    descricao?: string;
    vencedorId?: string | null;
    loja?: string;
  };
  try {
    c = await req.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const loja = eu!.gestor_mestre && c.loja ? c.loja : eu!.empresa;

  if (c.acao === "regra") {
    if (!c.tipo || !c.chave || typeof c.pontos !== "number" || c.pontos < 0) {
      return NextResponse.json(
        { erro: "Informe tipo, chave e pontos (0 ou mais)." },
        { status: 400 },
      );
    }
    const { error } = await sb!.from("pontuacao_regras").upsert(
      {
        empresa: loja,
        mes: c.mes || "padrao",   // "padrao" = regra usada em todo mes sem regra propria
        tipo: c.tipo,
        chave: c.chave,
        pontos: c.pontos,
      },
      { onConflict: "empresa,mes,tipo,chave" },
    );
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (c.acao === "meta") {
    if (!c.vendedorId || !c.mes || typeof c.meta !== "number" || c.meta < 0) {
      return NextResponse.json(
        { erro: "Informe vendedorId, mes e meta." },
        { status: 400 },
      );
    }
    const { error } = await sb!.from("metas_indicadores").upsert(
      {
        vendedor_id: c.vendedorId,
        empresa: loja,
        mes: c.mes,
        metrica: METRICA_PROSPECCAO,
        meta: c.meta,
      },
      // A unicidade da tabela e (vendedor_id, mes, metrica) - sem empresa.
      // Passar empresa aqui faria o upsert nao achar o indice e duplicar meta.
      { onConflict: "vendedor_id,mes,metrica" },
    );
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (c.acao === "premio") {
    if (!c.escopo || !c.descricao?.trim()) {
      return NextResponse.json({ erro: "Informe escopo e descrição." }, { status: 400 });
    }
    if (c.escopo === "mensal" && !c.mes) {
      return NextResponse.json({ erro: "Prêmio mensal precisa do mês." }, { status: 400 });
    }
    if (c.escopo === "anual" && !c.ano) {
      return NextResponse.json({ erro: "Prêmio anual precisa do ano." }, { status: 400 });
    }

    // Congela o placar de quem ganhou, para o registro não mudar depois que
    // novos lançamentos entrarem no período.
    // 'YYYY-MM' quando mensal, 'YYYY' quando anual.
    const periodo = c.escopo === "mensal" ? String(c.mes) : String(c.ano);

    let pontosNaApuracao: number | null = null;
    if (c.vencedorId) {
      const fonte = c.escopo === "mensal" ? "pontos_do_mes" : "pontos_do_ano";
      const filtro = c.escopo === "mensal" ? { mes: periodo } : { ano: periodo };
      const { data } = await sb!
        .from(fonte)
        .select("pontos")
        .eq("vendedor_id", c.vencedorId)
        .match(filtro)
        .maybeSingle();
      pontosNaApuracao = data ? Number(data.pontos ?? 0) : null;
    }

    const { error } = await sb!.from("premios").upsert(
      {
        empresa: loja,
        escopo: c.escopo,
        periodo,
        descricao: c.descricao.trim(),
        vencedor_id: c.vencedorId ?? null,
        pontos_na_apuracao: pontosNaApuracao,
        definido_por: auth!.userId,
      },
      { onConflict: "empresa,escopo,periodo" },
    );
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { erro: "Informe acao: 'regra', 'meta' ou 'premio'." },
    { status: 400 },
  );
}
