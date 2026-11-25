/**
 * Há quantos dias um negócio está parado.
 *
 * ANTES: a coluna `oportunidades.dias_parado` era lida em todo lugar — "negócios
 * parados" do gestor, o supervisor da AURA (≥ 7 e ≥ 14 dias), o raio-x, o
 * coach — mas nada a mantinha. Estava em 0 nas 494 linhas. Resultado: nenhum
 * negócio jamais aparecia como parado, por mais esquecido que estivesse.
 *
 * AGORA o número é calculado na hora, do que de fato aconteceu: o mais
 * recente entre a última alteração do negócio (updated_at) e a última
 * atividade registrada com o cliente, quando ela está à mão. A coluna fica
 * onde está (o WhatsApp ainda grava 0 nela ao mover), mas ninguém decide nada
 * por ela.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";

/** A partir de quantos dias sem movimento o negócio conta como parado. */
export const DIAS_PARA_PARADO = 7;

const DIA_MS = 86_400_000;

function instante(valor: string | Date | null | undefined): number | null {
  if (!valor) return null;
  const t = valor instanceof Date ? valor.getTime() : Date.parse(valor);
  return Number.isFinite(t) ? t : null;
}

/**
 * Dias inteiros desde a data MAIS RECENTE da lista. Datas vazias ou inválidas
 * são ignoradas; sem nenhuma data válida, 0 (não acusa parado o que não se
 * sabe). Data no futuro também dá 0.
 */
export function diasParado(
  datas: Array<string | Date | null | undefined>,
  agora: Date = new Date(),
): number {
  let maisRecente: number | null = null;
  for (const d of datas) {
    const t = instante(d);
    if (t !== null && (maisRecente === null || t > maisRecente)) maisRecente = t;
  }
  if (maisRecente === null) return 0;
  return Math.max(0, Math.floor((agora.getTime() - maisRecente) / DIA_MS));
}

/** Atalho para uma linha de `oportunidades` como vem do banco. */
export function diasParadoDaLinha(
  linha: { updated_at?: string | null; created_at?: string | null },
  ultimaAtividadeEm?: string | null,
  agora: Date = new Date(),
): number {
  return diasParado([linha.updated_at, linha.created_at, ultimaAtividadeEm], agora);
}

/** A atividade mais recente de cada cliente (relacionamento). */
export function ultimaAtividadePorRelacionamento(
  atividades: { relacionamento_id?: string | null; ocorrida_em?: string | null; created_at?: string | null }[],
): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const a of atividades) {
    if (!a.relacionamento_id) continue;
    const quando = a.ocorrida_em ?? a.created_at;
    const t = instante(quando);
    if (!quando || t === null) continue;
    const atual = mapa.get(a.relacionamento_id);
    if (!atual || t > (instante(atual) ?? 0)) mapa.set(a.relacionamento_id, quando);
  }
  return mapa;
}

/**
 * Lê no banco a última atividade de cada cliente da lista (servidor).
 *
 * Olha só os últimos `janelaDias` dias: atividade mais velha que isso não
 * muda a conclusão de que o negócio está parado. Em blocos de 150 ids, para a
 * URL do filtro não estourar, e de mil em mil linhas (todasAsLinhas).
 * Falhou a leitura? Devolve o que tiver — o cálculo cai no updated_at.
 */
export async function buscarUltimaAtividade(
  sb: SupabaseClient,
  relacionamentoIds: (string | null | undefined)[],
  janelaDias = 120,
): Promise<Map<string, string>> {
  const ids = [...new Set(relacionamentoIds.filter((x): x is string => !!x))];
  const desde = new Date(Date.now() - janelaDias * DIA_MS).toISOString();
  const linhas: { relacionamento_id: string | null; ocorrida_em: string | null }[] = [];
  try {
    for (let i = 0; i < ids.length; i += 150) {
      const bloco = ids.slice(i, i + 150);
      linhas.push(
        ...(await todasAsLinhas<{ relacionamento_id: string | null; ocorrida_em: string | null }>((de, ate) =>
          sb
            .from("atividades")
            .select("relacionamento_id, ocorrida_em")
            .in("relacionamento_id", bloco)
            .gte("ocorrida_em", desde)
            .order("id")
            .range(de, ate),
        )),
      );
    }
  } catch (e) {
    console.error("[oportunidade-parada] última atividade:", e);
  }
  return ultimaAtividadePorRelacionamento(linhas);
}
