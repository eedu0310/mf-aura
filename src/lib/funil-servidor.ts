import type { SupabaseClient } from "@supabase/supabase-js";
import { daLinha, FUNIL_PADRAO, type EtapaFunil } from "@/lib/funil";

/**
 * O funil da loja, lido do banco e lembrado por cinco minutos.
 *
 * O funil é consultado em quase toda operação — cada análise de conversa,
 * cada card movido, cada relatório. Ir ao banco toda vez seria uma consulta a
 * mais em cima de cada uma dessas, para buscar oito linhas que mudam quando o
 * gestor mexe na tela, ou seja: quase nunca. Cinco minutos é o preço: mudar o
 * funil demora até isso para valer no servidor.
 */
const TTL = 5 * 60 * 1000;

const g = globalThis as unknown as {
  __auraFunil?: Map<string, { em: number; funil: EtapaFunil[] }>;
};
const cache = (g.__auraFunil ??= new Map());

export async function carregarFunil(
  sb: SupabaseClient | null | undefined,
  empresa: string | null | undefined,
): Promise<EtapaFunil[]> {
  const chave = empresa ?? "";
  const lembrado = cache.get(chave);
  if (lembrado && Date.now() - lembrado.em < TTL) return lembrado.funil;

  if (!sb || !empresa) return FUNIL_PADRAO;

  try {
    const { data, error } = await sb
      .from("etapas_funil")
      .select("nome, ordem, tipo, conta_no_pipeline, probabilidade, cor, ativa, chave")
      .eq("empresa", empresa)
      .order("ordem");

    /**
     * Erro de leitura NÃO pode virar funil padrão guardado por cinco minutos.
     * O cliente Supabase não lança exceção: antes o erro caía no `data` nulo,
     * o código entendia "loja sem funil", gravava o FUNIL_PADRAO no cache e
     * durante cinco minutos o servidor inteiro trabalhava com as etapas
     * erradas — etiqueta errada no WhatsApp, card na coluna errada. Agora o
     * erro devolve o último funil bom (ou o padrão) sem gravar nada, então a
     * chamada seguinte tenta de novo.
     */
    if (error) {
      console.error("Não consegui ler o funil de", empresa, error.message);
      return lembrado?.funil ?? FUNIL_PADRAO;
    }

    /**
     * Loja sem funil próprio usa o padrão em vez de ficar sem etapa nenhuma.
     * Um pipeline vazio faria o vendedor achar que perdeu os negócios.
     */
    const funil = data?.length ? data.map(daLinha) : FUNIL_PADRAO;
    cache.set(chave, { em: Date.now(), funil });
    return funil;
  } catch (e) {
    console.error("Não consegui ler o funil de", empresa, e);
    return lembrado?.funil ?? FUNIL_PADRAO;
  }
}

/** Chamado quando o gestor salva o funil, para a mudança valer na hora. */
export function esquecerFunil(empresa?: string) {
  if (empresa) cache.delete(empresa);
  else cache.clear();
}
