/**
 * Chamada simples ao Claude para textos livres (relatórios semanais, resumos).
 * Usa a mesma chave da AURA: ANTHROPIC_API_KEY (ou CLAUDE_API_KEY).
 */
import Anthropic from "@anthropic-ai/sdk";
import { registrarUsoIA } from "@/lib/aura/custo-ia";

let cliente: Anthropic | null = null;
let clienteChave = "";

export async function chamarClaude(opts: {
  sistema: string;
  pergunta: string;
  maxTokens?: number;
  /** Para o controle de custo saber de onde veio a chamada. */
  funcao?: string;
}): Promise<string> {
  const chave = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || "";
  if (!chave) throw new Error("Falta a chave da IA (ANTHROPIC_API_KEY) no .env.local do servidor.");
  if (!cliente || clienteChave !== chave) {
    cliente = new Anthropic({ apiKey: chave });
    clienteChave = chave;
  }
  const resposta = await cliente.messages.create({
    model: process.env.AURA_IA_MODEL || process.env.WHATSAPP_IA_MODEL || "claude-sonnet-5",
    max_tokens: opts.maxTokens ?? 1500,
    system: opts.sistema,
    messages: [{ role: "user", content: opts.pergunta }],
  });
  void registrarUsoIA({
    funcao: opts.funcao ?? "texto",
    modelo: process.env.AURA_IA_MODEL || process.env.WHATSAPP_IA_MODEL || "claude-sonnet-5",
    uso: (resposta as any).usage,
  });

  return resposta.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}
