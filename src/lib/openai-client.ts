import OpenAI from "openai";
import { clienteClaudeNoFormatoOpenAI } from "@/lib/ia-compat";

/**
 * Clientes de IA do AURA.
 *
 * A casa decidiu: TODO raciocínio é Claude. A OpenAI fica apenas para
 * transcrever áudio, que é a única coisa que o Claude não faz — ele não recebe
 * áudio como entrada.
 *
 * Antes deste arquivo, getOpenAIClient() preferia a OpenAI sempre que houvesse
 * uma OPENAI_API_KEY no ambiente, e só caía no Claude quando não havia. Com a
 * chave presente para a transcrição, o Coach, o rascunho da atividade, as
 * tarefas do dia e o resumo do gestor migrariam todos para o GPT sem ninguém
 * pedir — e sem ninguém perceber, porque as duas pontes falam o mesmo formato.
 * Agora a escolha é explícita e não depende de variável de ambiente.
 */

let cliente: OpenAI | null | undefined;
let clienteAudio: OpenAI | null | undefined;

/**
 * Cliente para as rotas antigas, escritas no formato da OpenAI.
 * Sempre Claude, por meio da ponte que fala o mesmo formato.
 */
export function getOpenAIClient(): OpenAI | null {
  if (cliente !== undefined) return cliente;
  cliente = clienteClaudeNoFormatoOpenAI() as OpenAI | null;
  return cliente;
}

/**
 * Cliente exclusivo para transcrição de áudio (Whisper).
 *
 * Usado pelo relato por voz ao registrar atividade e pelo gravador de reunião.
 * Devolve null quando não há OPENAI_API_KEY — aí a rota avisa que a transcrição
 * está indisponível, em vez de falhar sem explicação.
 */
export function clienteDeAudio(): OpenAI | null {
  if (clienteAudio !== undefined) return clienteAudio;
  const apiKey = process.env.OPENAI_API_KEY;
  clienteAudio = apiKey ? new OpenAI({ apiKey }) : null;
  return clienteAudio;
}

/** True quando há chave da OpenAI para transcrever áudio. */
export function temTranscricao() {
  return !!process.env.OPENAI_API_KEY;
}
