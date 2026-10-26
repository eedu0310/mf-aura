import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { abrirLeadDoSite, impressaoDoIp, soDigitos, telefoneDoSite } from "@/lib/site-mf/servidor";
import { valorDoTipo, type CampoFormulario } from "@/lib/site-mf/tipos";
import { avisarEquipe, quemAvisar } from "@/lib/site-mf/chat";

export const runtime = "nodejs";

/**
 * Envio de formulário do site (LP ou formulário embutido no WordPress).
 *
 * Rota PÚBLICA: quem chama é o visitante, sem login. Por isso:
 *  - só aceita formulário ativo, e só os campos que ele declara;
 *  - campo-armadilha escondido ("site") que gente não preenche e robô sim;
 *  - no máximo 5 envios por IP a cada 10 minutos (o IP vira impressão, não
 *    é guardado).
 *
 * O envio vira lead na fila da loja (leads_recebidos). A distribuição e o
 * caminho até o pipeline são os que todo lead já percorre.
 */
const LIMITE_POR_JANELA = 5;
const JANELA_MS = 10 * 60 * 1000;

function cors(res: NextResponse) {
  // Formulário embutido em outro domínio (o site da MF) precisa disto.
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

export function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

function erro(mensagem: string, status = 400) {
  return cors(NextResponse.json({ ok: false, erro: mensagem }, { status }));
}

export async function POST(request: Request) {
  let corpo: {
    formulario?: string;
    pagina?: string | null;
    dados?: Record<string, unknown>;
    origem_url?: string;
    utm?: Record<string, string>;
    site?: string;
  };
  try {
    corpo = await request.json();
  } catch {
    return erro("Envio inválido.");
  }

  // Armadilha: campo escondido que só robô preenche. Responde "ok" para ele
  // não tentar de outro jeito, e não grava nada.
  if (corpo.site) return cors(NextResponse.json({ ok: true }));

  const sb = getSupabaseServiceClient();
  if (!sb) return erro("Sistema indisponível agora. Tente de novo em instantes.", 503);

  const slug = String(corpo.formulario ?? "").trim();
  if (!slug) return erro("Formulário não informado.");

  const { data: form } = await sb
    .from("site_formularios")
    .select("id, empresa, nome, campos, mensagem_sucesso, material_nome, material_url, ativo, destino")
    .eq("slug", slug)
    .maybeSingle();
  if (!form || !form.ativo) return erro("Este formulário não está mais disponível.", 404);

  const ip = impressaoDoIp(request);
  if (ip) {
    const desde = new Date(Date.now() - JANELA_MS).toISOString();
    const { count } = await sb
      .from("site_envios")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ip)
      .gte("created_at", desde);
    if ((count ?? 0) >= LIMITE_POR_JANELA) {
      return erro("Recebemos vários envios seguidos daqui. Aguarde alguns minutos.", 429);
    }
  }

  // Só os campos que o formulário declara, cada um com tamanho limitado.
  const campos = (Array.isArray(form.campos) ? form.campos : []) as CampoFormulario[];
  const entrada = corpo.dados ?? {};
  const dados: Record<string, string | boolean> = {};
  for (const c of campos) {
    const bruto = entrada[c.chave];
    if (c.tipo === "caixa") {
      dados[c.chave] = bruto === true || bruto === "true" || bruto === "on";
      if (c.obrigatorio && !dados[c.chave]) return erro(`Marque "${c.rotulo}".`);
      continue;
    }
    const v = typeof bruto === "string" ? bruto.trim().slice(0, c.tipo === "area" ? 2000 : 200) : "";
    if (c.obrigatorio && !v) return erro(`Preencha "${c.rotulo}".`);
    if (v && c.tipo === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return erro("Confira o e-mail.");
    if (v && c.tipo === "telefone" && soDigitos(v).length < 10) return erro("Confira o WhatsApp com DDD.");
    if (v && c.tipo === "selecao" && c.opcoes?.length && !c.opcoes.includes(v)) return erro(`Escolha uma opção em "${c.rotulo}".`);
    if (v) dados[c.chave] = v;
  }

  const textos = dados as Record<string, unknown>;
  const nomeBase = (typeof textos.nome === "string" && textos.nome) || valorDoTipo(campos, textos, "texto");
  const sobrenome = typeof textos.sobrenome === "string" ? textos.sobrenome : "";
  const nome = [nomeBase, sobrenome].filter(Boolean).join(" ").slice(0, 120) || null;
  const telefone = telefoneDoSite(valorDoTipo(campos, textos, "telefone"));
  const email = valorDoTipo(campos, textos, "email")?.toLowerCase() ?? null;
  const cidade = valorDoTipo(campos, textos, "cidade");
  const perfil = valorDoTipo(campos, textos, "selecao");
  if (!telefone && !email) return erro("Deixe um WhatsApp ou e-mail para a equipe falar com você.");

  let paginaId: string | null = null;
  if (corpo.pagina) {
    const { data: pag } = await sb.from("site_paginas").select("id").eq("slug", String(corpo.pagina)).maybeSingle();
    paginaId = pag?.id ?? null;
  }

  const resumo = campos
    .filter((c) => dados[c.chave] !== undefined && dados[c.chave] !== "")
    .map((c) => `${c.rotulo}: ${dados[c.chave] === true ? "sim" : dados[c.chave] === false ? "não" : dados[c.chave]}`)
    .join("\n");

  /**
   * Formulário de quem já é cliente ou parceiro (manual, bloco 3D): não vira
   * lead nem entra na fila de vendas. Fica em Site MF → Clientes e parceiros.
   */
  const ehCliente = form.destino === "cliente";
  let leadId: string | null = null;
  if (!ehCliente) {
    const lead = await abrirLeadDoSite(sb, {
      empresa: form.empresa,
      nome,
      telefone,
      email,
      mensagem: `Formulário do site: ${form.nome}\n${resumo}`,
      origem: `Site MF · ${form.nome}`,
    });
    if (!lead.id) {
      console.error("[site] criar lead:", lead.erro);
      return erro("Não consegui registrar agora. Tente de novo em instantes.", 500);
    }
    leadId = lead.id;
  }

  const utm = corpo.utm && typeof corpo.utm === "object" ? corpo.utm : null;
  const { error: erroEnvio } = await sb.from("site_envios").insert({
    empresa: form.empresa,
    formulario_id: form.id,
    pagina_id: paginaId,
    dados,
    nome,
    telefone,
    email,
    cidade,
    perfil,
    origem_url: typeof corpo.origem_url === "string" ? corpo.origem_url.slice(0, 500) : null,
    utm,
    lead_id: leadId,
    destino: ehCliente ? "cliente" : "lead",
    ip_hash: ip,
  });
  if (erroEnvio) console.error("[site] gravar envio:", erroEnvio.message);

  // Cliente/parceiro não passa pela distribuição de leads: avisa a equipe.
  if (ehCliente) {
    await avisarEquipe(sb, form.empresa, await quemAvisar(sb, form.empresa), `Site MF: ${form.nome}`, `${nome || "Alguém"}${cidade ? ` (${cidade})` : ""} pediu ${form.nome}. Está em Site MF → Clientes e parceiros.`);
  }

  return cors(
    NextResponse.json({
      ok: true,
      mensagem: form.mensagem_sucesso,
      material: form.material_url ? { nome: form.material_nome || "Abrir o material", url: form.material_url } : null,
    }),
  );
}
