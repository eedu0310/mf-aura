/**
 * Supervisor AURA — acompanha as conversas de WhatsApp do vendedor e:
 *  1. identifica se o contato é um lead e cria/vincula o relacionamento e a
 *     oportunidade no CRM;
 *  2. avança a oportunidade no pipeline conforme a conversa evolui
 *     (apresentação, orçamento, negociação, fechamento — nunca volta etapa);
 *  3. gera resumo, próxima ação, dicas baseadas no manual de treinamento e
 *     uma sugestão de resposta;
 *  4. avisa quando o cliente está sem resposta ou precisa de follow-up.
 */
import fs from "fs";
import { registrarUsoIA } from "@/lib/aura/custo-ia";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { modeloDeVolume } from "@/lib/aura/modelos";
import { textoDoAprendizado, blocoDeAprendizado } from "@/lib/aura/aprendizado";
import {
  connectedUserIds,
  getChat,
  getChats,
  getMessages,
  onMessage,
  previewOf,
  type WaMessage,
} from "./live-manager";
import {
  calcularAlertas,
  detectarEtapa,
  ETAPAS,
  ORDEM_ETAPA,
  PROBABILIDADE_POR_ETAPA,
  type Alerta,
  type Etapa,
} from "./stage-rules";

export interface LeadInfo {
  chatJid: string;
  ehLead: boolean;
  ignorado: boolean;
  /** A AURA achou que pode ser lead, mas não teve certeza: espera confirmação. */
  leadSugerido: boolean;
  motivoSugestao: string | null;
  etapa: Etapa | null;
  etapaPipeline: Etapa | null;
  oportunidadeId: string | null;
  relacionamentoId: string | null;
  resumo: string | null;
  proximaAcao: string | null;
  sugestaoResposta: string | null;
  interesse: string | null;
  valorEstimado: number | null;
  dicas: string[];
  alertasIa: string[];
  historico: { em: string; de: string | null; para: string; evidencia: string; fonte: string }[];
  ultimaAnaliseEm: string | null;
  analisando: boolean;
  iaDisponivel: boolean;
  aviso: string | null;
}

const DEBOUNCE_MS = 20_000;
const MANUAL_DIR = path.join(process.cwd(), "manual-treinamento");

const g = globalThis as unknown as {
  __auraSupTimers?: Map<string, ReturnType<typeof setTimeout>>;
  __auraSupRunning?: Set<string>;
  __auraSupNotified?: Set<string>;
  __auraSupStarted?: boolean;
  __auraSupManual?: { key: string; texto: string };
  __auraSupEmpresa?: Map<string, string>;
};
const timers = (g.__auraSupTimers ??= new Map());
const running = (g.__auraSupRunning ??= new Set());
const notified = (g.__auraSupNotified ??= new Set());
const empresaCache = (g.__auraSupEmpresa ??= new Map());

// ---------------------------------------------------------------- infra

let admin: SupabaseClient | null | undefined;
function db(): SupabaseClient | null {
  if (admin !== undefined) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  admin = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return admin;
}

function aiKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";
}

const chaveInvalida = ((globalThis as any).__auraSupChaveInvalida ??= { key: "" }) as { key: string };

/** false se não há chave ou se a Anthropic recusou a chave atual. */
export function iaDisponivel() {
  const key = aiKey();
  return !!key && chaveInvalida.key !== key;
}

let anthropic: Anthropic | null = null;
let anthropicKey = "";
function ai(): Anthropic | null {
  const key = aiKey();
  if (!key || chaveInvalida.key === key) return null;
  if (!anthropic || anthropicKey !== key) {
    anthropic = new Anthropic({ apiKey: key });
    anthropicKey = key;
  }
  return anthropic;
}

/** Lê todos os .md/.txt da pasta manual-treinamento (recarrega se mudar). */
export function lerManual(): string {
  try {
    const arquivos = fs
      .readdirSync(MANUAL_DIR)
      .filter((f) => /\.(md|txt)$/i.test(f))
      .sort();
    const key = arquivos
      .map((f) => `${f}:${fs.statSync(path.join(MANUAL_DIR, f)).mtimeMs}`)
      .join("|");
    if (g.__auraSupManual?.key === key) return g.__auraSupManual.texto;
    const texto = arquivos
      .map((f) => `### ${f}\n${fs.readFileSync(path.join(MANUAL_DIR, f), "utf8")}`)
      .join("\n\n")
      .slice(0, 60_000);
    g.__auraSupManual = { key, texto };
    return texto;
  } catch {
    return "";
  }
}

async function empresaDo(userId: string): Promise<string> {
  const cached = empresaCache.get(userId);
  if (cached) return cached;
  const { data } = (await db()?.from("profiles").select("empresa").eq("id", userId).maybeSingle()) ?? {};
  const empresa = (data?.empresa as string) || "LF Lareiras";
  empresaCache.set(userId, empresa);
  return empresa;
}

function variantesTelefone(phone: string): string[] {
  const d = phone.replace(/\D/g, "");
  if (!d.startsWith("55") || (d.length !== 12 && d.length !== 13)) return [];
  const local = d.slice(2);
  const out = new Set([local]);
  if (local.length === 10) out.add(`${local.slice(0, 2)}9${local.slice(2)}`);
  if (local.length === 11 && local[2] === "9") out.add(`${local.slice(0, 2)}${local.slice(3)}`);
  return [...out];
}

