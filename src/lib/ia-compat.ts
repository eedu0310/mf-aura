/**
 * Ponte Claude -> formato OpenAI.
 *
 * Várias rotas antigas do CRM (coach, rascunho, tarefas diárias, resumo do
 * gestor) foram escritas contra a API da OpenAI. Como o sistema hoje roda na
 * chave do Claude, esta ponte oferece as duas funções que essas rotas usam
 * (`chat.completions.create` e `responses.create`) e traduz as chamadas para
 * o Claude, devolvendo a resposta no formato que elas já esperam.
 *
 * Assim nenhuma dessas telas precisou ser reescrita.
 */
import Anthropic from "@anthropic-ai/sdk";

type Papel = "user" | "assistant";
interface MensagemSimples {
  role: string;
  content: unknown;
}

function chaveClaude() {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";
}

export function temChaveClaude() {
  return !!chaveClaude();
}

let cliente: Anthropic | null = null;
let clienteChave = "";
function anthropic() {
  const chave = chaveClaude();
  if (!chave) return null;
  if (!cliente || clienteChave !== chave) {
    cliente = new Anthropic({ apiKey: chave });
    clienteChave = chave;
  }
  return cliente;
}

const MODELO = () => process.env.AURA_IA_MODEL || process.env.WHATSAPP_IA_MODEL || "claude-sonnet-5";

function texto(conteudo: unknown): string {
  if (typeof conteudo === "string") return conteudo;
  if (Array.isArray(conteudo)) {
    return conteudo
      .map((parte: any) =>
        typeof parte === "string" ? parte : parte?.text ?? parte?.content ?? "",
      )
      .join("\n");
  }
  return conteudo == null ? "" : String(conteudo);
}

/** Junta mensagens seguidas do mesmo papel — o Claude exige alternância. */
function arrumarMensagens(msgs: { role: Papel; content: any }[]) {
  const saida: { role: Papel; content: any }[] = [];
  for (const m of msgs) {
    const ultima = saida[saida.length - 1];
    if (ultima && ultima.role === m.role && typeof ultima.content === "string" && typeof m.content === "string") {
      ultima.content = `${ultima.content}\n\n${m.content}`;
    } else {
      saida.push({ ...m });
    }
  }
  if (!saida.length) saida.push({ role: "user", content: "." });
  if (saida[0].role !== "user") saida.unshift({ role: "user", content: "." });
  return saida;
}

function ferramentasParaClaude(tools: any[]): any[] {
  return (tools ?? [])
    .filter((t) => t && (t.type === "function" || t.name))
    .filter((t) => t.type !== "file_search")
    .map((t) => ({
      name: t.name ?? t.function?.name,
      description: t.description ?? t.function?.description ?? "",
      input_schema: t.parameters ?? t.function?.parameters ?? { type: "object", properties: {} },
    }))
    .filter((t) => t.name);
}

// --------------------------------------------------------------- chat.completions
async function criarChatCompletion(opts: any) {
  const client = anthropic();
  if (!client) throw new Error("Falta a chave da IA (ANTHROPIC_API_KEY).");

  const entrada: MensagemSimples[] = opts.messages ?? [];
  const sistemaPartes = entrada.filter((m) => m.role === "system").map((m) => texto(m.content));
  const conversa = entrada
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as Papel, content: texto(m.content) }));

  let sistema = sistemaPartes.join("\n\n");
  const querJson = opts.response_format?.type === "json_object" || opts.response_format?.type === "json_schema";
  if (querJson) {
    sistema += "\n\nResponda SOMENTE com um JSON válido, sem comentários e sem cercas de código.";
  }

  const resposta = await client.messages.create({
    model: MODELO(),
    max_tokens: opts.max_tokens ?? 2000,
    // O parâmetro "temperature" das rotas antigas não é aceito pelos modelos
    // atuais do Claude — mandar isso derrubava a resposta com erro 400.
    system: sistema || undefined,
    messages: arrumarMensagens(conversa),
  });

  let conteudo = resposta.content.map((b: any) => (b.type === "text" ? b.text : "")).join("").trim();
  if (querJson) {
    const limpo = conteudo.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    const ini = limpo.indexOf("{");
    const fim = limpo.lastIndexOf("}");
    conteudo = ini !== -1 && fim > ini ? limpo.slice(ini, fim + 1) : limpo;
  }

  return { choices: [{ message: { content: conteudo, role: "assistant" } }] };
}

// --------------------------------------------------------------- responses.create
/**
 * Aceita o `input` da Responses API, inclusive os itens `function_call` e
 * `function_call_output` que a rota do coach devolve na segunda rodada.
 */
async function criarResponse(opts: any) {
  const client = anthropic();
  if (!client) throw new Error("Falta a chave da IA (ANTHROPIC_API_KEY).");

  const itens: any[] = Array.isArray(opts.input) ? opts.input : [{ role: "user", content: String(opts.input ?? "") }];
  const mensagens: { role: Papel; content: any }[] = [];

  for (const item of itens) {
    if (item?.type === "function_call") {
      let args: any = {};
      try {
        args = typeof item.arguments === "string" ? JSON.parse(item.arguments) : item.arguments ?? {};
      } catch {
        args = {};
      }
      mensagens.push({
        role: "assistant",
        content: [{ type: "tool_use", id: item.call_id, name: item.name, input: args }],
      });
    } else if (item?.type === "function_call_output") {
      mensagens.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: item.call_id, content: String(item.output ?? "") }],
      });
    } else if (item?.role === "user" || item?.role === "assistant") {
      mensagens.push({ role: item.role, content: texto(item.content) });
    }
  }

  const ferramentas = ferramentasParaClaude(opts.tools ?? []);

  const resposta = await client.messages.create({
    model: MODELO(),
    max_tokens: opts.max_tokens ?? 2000,
    system: opts.instructions || undefined,
    messages: arrumarMensagens(mensagens),
    ...(ferramentas.length ? { tools: ferramentas } : {}),
  });

  const output = resposta.content.map((bloco: any) =>
    bloco.type === "tool_use"
      ? {
          type: "function_call" as const,
          call_id: bloco.id,
          name: bloco.name,
          arguments: JSON.stringify(bloco.input ?? {}),
        }
      : { type: "message" as const, role: "assistant", content: [{ type: "output_text", text: bloco.text ?? "" }] },
  );

  const output_text = resposta.content
    .map((b: any) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  return { output, output_text };
}

/** Objeto com a mesma forma do cliente da OpenAI, mas falando com o Claude. */
export function clienteClaudeNoFormatoOpenAI() {
  if (!temChaveClaude()) return null;
  return {
    chat: { completions: { create: criarChatCompletion } },
    responses: { create: criarResponse },
    __claude: true,
  } as any;
}
