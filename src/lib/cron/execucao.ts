import { timingSafeEqual } from "node:crypto";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

/**
 * Régua única dos crons: quem chama /api/cron/* precisa mandar o segredo.
 *
 * FALHA FECHADA. Sete dos oito crons faziam `if (segredo && ...)`: se o
 * CRON_SECRET sumisse do .env.local, a rota ficava aberta para a internet
 * inteira (o proxy deixa /api/cron passar sem login de propósito). Sem
 * segredo configurado, ninguém roda cron — é defeito de instalação, não modo.
 *
 * A comparação é em tempo constante para não vazar o segredo letra a letra.
 */
export function cronAutorizado(request: Request): boolean {
  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo) {
    console.error("[cron] CRON_SECRET não configurado: chamada recusada.");
    return false;
  }
  const recebido = request.headers.get("authorization") ?? "";
  const esperado = `Bearer ${segredo}`;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Diário de bordo dos crons (tabela aura_execucoes_cron, migração 105).
 *
 * Existe para a Sentinela de Operação saber se cada rotina rodou de verdade.
 * Antes, um cron que parava de rodar (crontab apagado, segredo trocado, VPS
 * reiniciada sem o serviço cron) só era notado quando alguém sentia falta do
 * relatório — às vezes semanas depois.
 *
 * Nunca derruba o cron: se a tabela ainda não existe (migração não aplicada)
 * ou o banco soluçar, só registra no log e segue.
 */
export async function registrarExecucaoCron(
  nome: string,
  inicio: Date,
  ok: boolean,
  detalhe?: unknown,
): Promise<void> {
  try {
    const sb = getSupabaseServiceClient();
    if (!sb) return;
    const { error } = await sb.from("aura_execucoes_cron").insert({
      nome,
      inicio: inicio.toISOString(),
      fim: new Date().toISOString(),
      ok,
      detalhe: detalhe === undefined ? null : JSON.parse(JSON.stringify(detalhe)),
    });
    if (error) console.error(`[cron] não registrei a execução de ${nome}:`, error.message);
  } catch (e) {
    console.error(`[cron] não registrei a execução de ${nome}:`, e);
  }
}

/**
 * Envolve o corpo de um cron: confere o segredo, mede, registra o resultado
 * no diário e devolve a resposta. O corpo devolve o JSON de sucesso; se ele
 * lançar erro, o cron responde 500 e o diário guarda a falha.
 */
export async function rodarCron(
  request: Request,
  nome: string,
  corpo: () => Promise<Record<string, unknown>>,
): Promise<Response> {
  if (!cronAutorizado(request)) {
    return Response.json({ erro: "Não autorizado." }, { status: 401 });
  }
  const inicio = new Date();
  try {
    const resultado = await corpo();
    await registrarExecucaoCron(nome, inicio, true, resultado);
    return Response.json({ ok: true, ...resultado });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error(`[cron/${nome}]`, erro);
    await registrarExecucaoCron(nome, inicio, false, { erro: mensagem });
    return Response.json({ erro: `Falha no cron ${nome}.` }, { status: 500 });
  }
}
