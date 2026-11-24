import type { SupabaseClient } from "@supabase/supabase-js";
import { sentinelaDeOperacao } from "./operacao";
import { sentinelaDeDados } from "./dados";
import { sentinelaDeSeguranca } from "./seguranca";
import { inicioDoDiaEmSaoPaulo } from "@/lib/fuso";
import {
  NOMES_DAS_SENTINELAS,
  type Achado,
  type NomeSentinela,
  type ResultadoSentinela,
} from "./tipos";

export * from "./tipos";

interface RodadaAnterior {
  sentinela: NomeSentinela;
  criado_em: string;
  nivel: string;
  resumo: string | null;
  achados: Array<Achado & { memoria?: unknown }>;
  memoria: Record<string, unknown> | null;
}

/** A última rodada gravada de cada sentinela. */
export async function ultimasRodadas(sb: SupabaseClient): Promise<Map<NomeSentinela, RodadaAnterior>> {
  const { data } = await sb
    .from("aura_sentinela")
    .select("sentinela, criado_em, nivel, achados, resumo")
    .order("criado_em", { ascending: false })
    .limit(60);
  const mapa = new Map<NomeSentinela, RodadaAnterior>();
  for (const linha of data ?? []) {
    const nome = linha.sentinela as NomeSentinela;
    if (mapa.has(nome)) continue;
    // A memória viaja dentro de `achados`, num item marcado, para não exigir
    // coluna nova a cada número que uma sentinela queira lembrar.
    const lista = (linha.achados ?? []) as Array<Achado & { memoria?: Record<string, unknown> }>;
    const memoria = lista.find((a) => a.memoria)?.memoria ?? null;
    mapa.set(nome, {
      sentinela: nome,
      criado_em: linha.criado_em,
      nivel: linha.nivel,
      resumo: linha.resumo ?? null,
      achados: lista.filter((a) => !a.memoria),
      memoria,
    });
  }
  return mapa;
}

/**
 * Roda as três sentinelas, grava o resultado e avisa os gestores mestres.
 *
 * Aviso só do que é NOVO: na primeira rodada do dia avisa tudo que não está
 * ok; nas seguintes, só achados que não estavam na rodada anterior. Assim o
 * gestor recebe um resumo pela manhã e um alerta se algo quebrar à tarde,
 * sem o sino tocando o dia inteiro pelo mesmo problema.
 */
export async function rodarSentinelas(sb: SupabaseClient, agora = new Date()) {
  const anteriores = await ultimasRodadas(sb);

  // Faxina dos próprios diários: o repasse de leads roda a cada 5 minutos e
  // grava ~288 linhas por dia em aura_execucoes_cron. A sentinela só olha 9
  // dias para trás; 30 dias de diário e 90 de rodadas bastam.
  const dias = (n: number) => new Date(agora.getTime() - n * 86_400_000).toISOString();
  await sb.from("aura_execucoes_cron").delete().lt("inicio", dias(30));
  await sb.from("aura_sentinela").delete().lt("criado_em", dias(90));

  const resultados: ResultadoSentinela[] = [];
  const tarefas: Array<[NomeSentinela, () => Promise<ResultadoSentinela>]> = [
    ["operacao", () => sentinelaDeOperacao(sb, agora)],
    ["dados", () => sentinelaDeDados(sb, agora)],
    ["seguranca", () => sentinelaDeSeguranca(sb, anteriores.get("seguranca")?.memoria ?? null, agora)],
  ];
  for (const [nome, rodar] of tarefas) {
    try {
      resultados.push(await rodar());
    } catch (e) {
      // Uma sentinela quebrada é, ela mesma, um achado: não pode sumir calada.
      resultados.push({
        sentinela: nome,
        nivel: "atencao",
        achados: [{
          nivel: "atencao",
          titulo: `${NOMES_DAS_SENTINELAS[nome]} não conseguiu rodar`,
          detalhe: e instanceof Error ? e.message : String(e),
        }],
        resumo: "A checagem falhou.",
      });
    }
  }

  // Grava cada rodada.
  const { error: erroGravar } = await sb.from("aura_sentinela").insert(
    resultados.map((r) => ({
      sentinela: r.sentinela,
      nivel: r.nivel,
      achados: r.memoria ? [...r.achados, { memoria: r.memoria }] : r.achados,
      resumo: r.resumo,
    })),
  );
  if (erroGravar) console.error("[sentinela] não gravei a rodada:", erroGravar.message);

  // O que é novo desde a rodada anterior?
  const inicioDoDia = inicioDoDiaEmSaoPaulo(agora);
  const novos: Array<{ sentinela: NomeSentinela; achado: Achado }> = [];
  for (const r of resultados) {
    const anterior = anteriores.get(r.sentinela);
    const primeiraDoDia = !anterior || anterior.criado_em < inicioDoDia;
    const titulosAntes = new Set((anterior?.achados ?? []).map((a) => a.titulo));
    for (const a of r.achados) {
      if (primeiraDoDia || !titulosAntes.has(a.titulo)) novos.push({ sentinela: r.sentinela, achado: a });
    }
  }

  const avisados = novos.length ? await avisarMestres(sb, novos) : 0;
  return {
    resultados: resultados.map((r) => ({ sentinela: r.sentinela, nivel: r.nivel, achados: r.achados.length })),
    novos: novos.length,
    avisados,
  };
}

async function avisarMestres(
  sb: SupabaseClient,
  novos: Array<{ sentinela: NomeSentinela; achado: Achado }>,
): Promise<number> {
  const { data: mestres } = await sb
    .from("profiles")
    .select("id")
    .eq("gestor_mestre", true)
    .eq("gestor_aprovado", true)
    .eq("ativo", true)
    .is("excluido_em", null);
  if (!mestres?.length) return 0;

  const criticos = novos.filter((n) => n.achado.nivel === "critico");
  const titulo = criticos.length
    ? `Saúde do sistema: ${criticos.length} problema(s) crítico(s)`
    : `Saúde do sistema: ${novos.length} ponto(s) de atenção`;
  const mensagem = novos
    .slice(0, 6)
    .map((n) => `${n.achado.nivel === "critico" ? "🔴" : "🟡"} ${n.achado.titulo}`)
    .join(" · ")
    .concat(novos.length > 6 ? ` · e mais ${novos.length - 6}` : "");

  const { error } = await sb.from("notificacoes").insert(
    mestres.map((m) => ({
      vendedor_id: m.id,
      titulo,
      mensagem,
      tipo: "sistema",
      acao_url: "/gestor?aba=saude",
    })),
  );
  if (error) {
    console.error("[sentinela] não avisei os mestres:", error.message);
    return 0;
  }
  return mestres.length;
}
