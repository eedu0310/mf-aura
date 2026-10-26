import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { equipeDoSite } from "@/lib/site-mf/servidor";
import { EMPRESA_DO_SITE } from "@/lib/site-mf/tipos";
import { EMPRESAS } from "@/lib/companies";
import { abrirLeadDoSite, telefoneDoSite } from "@/lib/site-mf/servidor";

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
    .select("id, created_at, dados, nome, telefone, email, cidade, perfil, origem_url, utm, lead_id, transferido_para, transferido_em, formulario_id, pagina_id, destino, etapa, responsavel_id, nota")
    .eq("empresa", EMPRESA_DO_SITE)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const leadIds = [...new Set((envios ?? []).map((e) => e.lead_id).filter(Boolean))] as string[];
  const formIds = [...new Set((envios ?? []).map((e) => e.formulario_id).filter(Boolean))] as string[];
  const envioIds = (envios ?? []).map((e) => e.id);
  const [{ data: leads }, { data: forms }, { data: conversas }] = await Promise.all([
    leadIds.length
      ? sb.from("leads_recebidos").select("id, status, empresa, vendedor_id, sdr_id, respondido_em, prazo_resposta").in("id", leadIds)
      : Promise.resolve({ data: [] as any[] }),
    formIds.length ? sb.from("site_formularios").select("id, nome").in("id", formIds) : Promise.resolve({ data: [] as any[] }),
    envioIds.length
      ? sb.from("site_conversas").select("id, envio_id, status, nao_lidas, ultima_mensagem, ultima_em, visitante_visto_em").in("envio_id", envioIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const conversaPorEnvio = new Map((conversas ?? []).map((c) => [c.envio_id as string, c]));
  const donos = [
    ...new Set([...(leads ?? []).map((l) => l.vendedor_id ?? l.sdr_id), ...(envios ?? []).map((e) => e.responsavel_id)].filter(Boolean)),
  ] as string[];
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
        formulario: e.formulario_id ? formPorId.get(e.formulario_id) ?? null : conversaPorEnvio.has(e.id) ? "Chat do site" : null,
        conversa: conversaPorEnvio.get(e.id) ?? null,
        responsavel: e.responsavel_id ? nomePorId.get(e.responsavel_id) ?? null : null,
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

  let corpo: { acao?: string; envioId?: string; empresa?: string; vendedorId?: string | null; recado?: string; etapa?: string; nota?: string; nome?: string; telefone?: string; email?: string; cidade?: string };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "Pedido inválido." }, { status: 400 });
  }

  const { data: envio } = await sb
    .from("site_envios")
    .select("id, empresa, lead_id, nome, cidade, telefone, email, destino, dados, formulario_id, responsavel_id")
    .eq("id", String(corpo.envioId ?? ""))
    .maybeSingle();
  if (!envio || envio.empresa !== EMPRESA_DO_SITE) {
    return NextResponse.json({ erro: "Contato não encontrado." }, { status: 404 });
  }

  /**
   * Corrigir os dados do contato (nome, WhatsApp, e-mail, cidade). Vale para
   * o envio, a conversa do chat e o lead, enquanto o lead ainda é da MF.
   */
  if (corpo.acao === "editar") {
    const dados = corpo as unknown as Record<string, unknown>;
    const txt = (k: string, max: number) => (typeof dados[k] === "string" ? String(dados[k]).trim().slice(0, max) : "");
    const nome = txt("nome", 120) || null;
    const telefoneBruto = txt("telefone", 30);
    const telefone = telefoneBruto ? telefoneDoSite(telefoneBruto) : null;
    const email = txt("email", 120).toLowerCase() || null;
    const cidade = txt("cidade", 80) || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return NextResponse.json({ erro: "Confira o e-mail." }, { status: 400 });
    if (telefone && telefone.length < 12) return NextResponse.json({ erro: "Confira o WhatsApp com DDD." }, { status: 400 });
    await sb.from("site_envios").update({ nome, telefone, email, cidade }).eq("id", envio.id);
    await sb.from("site_conversas").update({ nome, telefone, email, cidade }).eq("envio_id", envio.id);
    if (envio.lead_id) {
      await sb
        .from("leads_recebidos")
        .update({ nome, telefone, email, email_normalizado: email })
        .eq("id", envio.lead_id)
        .eq("empresa", EMPRESA_DO_SITE);
    }
    return NextResponse.json({ ok: true });
  }

  /**
   * Excluir (spam, teste, contato repetido). Só gestor. Some do Atendimento,
   * a conversa do chat vai junto e o lead também, se ainda não foi atendido
   * nem transferido; lead que já virou negócio no pipeline fica.
   */
  if (corpo.acao === "excluir") {
    if (!(auth.cargo === "Gestor" || auth.cargo === "Diretor" || auth.gestorMestre)) {
      return NextResponse.json({ erro: "Só o gestor exclui contatos do site." }, { status: 403 });
    }
    let leadExcluido = false;
    if (envio.lead_id) {
      const { data: l } = await sb.from("leads_recebidos").select("id, empresa, status").eq("id", envio.lead_id).maybeSingle();
      if (l && l.empresa === EMPRESA_DO_SITE && l.status !== "respondido") {
        const { error } = await sb.from("leads_recebidos").delete().eq("id", l.id);
        leadExcluido = !error;
      }
    }
    await sb.from("site_conversas").delete().eq("envio_id", envio.id);
    const { error } = await sb.from("site_envios").delete().eq("id", envio.id);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, leadExcluido });
  }

  /**
   * Clientes e parceiros (manual, bloco 3D): funil curto Novo → Em
   * atendimento → Resolvido, com um responsável. Se a conversa mostrar que é
   * venda nova, "virar_lead" manda para a fila de leads da MF.
   */
  if (envio.destino === "cliente") {
    if (corpo.acao === "etapa") {
      const etapa = String(corpo.etapa ?? "");
      if (!["novo", "em_atendimento", "resolvido"].includes(etapa)) return NextResponse.json({ erro: "Etapa inválida." }, { status: 400 });
      const nota = typeof corpo.nota === "string" ? corpo.nota.trim().slice(0, 1000) : undefined;
      const { error } = await sb
        .from("site_envios")
        .update({ etapa, ...(nota !== undefined ? { nota } : {}), ...(etapa !== "novo" && !envio.responsavel_id ? { responsavel_id: auth.userId } : {}) })
        .eq("id", envio.id);
      if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    if (corpo.acao === "responsavel") {
      const id = String(corpo.vendedorId ?? "");
      const { data: p } = await sb.from("profiles").select("id, nome, ativo").eq("id", id).maybeSingle();
      if (!p || p.ativo === false) return NextResponse.json({ erro: "Escolha uma pessoa ativa." }, { status: 400 });
      const recado = (corpo.recado ?? "").trim().slice(0, 600);
      await sb.from("site_envios").update({ responsavel_id: p.id, etapa: "em_atendimento" }).eq("id", envio.id);
      if (p.id !== auth.userId) {
        await sb.from("notificacoes").insert({
          vendedor_id: p.id,
          titulo: "Cliente do site da MF para você",
          mensagem: `${envio.nome || "Um cliente"}${envio.cidade ? ` (${envio.cidade})` : ""} pediu ajuda pelo site.${recado ? ` Recado: ${recado}` : ""}${envio.telefone ? ` WhatsApp: +${envio.telefone}` : ""}`,
          tipo: "lead",
          acao_url: "/site-mf",
        });
      }
      return NextResponse.json({ ok: true, responsavel: p.nome });
    }
    if (corpo.acao === "virar_lead") {
      const { data: form } = envio.formulario_id ? await sb.from("site_formularios").select("nome").eq("id", envio.formulario_id).maybeSingle() : { data: null };
      const resumo = Object.entries((envio.dados ?? {}) as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${v === true ? "sim" : v === false ? "não" : String(v)}`)
        .join("\n");
      const lead = await abrirLeadDoSite(sb, {
        empresa: EMPRESA_DO_SITE,
        nome: envio.nome,
        telefone: envio.telefone,
        email: envio.email,
        mensagem: `Site MF · ${form?.nome ?? "formulário"} (era cliente/parceiro, virou venda nova)\n${resumo}`,
        origem: `Site MF · ${form?.nome ?? "Formulário"}`,
      });
      if (!lead.id) return NextResponse.json({ erro: "Não consegui criar o lead." }, { status: 500 });
      await sb.from("site_envios").update({ destino: "lead", lead_id: lead.id, etapa: "resolvido" }).eq("id", envio.id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ erro: "Ação inválida para cliente/parceiro." }, { status: 400 });
  }

  if (!envio.lead_id) return NextResponse.json({ erro: "Contato sem lead." }, { status: 404 });
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

    // Quem estava no chat do site fica sabendo para onde foi.
    const { data: conversa } = await sb.from("site_conversas").select("id").eq("envio_id", envio.id).maybeSingle();
    if (conversa) {
      await sb.from("site_mensagens").insert({
        conversa_id: conversa.id,
        autor: "sistema",
        texto:
          destino === EMPRESA_DO_SITE
            ? `Passamos o seu atendimento para ${vendedorNome ? vendedorNome.split(" - ")[0] : "um dos nossos consultores"}, que vai falar com você pelo WhatsApp.`
            : `Passamos o seu atendimento para a ${destino}, a loja do Grupo MF que atende a sua região. ${vendedorNome ? vendedorNome.split(" - ")[0] : "Um consultor de lá"} vai falar com você pelo WhatsApp.`,
      });
    }

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
