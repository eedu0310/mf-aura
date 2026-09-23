import OpenAI from "openai";
import { clienteClaudeNoFormatoOpenAI } from "@/lib/ia-compat";

let client: OpenAI | null | undefined;

/**
 * Cliente de IA para as rotas antigas, escritas no formato da OpenAI.
 *
 * - Se houver OPENAI_API_KEY, usa a OpenAI de verdade (nada muda).
 * - Se não houver, usa a chave do Claude por meio de uma ponte que fala o
 *   mesmo formato. Foi isso que voltou a ligar o AURA Coach, o rascunho da
 *   atividade, as tarefas do dia e o resumo do gestor.
 * - Sem nenhuma das duas chaves, devolve null e a rota avisa o usuário.
 */
export function getOpenAIClient(): OpenAI | null {
  if (client !== undefined) return client;

  const apiKey = process.env.OPENAI_API_KEY;
  client = apiKey ? new OpenAI({ apiKey }) : (clienteClaudeNoFormatoOpenAI() as OpenAI | null);
  return client;
}

/** True quando o cliente atual é a OpenAI mesmo (necessário para embeddings). */
export function temOpenAIDeVerdade() {
  return !!process.env.OPENAI_API_KEY;
}
