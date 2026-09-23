"""Supervisor do WhatsApp: resposta da IA com formato fixo + atividade diária automática."""
p = "src/lib/whatsapp/supervisor.ts"
s = open(p, encoding="utf-8").read()

def r(a, b):
    global s
    assert a in s, "trecho não encontrado: " + a[:70]
    s = s.replace(a, b, 1)

# 1) Resposta da IA via ferramenta (JSON sempre válido)
r('''  const resp = await client.messages.create({
    model: process.env.WHATSAPP_IA_MODEL || "claude-sonnet-5",
    max_tokens: 1200,
    system,
    messages: [{ role: "user", content: user }],
  });
  const texto = resp.content
    .map((b: any) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  const json = texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1);
  const r = JSON.parse(json);''', '''  const resp = await client.messages.create({
    model: process.env.WHATSAPP_IA_MODEL || "claude-sonnet-5",
    max_tokens: 1500,
    system: system + "\\n\\nEntregue a análise chamando a ferramenta \\"analise\\".",
    messages: [{ role: "user", content: user }],
    tools: [FERRAMENTA_ANALISE],
    tool_choice: { type: "tool", name: "analise" },
  });
  const bloco = resp.content.find((b: any) => b.type === "tool_use") as any;
  let r: any = bloco?.input;
  if (!r) {
    const texto = resp.content.map((b: any) => (b.type === "text" ? b.text : "")).join("").trim();
    r = JSON.parse(texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1));
  }''')

r('''async function analisarComIa(''', '''const FERRAMENTA_ANALISE = {
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

async function analisarComIa(''')

# 2) Atividade "WhatsApp" automática: 1 por cliente por dia quando o vendedor responde um lead
r('''export function alertasDoChat(userId: string, chatJid: string) {''', '''const atividadesDoDia = ((globalThis as any).__auraSupAtivDia ??= new Set<string>()) as Set<string>;

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

export function alertasDoChat(userId: string, chatJid: string) {''')

r('''  onMessage((userId, chatJid) => agendarAnalise(userId, chatJid));''', '''  onMessage((userId, chatJid, msg) => {
    agendarAnalise(userId, chatJid);
    if (msg.fromMe) registrarAtividadeWhats(userId, chatJid).catch((e) => console.error("[supervisor]", e));
  });''')

open(p, "w", encoding="utf-8").write(s)
print("supervisor ok")
