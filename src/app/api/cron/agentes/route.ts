import { cronAutorizado, rodarCron } from "@/lib/cron/execucao";
import { rodarAgente, rodarDevidos } from "@/lib/agentes/motor";
import { simularAgente, simularTodos } from "@/lib/agentes/simulacao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * A equipe de agentes (ver lib/agentes/motor.ts e docs/agentes.md).
 *
 * O cron da VPS chama de 10 em 10 minutos. Cada chamada roda, um de cada
 * vez, os agentes cuja agenda manda rodar agora, sem passar de ~240 s (o
 * curl corta em 290 s). Quem não coube fica para a próxima volta.
 *
 * ?agente=<id> roda só aquele (se estiver devido ou ligado); com &forcar=1,
 * roda mesmo desligado ou fora de hora — para teste e para o suporte.
 *
 * ?simular=1 (com ou sem &agente=<id>): roda com os dados reais e devolve o
 * que o agente faria, SEM gravar, sem avisar ninguém e sem IA
 * (lib/agentes/simulacao.ts). Mesma senha do cron; não entra no diário.
 *
 * Sem a migração 110 no banco responde ok com "aguardando_migracao": o cron
 * fica verde e nada é gravado.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const agente = url.searchParams.get("agente")?.trim();
  const forcar = url.searchParams.get("forcar") === "1";

  if (url.searchParams.get("simular") === "1") {
    if (!cronAutorizado(request)) return Response.json({ erro: "Não autorizado." }, { status: 401 });
    const resultado = agente ? [await simularAgente(agente)] : await simularTodos({ limiteMs: 240_000 });
    return Response.json({ simulacao: true, resultado });
  }

  return rodarCron(request, "agentes", async () => {
    if (agente) {
      const rodada = await rodarAgente(agente, { forcar, limiteMs: 240_000 });
      return { situacao: rodada.status === "aguardando_migracao" ? "aguardando_migracao" : "ok", rodadas: [rodada] };
    }
    return rodarDevidos({ limiteMs: 240_000 });
  });
}