function formatarTelefone(phone: string) {
  const d = phone.replace(/\D/g, "");
  const local = d.startsWith("55") ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return phone;
}

// ---------------------------------------------------------------- IA

interface AnaliseIa {
  e_lead: boolean;
  etapa: Etapa | null;
  confianca: number;
  evidencia: string;
  resumo: string;
  interesse: string | null;
  valor_estimado: number | null;
  proxima_acao: string;
  sugestao_resposta: string;
  dicas: string[];
  alertas: string[];
}

function transcricao(msgs: WaMessage[], nomeCliente: string) {
  return msgs
    .slice(-50)
    .map((m) => {
      const quando = new Date(m.timestamp).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const quem = m.fromMe ? "VENDEDOR" : `CLIENTE (${nomeCliente})`;
      return `[${quando}] ${quem}: ${previewOf(m) || "(mensagem vazia)"}`;
    })
    .join("\n");
}

const FERRAMENTA_ANALISE = {
  name: "analise",
  description: "Entrega a análise da conversa de WhatsApp.",
  input_schema: {
    type: "object" as const,
    properties: {
      e_lead: { type: "boolean" },
      etapa: { type: ["string", "null"], enum: ["Prospecção", "Apresentação", "Proposta", "Negociação", "Fechados", "Perdidos", null] },
      confianca: { type: "number" },
      evidencia: { type: "string" },
      resumo: { type: "string" },
      interesse: { type: ["string", "null"] },
      valor_estimado: { type: ["number", "null"] },
      proxima_acao: { type: "string" },
      sugestao_resposta: { type: "string" },
      dicas: { type: "array", items: { type: "string" }, maxItems: 3 },
      alertas: { type: "array", items: { type: "string" }, maxItems: 4 },
    },
    required: ["e_lead", "etapa", "confianca", "resumo", "proxima_acao", "sugestao_resposta", "dicas", "alertas"],
  },
};

const cacheMateriais = ((globalThis as any).__auraSupMateriais ??= new Map<string, { at: number; texto: string }>()) as Map<string, { at: number; texto: string }>;

/** Manuais e playbooks que o gestor enviou pelo painel (+ pasta manual-treinamento). */
async function materiaisDaEmpresa(empresa: string): Promise<string> {
  const hit = cacheMateriais.get(empresa);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.texto;
  let texto = "";
  try {
    const { data } = (await db()
      ?.from("aura_materiais")
      .select("titulo, descricao, texto")
      .eq("empresa", empresa)
      .eq("ativo", true)
      .order("criado_em", { ascending: true })) ?? { data: null };
    texto = (data ?? [])
      .map((m: any) => `### ${m.titulo}${m.descricao ? ` — ${m.descricao}` : ""}\n${m.texto}`)
      .join("\n\n");
  } catch {
    texto = "";
  }
  if (!texto) texto = lerManual();
  if (texto.length > 40000) texto = `${texto.slice(0, 40000)}\n\n[...material cortado por tamanho...]`;
  cacheMateriais.set(empresa, { at: Date.now(), texto });
  return texto;
}

