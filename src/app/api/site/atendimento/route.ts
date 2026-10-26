import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { equipeDoSite } from "@/lib/site-mf/servidor";
import { EMPRESA_DO_SITE } from "@/lib/site-mf/tipos";
import { EMPRESAS } from "@/lib/companies";

export const runtime = "nodejs";

/**
 * Atendimento dos leads que chegaram pelo site da MF.
 *
 * GET  — os envios dos formulários, com a situação do lead de cada um.
 * POST — "atendido" (o lead segue para o pipeline, pelo caminho de sempre)
 *        ou "transferir" (vai para um vendedor ou para a fila de outra loja).
 *
 * Quem pode: equipe da MF e gestor mestre (equipeDoSite). A leitura cruza
 * leads de vendedores diferentes e a transferência grava em outra loja, por
 * isso a chave de serviço, depois da conferência.
 */

export async function GET(request: Request) {
  const auth = await equipeDoSite(request);
  if (!auth) return NextResponse.json({ erro: "Só a equipe da MF usa esta área." }, { status: 403 });
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Sistema indisponível." }, { status: 503 });

  const { data: envios, error } = await sb
    .from("site_envios")
    .select("id, created_at, dados, nome, telefone, email, cidade, perfil, origem_url, utm, lead_id, transferido_para, transferido_em, formulario_id, pagina_id")
    .eq("empresa", EMPRESA_DO_SITE)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const leadIds = [...new Set((envios ?? []).map((e) => e.lead_id).filter(Boolean))] as string[];
  const formIds = [...new Set((envios ?? []).map((e) => e.formulario_id).filter(Boolean))] as string[];
  const [{ data: leads }, { data: forms }] = await Promise.all([
    leadIds.length
      ? sb.from("leads_recebidos").select("id, status, empresa, vendedor_id, sdr_id, respondido_em, prazo_resposta").in("id", leadIds)
      : Promise.resolve({ data: [] as any[] }),
    formIds.length ? sb.from("site_formularios").select("id, nome").in("id", formIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const donos = [...new Set((leads ?? []).map((l) => l.vendedor_id ?? l.sdr_id).filter(Boolean))] as string[];
  const { data: perfis } = donos.length
    ? await sb.from("profiles").select("id, nome").in("id", donos)
    : { data: [] as { id: string; nome: string }[] };

  const leadPorId = new Map((leads ?? []).map((l) => [l.id, l]));
  const nomePorId = new Map((perfis ?? []).map((p) => [p.id, p.nome]));
  const formPorId = new Map((forms ?? []).map((f) => [f.id, f.nome]));

  return NextResponse.json({
    envios: (envios ?? []).map((e) => {
      const l = e.lead_id ? leadPorId.get(e.lead_id) : null;
      const dono = l ? l.vendedor_id ?? l.sdr_id : null;
      return {
        ...e,
        formulario: e.formulario_id ? formPorId.get(e.formulario_id) ?? null : null,
        lead: l
          ? {
              status: l.status,
              empresa: l.empresa,
              respondido_em: l.respondido_em,
              prazo_resposta: l.prazo_resposta,
              dono: dono ? nomePorId.get(dono) ?? null : null,
              dono_id: dono,
            }
          : null,
      };
    }),
  });
}

export async function POST(request: Request) {
  const auth = await equipeDoSite(request);
  if (!auth) return NextResponse.json({ erro: "Só a equipe da MF usa esta área." }, { status: 403 });
  const sb = getSupabaseServiceClient();
  if (!sb) return NextResponse.json({ erro: "Sistema indisponível." }, { status: 503 });

  let corpo: { acao?: string; envioId?: string; empresa?: string; vendedorId?: string | null; recado?: string };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  const { data: envio } = await sb
    .from("site_envios")
    .select("id, empresa, lead_id, nome, cidade")
    .eq("id", String(corpo.envioId ?? ""))
    .maybeSingle();
  if (!envio || envio.empresa !== EMPRESA_DO_SITE || !envio.lead_id) {
    return NextResponse.json({ erro: "Contato não encontrado." }, { status: 404 });
  }
  const { data: lead } = await sb
    .from("leads_recebidos")
    .select("id, empresa, status, mensagem_inicial, vendedor_id, sdr_id")
    .eq("id", envio.lead_id)
    .maybeSingle();
  if (!lead) return NextResponse.json({ erro: "Lead não encontrado." }, { status: 404 });
  if (lead.empresa !== EMPRESA_DO_SITE) {
    return NextResponse.json({ erro: "Este lead já foi transferido para outra loja." }, { status: 409 });
  }

  /**
   * Atendido: o lead fecha como respondido e o gatilho de sempre
   * (aura_lead_respondido_vira_pipeline) abre o negócio no pipeline da MF,
   * no nome de quem é o lead.
   */
  if (corpo.acao === "atendido") {
    if (lead.status === "respondido") return NextResponse.json({ ok: true });
    const { error } = await sb
      .from("leads_recebidos")
      .update({ status: "respondido", respondido_em: new Date().toISOString(), respondido_por: auth.userId })
      .eq("id", lead.id);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (corpo.acao === "transferir") {
    const destino = String(corpo.empresa ?? "");
    if (!EMPRESAS.some((e) => e.nome === destino)) {
      return NextResponse.json({ erro: "Escolha a loja." }, { status: 400 });
    }
    if (lead.status === "respondido") {
      return NextResponse.json({ erro: "Este lead já foi atendido e está no pipeline. Transfira pelo negócio." }, { status: 409 });
    }

    let vendedorId: string | null = null;
    let vendedorNome: string | null = null;
    if (corpo.vendedorId) {
      const { data: v } = await sb
        .from("profiles")
        .select("id, nome, empresa, ativo")
        .eq("id", corpo.vendedorId)
        .maybeSingle();
      if (!v || v.empresa !== destino || v.ativo === false) {
        return NextResponse.json({ erro: "Esse vendedor não é da loja escolhida." }, { status: 400 });
      }
      vendedorId = v.id;
      vendedorNome = v.nome;
    }

    const recado = (corpo.recado ?? "").trim().slice(0, 600);
    const { data: quem } = await sb.from("profiles").select("nome").eq("id", auth.userId).maybeSingle();
    const nota = `\n\nTransferido pela MF International${quem?.nome ? ` (${quem.nome})` : ""}${recado ? `: ${recado}` : "."}`;

    /**
     * O lead muda de loja e recomeça a distribuição lá: com vendedor
     * escolhido, já nasce dele; sem, entra no sorteio da loja (SDR, vendedor
     * interno, vendedor). O relacionamento que a MF tinha criado fica na
     * carteira da MF; a loja de destino ganha o dela pelo distribuidor.
     */
    const { error: erroLead } = await sb
      .from("leads_recebidos")
      .update({
        empresa: destino,
        vendedor_id: vendedorId,
        sdr_id: null,
        relacionamento_id: null,
        status: vendedorId ? "repassado_vendedor" : "aguardando_sdr",
        prazo_resposta: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        gestor_notificado: false,
        mensagem_inicial: `${lead.mensagem_inicial ?? ""}${nota}`.slice(0, 2000),
      })
      .eq("id", lead.id);
    if (erroLead) return NextResponse.json({ erro: erroLead.message }, { status: 500 });

    const { error: erroDist } = await sb.rpc("distribuir_lead_novo", { p_lead_id: lead.id });
    if (erroDist) console.error("[site] distribuir na loja de destino:", erroDist.message);

    await sb
      .from("site_envios")
      .update({ transferido_para: destino, transferido_em: new Date().toISOString(), transferido_por: auth.userId })
      .eq("id", envio.id);

    if (vendedorId) {
      await sb.from("notificacoes").insert({
        vendedor_id: vendedorId,
        titulo: "Lead transferido pela MF",
        mensagem: `${envio.nome || "Um cliente"}${envio.cidade ? ` (${envio.cidade})` : ""} veio do site da MF para você.${recado ? ` Recado: ${recado}` : ""}`,
        tipo: "lead",
        acao_url: "/leads",
      });
    }

    return NextResponse.json({ ok: true, vendedor: vendedorNome });
  }

  return NextResponse.json({ erro: "Ação inválida." }, { status: 400 });
}
