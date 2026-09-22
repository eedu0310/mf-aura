import OpenAI from "openai";

let client: OpenAI | null | undefined;

/**
 * Retorna um cliente OpenAI configurado a partir de OPENAI_API_KEY.
 * Retorna null se a variável de ambiente não estiver definida — nesse caso,
 * as rotas de API devem cair para uma resposta simulada (modo demo).
 */
export function getOpenAIClient(): OpenAI | null {
  if (client !== undefined) return client;

  const apiKey = process.env.OPENAI_API_KEY;
  client = apiKey ? new OpenAI({ apiKey }) : null;
  return client;
}