async function analisarComIa(
  msgs: WaMessage[],
  nomeCliente: string,
  etapaAtual: Etapa | null,
  alertas: Alerta[],
  materiais?: string,
  aprendizado?: string,
): Promise<AnaliseIa | null> {
  const client = ai();
  if (!client) return null;

  const manual = materiais ?? lerManual();
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const system = `Você é o Supervisor AURA, um gerente comercial experiente que acompanha em tempo real as conversas de WhatsApp dos vendedores de uma empresa de lareiras, churrasqueiras e aquecimento. Seu objetivo: nenhum lead perdido, atendimento rápido, follow-up em dia e mais vendas.

REGRA DE OURO SOBRE "e_lead": na dúvida, diga que NÃO tem certeza em vez de
chutar que sim. O campo "confianca" é levado a sério: abaixo de 0,75 o
sistema não cria nada e apenas pergunta ao vendedor. Criar lead errado suja
a carteira da pessoa e faz ela perder confiança no sistema — é pior do que
perguntar. Use confiança alta só quando a conversa fala claramente de
produto, preço, medida, prazo, instalação ou orçamento do nosso ramo.

Use o MANUAL DE TREINAMENTO abaixo como a regra da casa. Suas dicas devem aplicar o manual ao caso concreto, citando o que o cliente disse.

ETAPAS DO PIPELINE (em ordem):
- Prospecção: cliente demonstrou interesse, vendedor ainda qualificando.
- Apresentação: vendedor mostrou produtos (fotos, vídeos, catálogo) ou agendou visita/showroom/medição.
- Proposta: vendedor ENVIOU orçamento/proposta/valor (não basta o cliente pedir).
- Negociação: depois da proposta, discutem desconto, parcelamento, condições, concorrência.
- Fechados: cliente confirmou a compra, pagou, mandou comprovante ou pedido confirmado.
- Perdidos: cliente desistiu claramente ou comprou em outro lugar.

Responda APENAS com um JSON válido, sem texto antes ou depois, neste formato:
{
  "e_lead": boolean,            // é uma conversa comercial com cliente/potencial cliente? (false para família, amigos, fornecedores, spam, suporte técnico, ou qualquer assunto fora de lareira/churrasqueira/aquecimento)
  "etapa": "Prospecção"|"Apresentação"|"Proposta"|"Negociação"|"Fechados"|"Perdidos"|null,
  "confianca": número de 0 a 1,
  "evidencia": "trecho curto da conversa que justifica a etapa",
  "resumo": "2 a 3 frases: quem é o cliente, o que quer, em que pé está",
  "interesse": "produto/necessidade em poucas palavras ou null",
  "valor_estimado": número em reais ou null,
  "proxima_acao": "a ação mais importante que o vendedor deve fazer AGORA, específica",
  "sugestao_resposta": "mensagem pronta, curta e natural, que o vendedor pode enviar agora ao cliente (ou \\"\\" se não for o caso)",
  "dicas": ["até 3 dicas práticas baseadas no manual"],
  "alertas": ["riscos de perder este lead, se houver"]
}

MANUAL DE TREINAMENTO:
${manual || "(nenhum manual cadastrado — use boas práticas de venda consultiva)"}${blocoDeAprendizado(aprendizado ?? "")}`;

  const user = `Agora: ${agora}
Etapa atual no pipeline: ${etapaAtual ?? "sem oportunidade ainda"}
Alertas automáticos: ${alertas.map((a) => a.texto).join("; ") || "nenhum"}

CONVERSA (mais recentes por último):
${transcricao(msgs, nomeCliente)}`;

  const resp = await client.messages.create({
    model: modeloDeVolume(),
    max_tokens: 1500,
    system: system + "\n\nEntregue a análise chamando a ferramenta \"analise\".",
    messages: [{ role: "user", content: user }],
    tools: [FERRAMENTA_ANALISE],
    tool_choice: { type: "tool", name: "analise" },
  });
  void registrarUsoIA({
    funcao: "whatsapp",
    modelo: modeloDeVolume(),
    uso: (resp as any).usage,
  });

  const bloco = resp.content.find((b: any) => b.type === "tool_use") as any;
  let r: any = bloco?.input;
  if (!r) {
    const texto = resp.content.map((b: any) => (b.type === "text" ? b.text : "")).join("").trim();
    r = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1));
  }
  return {
    e_lead: !!r.e_lead,
    etapa: ETAPAS.includes(r.etapa) ? r.etapa : null,
    confianca: Number(r.confianca) || 0,
    evidencia: String(r.evidencia ?? ""),
    resumo: String(r.resumo ?? ""),
    interesse: r.interesse ? String(r.interesse) : null,
    valor_estimado: Number(r.valor_estimado) > 0 ? Number(r.valor_estimado) : null,
    proxima_acao: String(r.proxima_acao ?? ""),
    sugestao_resposta: String(r.sugestao_resposta ?? ""),
    dicas: Array.isArray(r.dicas) ? r.dicas.map(String).slice(0, 4) : [],
    alertas: Array.isArray(r.alertas) ? r.alertas.map(String).slice(0, 4) : [],
  };
}

// ---------------------------------------------------------------- CRM

/**
 * Registra o contato novo do WhatsApp também na fila de leads.
 *
 * Sem isso, quem chega pelo WhatsApp do vendedor ficava fora do painel de
 * leads do gestor e fora do controle de tempo de resposta — só aparecia se
 * tivesse vindo pelo site. O lead já nasce com o vendedor que recebeu a
 * mensagem, então não é redistribuído.
 */
async function registrarLeadWhatsApp(
  sb: SupabaseClient,
  dados: {
    empresa: string;
    vendedorId: string;
    relacionamentoId: string;
    nome: string;
    telefone: string;
    mensagem: string | null;
  },
) {
  try {
    const variantes = variantesTelefone(dados.telefone);
    if (variantes.length) {
      const { data: jaTem } = await sb
        .from("leads_recebidos")
        .select("id")
        .eq("empresa", dados.empresa)
        .in("telefone", [dados.telefone, ...variantes])
        .not("status", "in", "(perdido,respondido)")
        .limit(1);
      if (jaTem && jaTem.length) return;
    }

    const prazo = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { error } = await sb.from("leads_recebidos").insert({
      empresa: dados.empresa,
      nome: dados.nome || null,
      telefone: dados.telefone,
      mensagem_inicial: dados.mensagem?.slice(0, 500) ?? null,
      origem: "WhatsApp",
      status: "repassado_vendedor",
      vendedor_id: dados.vendedorId,
      relacionamento_id: dados.relacionamentoId,
      prazo_resposta: prazo,
    });
    if (error) console.error("[supervisor] registrar lead do WhatsApp:", error.message);
  } catch (e: any) {
    console.error("[supervisor] registrar lead do WhatsApp:", e?.message ?? e);
  }
}

/**
 * Quando o vendedor responde pelo WhatsApp, o lead correspondente é fechado.
 * É isso que zera o alerta de "lead sem resposta" para o gestor e faz o
 * negócio entrar no pipeline.
 */
export async function marcarLeadRespondidoPorTelefone(
  sb: SupabaseClient,
  empresa: string,
  telefone: string,
  userId: string,
) {
  try {
    const variantes = variantesTelefone(telefone);
    if (!variantes.length) return;
    await sb
      .from("leads_recebidos")
      .update({ status: "respondido", respondido_em: new Date().toISOString(), respondido_por: userId })
      .eq("empresa", empresa)
      .in("telefone", [telefone, ...variantes])
      .not("status", "in", "(respondido,perdido)");
  } catch (e: any) {
    console.error("[supervisor] fechar lead respondido:", e?.message ?? e);
  }
}

