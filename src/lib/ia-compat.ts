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
import { podeChamarIA, registrarUsoIA, registrarFalhaIA } from "@/lib/aura/custo-ia";
import { modeloDeRaciocinio } from "@/lib/aura/modelos";

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

// A ponte serve o que conversa com gente (Coach, resumo do gestor,
// rascunho, tarefas do dia). O volume — supervisor do WhatsApp e recados —
// escolhe o seu em modelos.ts e pode rodar num modelo mais barato.
const MODELO = () => modeloDeRaciocinio();

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

/**
 * Normaliza o conteudo em blocos e descarta o que a API recusa.
 *
 * Texto vazio derruba a chamada inteira com 400 ("text content blocks must be
 * non-empty"), e isso acontecia sozinho: quando o Claude responde so com uma
 * ferramenta, o bloco de texto que vem junto vem vazio.
 */
function comoBlocos(conteudo: any): any[] {
  if (typeof conteudo === "string") {
    const limpo = conteudo.trim();
    return limpo ? [{ type: "text", text: limpo }] : [];
  }
  if (Array.isArray(conteudo)) {
    return conteudo.filter((bloco: any) => {
      if (!bloco || typeof bloco !== "object") return false;
      if (bloco.type === "text") return String(bloco.text ?? "").trim().length > 0;
      return true;
    });
  }
  const texto = String(conteudo ?? "").trim();
  return texto ? [{ type: "text", text: texto }] : [];
}

/**
 * Junta mensagens seguidas do mesmo papel — o Claude exige alternancia.
 *
 * A versao anterior so juntava quando os DOIS conteudos eram string, e por
 * isso falhava justamente na segunda rodada do coach: ali o Claude devolve
 * um texto (string) seguido de um tool_use (array), os dois do assistente.
 * Iam dois "assistant" seguidos para a API e a conversa inteira caia — o
 * vendedor via "Nao consegui responder com os dados reais agora".
 *
 * Os tool_result vem na frente do proprio recado do usuario, que e onde a
 * API exige que eles estejam.
 */
function arrumarMensagens(msgs: { role: Papel; content: any }[]) {
  const saida: { role: Papel; content: any[] }[] = [];
  for (const m of msgs) {
    const blocos = comoBlocos(m.content);
    if (!blocos.length) continue;
    const ultima = saida[saida.length - 1];
    if (ultima && ultima.role === m.role) ultima.content.push(...blocos);
    else saida.push({ role: m.role, content: blocos });
  }

  for (const m of saida) {
    if (m.role !== "user") continue;
    const resultados = m.content.filter((b: any) => b.type === "tool_result");
    if (resultados.length && resultados.length !== m.content.length) {
      m.content = [...resultados, ...m.content.filter((b: any) => b.type !== "tool_result")];
    }
  }

  if (!saida.length) saida.push({ role: "user", content: [{ type: "text", text: "." }] });
  if (saida[0].role !== "user") saida.unshift({ role: "user", content: [{ type: "text", text: "." }] });
  return saida;
}

const SEM_SALDO =
  "O saldo da IA acabou. Peça ao gestor para registrar um depósito em Painel do Gestor \u2192 Custo da IA.";

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


/**
 * Traduz o erro da API para uma frase que o vendedor entende.
 *
 * Sem isto a tela mostrava o JSON cru em ingles — "Your credit balance is too
 * low to access the Anthropic API" — para quem so quer saber por que a AURA
 * nao respondeu. A mensagem original continua no registro de falhas, que e
 * onde ela serve.
 */
function erroLegivel(erro: unknown): Error {
  const bruto = String((erro as { message?: string })?.message ?? erro ?? "");
  if (/credit balance|insufficient.*(credit|fund)|billing/i.test(bruto)) {
    return new Error(
      "A IA ficou sem crédito na conta da Anthropic. Avise o gestor: ele recarrega em console.anthropic.com, em Plans & Billing.",
    );
  }
  if (/invalid x-api-key|authentication_error|invalid_api_key/i.test(bruto)) {
    return new Error("A chave da IA foi recusada. Avise o gestor para conferir a chave no servidor.");
  }
  if (/rate.?limit|429/i.test(bruto)) {
    return new Error("A IA está recebendo pedidos demais agora. Tente de novo em um minuto.");
  }
  if (/overloaded|529|503/i.test(bruto)) {
    return new Error("A IA está sobrecarregada no momento. Tente de novo em instantes.");
  }
  return erro instanceof Error ? erro : new Error(bruto || "A IA não respondeu.");
}

// --------------------------------------------------------------- chat.completions
async function criarChatCompletion(opts: any, extra?: any) {
  const client = anthropic();
  if (!client) throw new Error("Falta a chave da IA (ANTHROPIC_API_KEY).");
  if (!(await podeChamarIA())) throw new Error(SEM_SALDO);

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

  const mensagens = arrumarMensagens(conversa);
  let resposta;
  try {
    resposta = await client.messages.create({
      model: MODELO(),
      max_tokens: opts.max_tokens ?? 2000,
      // O parâmetro "temperature" das rotas antigas não é aceito pelos modelos
      // atuais do Claude — mandar isso derrubava a resposta com erro 400.
      system: sistema || undefined,
      messages: mensagens as never,
    });
  } catch (erro) {
    await registrarFalhaIA({
      funcao: extra?.__funcao ?? "chat",
      erro,
      detalhe: { papeis: mensagens.map((m) => m.role).join(">"), mensagens: mensagens.length },
    });
    throw erroLegivel(erro);
  }

  void registrarUsoIA({ funcao: extra?.__funcao ?? "chat", modelo: MODELO(), uso: (resposta as any).usage });

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
async function criarResponse(opts: any, extra?: any) {
  const client = anthropic();
  if (!client) throw new Error("Falta a chave da IA (ANTHROPIC_API_KEY).");
  if (!(await podeChamarIA())) throw new Error(SEM_SALDO);

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

  const conversa = arrumarMensagens(mensagens);
  let resposta;
  try {
    resposta = await client.messages.create({
      model: MODELO(),
      max_tokens: opts.max_tokens ?? 2000,
      system: opts.instructions || undefined,
      messages: conversa as never,
      ...(ferramentas.length ? { tools: ferramentas } : {}),
    });
  } catch (erro) {
    await registrarFalhaIA({
      funcao: extra?.__funcao ?? "coach",
      erro,
      detalhe: {
        papeis: conversa.map((m) => m.role).join(">"),
        mensagens: conversa.length,
        ferramentas: ferramentas.length,
      },
    });
    throw erroLegivel(erro);
  }

  void registrarUsoIA({ funcao: extra?.__funcao ?? "coach", modelo: MODELO(), uso: (resposta as any).usage });

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