async function garantirRelacionamento(
  sb: SupabaseClient,
  userId: string,
  empresa: string,
  nome: string,
  phone: string,
): Promise<{ id: string | null; aviso: string | null }> {
  const variantes = variantesTelefone(phone);
  if (variantes.length) {
    const { data } = await sb
      .from("relacionamentos")
      .select("id, owner_id, nome")
      .eq("empresa", empresa)
      .in("telefone_normalizado", variantes)
      .limit(5);
    const meu = data?.find((r) => r.owner_id === userId);
    if (meu) return { id: meu.id, aviso: null };
    if (data && data.length > 0) {
      return { id: null, aviso: "Este contato já está na carteira de outro vendedor — fale com seu gestor." };
    }
  }
  const { data, error } = await sb
    .from("relacionamentos")
    .insert({
      owner_id: userId,
      empresa,
      nome: nome || formatarTelefone(phone),
      categoria: "Cliente Final",
      telefone: variantes.length ? formatarTelefone(phone) : null,
      temperatura: "quente",
      origem: "WhatsApp",
      observacao: "Criado automaticamente pelo Supervisor AURA a partir de uma conversa no WhatsApp.",
      ultimo_contato_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    console.error("[supervisor] criar relacionamento:", error.message);
    return { id: null, aviso: "Não consegui cadastrar o contato no CRM." };
  }

  // Contato novo entra também na fila de leads, para o gestor acompanhar.
  await registrarLeadWhatsApp(sb, {
    empresa,
    vendedorId: userId,
    relacionamentoId: data.id,
    nome: nome || "",
    telefone: phone,
    mensagem: null,
  });

  return { id: data.id, aviso: null };
}

async function garantirOportunidade(
  sb: SupabaseClient,
  userId: string,
  empresa: string,
  relacionamentoId: string,
  cliente: string,
  interesse: string | null,
  valor: number | null,
  oportunidadeId: string | null,
) {
  if (oportunidadeId) {
    const { data } = await sb.from("oportunidades").select("id, etapa, valor, cliente").eq("id", oportunidadeId).maybeSingle();
    if (data) return data as { id: string; etapa: Etapa; valor: number; cliente: string };
  }
  const { data: aberta } = await sb
    .from("oportunidades")
    .select("id, etapa, valor, cliente")
    .eq("relacionamento_id", relacionamentoId)
    .not("etapa", "in", '("Fechados","Perdidos")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (aberta) return aberta as { id: string; etapa: Etapa; valor: number; cliente: string };

  // Sem negocio aberto, o padrao e criar um — e assim que o cliente que volta
  // depois de meses ganha a venda nova dele. Mas so existe um card fechado
  // porque a busca acima ignora Fechados e Perdidos, entao cada nova analise
  // criava OUTRO card para a mesma pessoa: "Tiago nunes" acumulou tres em
  // tres minutos, cada um contando como fechamento do mes. Negocio fechado
  // hoje e o mesmo negocio; recompra de verdade acontece noutro dia.
  const inicioDeHoje = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })}T00:00:00-03:00`).toISOString();
  const { data: deHoje } = await sb
    .from("oportunidades")
    .select("id, etapa, valor, cliente")
    .eq("relacionamento_id", relacionamentoId)
    .gte("created_at", inicioDeHoje)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (deHoje) return deHoje as { id: string; etapa: Etapa; valor: number; cliente: string };

  const { data, error } = await sb
    .from("oportunidades")
    .insert({
      owner_id: userId,
      empresa,
      cliente,
      produto: interesse,
      valor: valor ?? 0,
      etapa: "Prospecção",
      probabilidade: "Baixa",
      relacionamento_id: relacionamentoId,
      descricao: "Oportunidade criada automaticamente pelo Supervisor AURA (WhatsApp).",
    })
    .select("id, etapa, valor, cliente")
    .single();
  if (error) {
    console.error("[supervisor] criar oportunidade:", error.message);
    return null;
  }
  await registrarAtividade(sb, userId, empresa, relacionamentoId, cliente, `Oportunidade criada pela IA: ${cliente}`, interesse ?? "Lead vindo do WhatsApp", { oportunidade_id: data.id });
  return data as { id: string; etapa: Etapa; valor: number; cliente: string };
}

async function registrarAtividade(
  sb: SupabaseClient,
  userId: string,
  empresa: string,
  relacionamentoId: string | null,
  cliente: string,
  titulo: string,
  contexto: string,
  metadata: Record<string, unknown>,
) {
  const { error } = await sb.from("atividades").insert({
    owner_id: userId,
    empresa,
    tipo: "WhatsApp",
    titulo,
    contexto,
    relacionamento_id: relacionamentoId,
    cliente_nome: cliente,
    origem: "whatsapp_ia",
    ocorrida_em: new Date().toISOString(),
    metadata: { ...metadata, fonte: "supervisor_aura" },
  });
  if (error) console.error("[supervisor] atividade:", error.message);
}

async function notificar(sb: SupabaseClient, userId: string, titulo: string, mensagem: string, acaoUrl = "/whatsapp") {
  const { error } = await sb.from("notificacoes").insert({
    vendedor_id: userId,
    titulo,
    mensagem,
    tipo: "ia",
    lida: false,
    acao_url: acaoUrl,
    criada_em: new Date().toISOString(),
  });
  if (error) console.error("[supervisor] notificação:", error.message);
}

async function moverOportunidade(
  sb: SupabaseClient,
  userId: string,
  empresa: string,
  op: { id: string; etapa: Etapa; valor: number; cliente: string },
  para: Etapa,
  evidencia: string,
  relacionamentoId: string | null,
  valorEstimado: number | null,
) {
  const patch: Record<string, unknown> = {
    etapa: para,
    probabilidade: PROBABILIDADE_POR_ETAPA[para],
    dias_parado: 0,
    updated_at: new Date().toISOString(),
  };
  if ((!op.valor || Number(op.valor) === 0) && valorEstimado) patch.valor = valorEstimado;
  const { error } = await sb.from("oportunidades").update(patch).eq("id", op.id);
  if (error) {
    console.error("[supervisor] mover oportunidade:", error.message);
    return false;
  }

  await registrarAtividade(
    sb,
    userId,
    empresa,
    relacionamentoId,
    op.cliente,
    `IA moveu no pipeline: ${op.etapa} → ${para}`,
    evidencia,
    { oportunidade_id: op.id, de: op.etapa, para },
  );

  if (para === "Fechados") {
    const { data: jaTem } = await sb.from("vendas").select("id").eq("oportunidade_id", op.id).limit(1);
    if (!jaTem?.length) {
      const valor = Number(patch.valor ?? op.valor) || 0;
      const { error: vErr } = await sb.from("vendas").insert({
        owner_id: userId,
        empresa,
        cliente: op.cliente,
        valor,
        data: new Date().toISOString().slice(0, 10),
        relacionamento_id: relacionamentoId,
        oportunidade_id: op.id,
        valor_original: valor,
        valor_fechado: valor,
        forma_pagamento: "Não informado",
        quantidade_parcelas: 1,
        status: "aguardando_detalhes",
        origem: "WhatsApp",
      });
      if (vErr) console.error("[supervisor] venda:", vErr.message);
    }
    await notificar(
      sb,
      userId,
      "🎉 Venda identificada pela IA",
      `${op.cliente}: negócio marcado como fechado. Complete os detalhes da venda (valor, pagamento).`,
      "/vendas",
    );
  } else {
    await notificar(sb, userId, "🤖 Lead avançou no pipeline", `${op.cliente}: ${op.etapa} → ${para}. ${evidencia}`.slice(0, 280), "/pipeline");
  }
  if (relacionamentoId) {
    await sb
      .from("relacionamentos")
      .update({ temperatura: "quente", ultimo_contato_em: new Date().toISOString() })
      .eq("id", relacionamentoId);
  }
  return true;
}

// ---------------------------------------------------------------- análise

function linhaParaLead(row: any, extra: Partial<LeadInfo> = {}): LeadInfo {
  return {
    chatJid: row?.chat_jid ?? "",
    ehLead: !!row?.oportunidade_id || !!row?.relacionamento_id,
    leadSugerido: !!row?.lead_sugerido,
    motivoSugestao: (row?.motivo_sugestao as string | null) ?? null,
    ignorado: !!row?.ignorado,
    etapa: row?.etapa ?? null,
    etapaPipeline: null,
    oportunidadeId: row?.oportunidade_id ?? null,
    relacionamentoId: row?.relacionamento_id ?? null,
    resumo: row?.resumo ?? null,
    proximaAcao: row?.proxima_acao ?? null,
    sugestaoResposta: null,
    interesse: row?.interesse ?? null,
    valorEstimado: row?.valor_estimado != null ? Number(row.valor_estimado) : null,
    dicas: Array.isArray(row?.dicas) ? row.dicas : [],
    alertasIa: Array.isArray(row?.alertas) ? row.alertas : [],
    historico: Array.isArray(row?.historico) ? row.historico : [],
    ultimaAnaliseEm: row?.ultima_analise_em ?? null,
    analisando: false,
    iaDisponivel: iaDisponivel(),
    aviso: null,
    ...extra,
  };
}

const sugestoes = ((globalThis as any).__auraSupSugestoes ??= new Map<string, string>()) as Map<string, string>;
const avisos = ((globalThis as any).__auraSupAvisos ??= new Map<string, string>()) as Map<string, string>;

export async function obterLead(userId: string, chatJid: string): Promise<LeadInfo> {
  const sb = db();
  const key = `${userId}|${chatJid}`;
  const base = { analisando: running.has(key) || timers.has(key), sugestaoResposta: sugestoes.get(key) ?? null, aviso: avisos.get(key) ?? null };
  if (!sb) return linhaParaLead(null, { chatJid, ...base, aviso: "Supabase não configurado no servidor." });
  const { data: row } = await sb.from("whatsapp_ia_leads").select("*").eq("owner_id", userId).eq("chat_jid", chatJid).maybeSingle();
  let etapaPipeline: Etapa | null = null;
  if (row?.oportunidade_id) {
    const { data: op } = await sb.from("oportunidades").select("etapa").eq("id", row.oportunidade_id).maybeSingle();
    etapaPipeline = (op?.etapa as Etapa) ?? null;
  }
  return linhaParaLead(row ?? { chat_jid: chatJid }, { ...base, etapaPipeline });
}

/** Resumo leve de todos os leads (para a lista de conversas). */
export async function listarLeads(userId: string) {
  const sb = db();
  if (!sb) return {} as Record<string, { etapa: Etapa | null; ignorado: boolean; lead: boolean }>;
  const { data } = await sb
    .from("whatsapp_ia_leads")
    .select("chat_jid, etapa, ignorado, oportunidade_id, relacionamento_id")
    .eq("owner_id", userId);
  const out: Record<string, { etapa: Etapa | null; ignorado: boolean; lead: boolean }> = {};
  for (const r of data ?? []) {
    out[r.chat_jid] = { etapa: r.etapa, ignorado: r.ignorado, lead: !!(r.oportunidade_id || r.relacionamento_id) };
  }
  return out;
}

export async function analisarConversa(
  userId: string,
  chatJid: string,
  opts: { forcar?: boolean; comoLead?: boolean } = {},
) {
  const key = `${userId}|${chatJid}`;
  if (running.has(key)) return;
  const sb = db();
  const chat = getChat(userId, chatJid);
  const msgs = getMessages(userId, chatJid);
  if (!sb || !chat || msgs.length === 0) return;

  running.add(key);
  try {
    const { data: row } = await sb
      .from("whatsapp_ia_leads")
      .select("*")
      .eq("owner_id", userId)
      .eq("chat_jid", chatJid)
      .maybeSingle();
    if (row?.ignorado && !opts.comoLead) return;
    const ultimo = msgs[msgs.length - 1];
    if (!opts.forcar && row?.ultimo_msg_id === ultimo.id) return;

    const empresa = await empresaDo(userId);
    const regras = detectarEtapa(msgs);
    const alertas = calcularAlertas(msgs);

    let etapaPipelineAtual: Etapa | null = null;
    if (row?.oportunidade_id) {
      const { data: op } = await sb.from("oportunidades").select("etapa").eq("id", row.oportunidade_id).maybeSingle();
      etapaPipelineAtual = (op?.etapa as Etapa) ?? null;
    }

    let analise: AnaliseIa | null = null;
    let aviso: string | null = null;
    try {
      const sb0 = db();
      analise = await analisarComIa(
        msgs,
        chat.name,
        etapaPipelineAtual,
        alertas,
        await materiaisDaEmpresa(empresa),
        sb0 ? await textoDoAprendizado(sb0, empresa) : "",
      );
    } catch (e: any) {
      console.error("[supervisor] IA:", e?.message ?? e);
      if (e?.status === 401) {
        chaveInvalida.key = aiKey();
        aviso = "A chave da IA (ANTHROPIC_API_KEY) é inválida — usando só as regras automáticas.";
      } else {
        aviso = "A IA não respondeu agora — usei só as regras automáticas.";
      }
    }

    /**
     * Quem decide se é lead é o vendedor. Sempre.
     *
     * A AURA já criou lead sozinha com base na confiança dela, e o pipeline
     * encheu de conversa que não era venda: papo de amigo, suporte técnico,
     * um orçamento de tatuagem. Confiança alta também erra, e o erro cai na
     * carteira de alguém.
     *
     * Agora ela só entra no CRM por duas portas: o vendedor tocou em
     * "Tratar como lead", ou aquele contato já tem negócio aberto — nesse
     * caso alguém já decidiu antes. Fora isso, ela sugere e espera.
     */
    const CONFIANCA_MINIMA = 0.75;
    const jaEhNegocio = !!row?.oportunidade_id;
    const confiancaLead = analise ? Number(analise.confianca ?? 0) : 0;

    // Sem IA, palavra-chave também não cria nada: no máximo sugere.
    const soRegrasAchou = !analise && regras.comercial;

    const ehLead = !!opts.comoLead || jaEhNegocio;
    const sugerirLead = !ehLead && (!!analise?.e_lead || soRegrasAchou);

    // Etapa detectada: a mais avançada entre regras e IA (IA só com confiança ≥ 0,7).
    let detectada: Etapa | null = regras.etapa;
    let evidencia = regras.evidencias.filter((e) => e.etapa === regras.etapa).slice(-1)[0]?.texto ?? "";
    let fonte = "regras";
    if (analise?.etapa && analise.etapa !== "Perdidos" && analise.confianca >= 0.7) {
      if (!detectada || ORDEM_ETAPA[analise.etapa] > ORDEM_ETAPA[detectada]) {
        detectada = analise.etapa;
        evidencia = analise.evidencia || evidencia;
        fonte = "ia";
      }
    }
    if (ehLead && !detectada) detectada = "Prospecção";

    /**
     * Fechar e perder são do vendedor, nunca da AURA.
     *
     * Entrar em Fechados cria a venda do mês. Uma IA que move o card
     * sozinha até lá registra faturamento que ninguém vendeu — foi o que
     * aconteceu quando um cliente mandou valores por WhatsApp e a conversa
     * apareceu como negócio fechado. Perdidos tem o problema espelhado:
     * encerra sozinha um negócio que ainda estava de pé.
     *
     * A AURA continua reconhecendo os dois e dizendo o que viu. Quem
     * arrasta o card é gente.
     */
    const soDoVendedor = (e: Etapa | null): boolean => e === "Fechados" || e === "Perdidos";

    const alertasIa = [...(analise?.alertas ?? [])];
    if (regras.sinalPerda) alertasIa.unshift(`Risco de perda: cliente disse "${regras.sinalPerda.slice(0, 120)}"`);
    if (analise?.etapa === "Perdidos" && analise.confianca >= 0.7) alertasIa.unshift(`A IA acha que este lead está sendo perdido: ${analise.evidencia}`);
    if (ehLead && detectada === "Fechados") {
      alertasIa.unshift(
        `A AURA achou que este negócio fechou${evidencia ? `: "${evidencia.slice(0, 120)}"` : ""}. Se fechou mesmo, arraste o card para Fechados — a venda do mês só entra quando você confirma.`,
      );
    }

    const patch: Record<string, unknown> = {
      owner_id: userId,
      empresa,
      chat_jid: chatJid,
      telefone: chat.phone,
      nome: chat.name,
      ultimo_msg_id: ultimo.id,
      ultima_analise_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      resumo: analise?.resumo ?? row?.resumo ?? null,
      proxima_acao: analise?.proxima_acao ?? (alertas[0]?.texto ?? row?.proxima_acao ?? null),
      dicas: analise?.dicas ?? row?.dicas ?? [],
      alertas: alertasIa,
      interesse: analise?.interesse ?? row?.interesse ?? null,
      valor_estimado: analise?.valor_estimado ?? row?.valor_estimado ?? null,
    };
    patch.lead_sugerido = sugerirLead;
    patch.confianca_lead = analise ? confiancaLead : null;
    patch.motivo_sugestao = sugerirLead
      ? analise?.resumo
        ? `${confiancaLead >= CONFIANCA_MINIMA ? "Parece venda" : "Pode ser venda"} (${Math.round(confiancaLead * 100)}%): ${analise.resumo}`
        : "Apareceram palavras de venda na conversa. Confirme se é cliente."
      : null;
    if (opts.comoLead) {
      patch.ignorado = false;
      patch.lead_sugerido = false;
      patch.motivo_sugestao = null;
    }
    if (analise?.sugestao_resposta) sugestoes.set(key, analise.sugestao_resposta);

    const historico: any[] = Array.isArray(row?.historico) ? [...row.historico] : [];

    if (ehLead) {
      let relacionamentoId: string | null = row?.relacionamento_id ?? null;
      if (!relacionamentoId) {
        const r = await garantirRelacionamento(sb, userId, empresa, chat.name, chat.phone);
        relacionamentoId = r.id;
        if (r.aviso) aviso = r.aviso;
      }
      patch.relacionamento_id = relacionamentoId;

      if (relacionamentoId) {
        const op = await garantirOportunidade(
          sb,
          userId,
          empresa,
          relacionamentoId,
          chat.name,
          patch.interesse as string | null,
          patch.valor_estimado as number | null,
          row?.oportunidade_id ?? null,
        );
        if (op) {
          patch.oportunidade_id = op.id;
          const ultimaDetectada = (row?.etapa as Etapa | null) ?? null;
          // Só avança: nova etapa acima da atual no pipeline E acima da última
          // detectada (assim, se o vendedor voltar o card manualmente, a IA
          // não "desfaz" a decisão dele sem evidência nova).
          if (
            detectada &&
            !soDoVendedor(detectada) &&
            op.etapa !== "Fechados" &&
            op.etapa !== "Perdidos" &&
            ORDEM_ETAPA[detectada] > ORDEM_ETAPA[op.etapa as Etapa] &&
            (!ultimaDetectada || ORDEM_ETAPA[detectada] > ORDEM_ETAPA[ultimaDetectada])
          ) {
            const moved = await moverOportunidade(sb, userId, empresa, op, detectada, evidencia, relacionamentoId, patch.valor_estimado as number | null);
            if (moved) historico.push({ em: new Date().toISOString(), de: op.etapa, para: detectada, evidencia, fonte });
          } else if (!row?.oportunidade_id) {
            historico.push({ em: new Date().toISOString(), de: null, para: op.etapa, evidencia: "Lead cadastrado no CRM", fonte });
          }
        }
      }
      // Guardar "Fechados" aqui pintaria a etiqueta de fechado sem que o
      // negócio tenha fechado. Vale o que está no card de verdade.
      patch.etapa = soDoVendedor(detectada) ? ((row?.etapa as Etapa | null) ?? null) : detectada;
    } else {
      patch.etapa = null;
    }
    patch.historico = historico.slice(-30);

    if (aviso) avisos.set(key, aviso);
    else avisos.delete(key);

    const { error } = await sb.from("whatsapp_ia_leads").upsert(patch, { onConflict: "owner_id,chat_jid" });
    if (error) console.error("[supervisor] salvar análise:", error.message);
  } catch (e: any) {
    console.error("[supervisor] analisarConversa:", e?.message ?? e);
  } finally {
    running.delete(key);
  }
}

export async function marcarIgnorado(userId: string, chatJid: string, ignorado: boolean) {
  const sb = db();
  if (!sb) return;
  const chat = getChat(userId, chatJid);
  await sb.from("whatsapp_ia_leads").upsert(
    {
      owner_id: userId,
      empresa: await empresaDo(userId),
      chat_jid: chatJid,
      telefone: chat?.phone ?? null,
      nome: chat?.name ?? null,
      ignorado,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,chat_jid" },
  );
  if (!ignorado) agendarAnalise(userId, chatJid, 0, { forcar: true, comoLead: true });
}

/** Vendedor escolhe a etapa manualmente pelo painel. */
export async function definirEtapaManual(userId: string, chatJid: string, etapa: Etapa) {
  const sb = db();
  if (!sb) throw new Error("Supabase não configurado.");
  const { data: row } = await sb.from("whatsapp_ia_leads").select("*").eq("owner_id", userId).eq("chat_jid", chatJid).maybeSingle();
  if (!row?.oportunidade_id) throw new Error("Este contato ainda não tem oportunidade no CRM. Clique em Analisar primeiro.");
  const { data: op } = await sb.from("oportunidades").select("id, etapa, cliente").eq("id", row.oportunidade_id).maybeSingle();
  if (!op) throw new Error("Oportunidade não encontrada.");
  await sb
    .from("oportunidades")
    .update({ etapa, probabilidade: PROBABILIDADE_POR_ETAPA[etapa], updated_at: new Date().toISOString(), dias_parado: 0 })
    .eq("id", op.id);
  const empresa = await empresaDo(userId);
  await registrarAtividade(sb, userId, empresa, row.relacionamento_id, op.cliente, `Etapa alterada no WhatsApp: ${op.etapa} → ${etapa}`, "Alteração manual pelo vendedor", { oportunidade_id: op.id, de: op.etapa, para: etapa });
  const historico = Array.isArray(row.historico) ? row.historico : [];
  historico.push({ em: new Date().toISOString(), de: op.etapa, para: etapa, evidencia: "Alterado manualmente pelo vendedor", fonte: "vendedor" });
  await sb.from("whatsapp_ia_leads").update({ etapa, historico: historico.slice(-30), updated_at: new Date().toISOString() }).eq("id", row.id);
}

export function agendarAnalise(
  userId: string,
  chatJid: string,
  delay = DEBOUNCE_MS,
  opts: { forcar?: boolean; comoLead?: boolean } = {},
) {
  const key = `${userId}|${chatJid}`;
  const t = timers.get(key);
  if (t) clearTimeout(t);
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      analisarConversa(userId, chatJid, opts).catch((e) => console.error("[supervisor]", e));
    }, delay),
  );
}

// ---------------------------------------------------------------- vigilância

/** A cada 5 minutos avisa o vendedor sobre leads sem resposta ou sem follow-up. */
async function varredura() {
  const sb = db();
  if (!sb) return;
  for (const userId of connectedUserIds()) {
    try {
      const leads = await listarLeads(userId);
      for (const chat of getChats(userId)) {
        const info = leads[chat.id];
        if (!info?.lead || info.ignorado) continue;
        const msgs = getMessages(userId, chat.id);
        for (const alerta of calcularAlertas(msgs)) {
          const grave =
            (alerta.tipo === "sem_resposta" && alerta.nivel !== "medio") ||
            (alerta.tipo === "follow_up" && alerta.nivel === "alto");
          if (!grave) continue;
          const chave = `${userId}|${chat.id}|${alerta.tipo}|${alerta.desde}`;
          if (notified.has(chave)) continue;
          notified.add(chave);
          await notificar(
            sb,
            userId,
            alerta.tipo === "sem_resposta" ? "⏰ Cliente esperando resposta" : "📌 Follow-up pendente",
            `${chat.name}: ${alerta.texto}.`,
          );
        }
      }
    } catch (e: any) {
      console.error("[supervisor] varredura:", e?.message ?? e);
    }
  }
}

const atividadesDoDia = ((globalThis as any).__auraSupAtivDia ??= new Set<string>()) as Set<string>;

/** Conta o atendimento no WhatsApp como atividade (metas, relatórios, ranking). */
async function registrarAtividadeWhats(userId: string, chatJid: string) {
  const sb = db();
  if (!sb) return;
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const chaveDia = `${userId}|${chatJid}|${hoje}`;
  if (atividadesDoDia.has(chaveDia)) return;
  const { data: row } = await sb
    .from("whatsapp_ia_leads")
    .select("relacionamento_id, ignorado, nome")
    .eq("owner_id", userId)
    .eq("chat_jid", chatJid)
    .maybeSingle();
  if (!row?.relacionamento_id || row.ignorado) return;
  atividadesDoDia.add(chaveDia);
  const inicioDia = new Date(`${hoje}T00:00:00-03:00`).toISOString();
  const { data: ja } = await sb
    .from("atividades")
    .select("id")
    .eq("owner_id", userId)
    .eq("relacionamento_id", row.relacionamento_id)
    .eq("origem", "whatsapp_auto")
    .gte("ocorrida_em", inicioDia)
    .limit(1);
  if (ja?.length) return;
  const empresa = await empresaDo(userId);
  const { error } = await sb.from("atividades").insert({
    owner_id: userId,
    empresa,
    tipo: "WhatsApp",
    titulo: "Atendimento pelo WhatsApp",
    contexto: "Registrado automaticamente pela AURA",
    relacionamento_id: row.relacionamento_id,
    cliente_nome: row.nome,
    origem: "whatsapp_auto",
    ocorrida_em: new Date().toISOString(),
    metadata: { chat_jid: chatJid, fonte: "supervisor_aura" },
  });
  if (error) console.error("[supervisor] atividade WhatsApp:", error.message);
}

export function alertasDoChat(userId: string, chatJid: string) {
  return calcularAlertas(getMessages(userId, chatJid));
}

if (!g.__auraSupStarted) {
  g.__auraSupStarted = true;
  onMessage((userId, chatJid, msg) => {
    agendarAnalise(userId, chatJid);
    if (msg.fromMe) registrarAtividadeWhats(userId, chatJid).catch((e) => console.error("[supervisor]", e));
  });
  setInterval(() => {
    varredura().catch(() => {});
  }, 5 * 60 * 1000);
}
