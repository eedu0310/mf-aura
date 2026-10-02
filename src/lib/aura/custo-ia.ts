/**
 * Controle de custo da IA.
 *
 * Toda chamada ao Claude devolve quantos tokens gastou. Aqui esse número é
 * guardado com o custo calculado, para o gestor ver quanto está gastando,
 * registrar depósitos e ser avisado antes do saldo acabar.
 *
 * O registro nunca derruba a funcionalidade: se falhar, apenas não anota.
 */
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export interface SaldoIA {
  depositado: number;
  gasto: number;
  saldo: number;
  alerta: number;
  bloquearSemSaldo: boolean;
  precoEntrada: number;
  precoSaida: number;
}

const g = globalThis as unknown as {
  __auraCustoCache?: { at: number; valor: SaldoIA };
};

const CACHE_MS = 60_000;

/** Preços e limites configurados pelo gestor (com padrão de fábrica). */
async function lerConfig() {
  const sb = getSupabaseServiceClient();
  if (!sb) return { preco_entrada_usd: 2, preco_saida_usd: 10, alerta_saldo_usd: 10, bloquear_sem_saldo: false };
  const { data } = await sb
    .from("ia_config")
    .select("preco_entrada_usd, preco_saida_usd, alerta_saldo_usd, bloquear_sem_saldo")
    .eq("id", true)
    .maybeSingle();
  return {
    preco_entrada_usd: Number(data?.preco_entrada_usd ?? 2),
    preco_saida_usd: Number(data?.preco_saida_usd ?? 10),
    alerta_saldo_usd: Number(data?.alerta_saldo_usd ?? 10),
    bloquear_sem_saldo: Boolean(data?.bloquear_sem_saldo),
  };
}

/** Quanto foi depositado, quanto já se gastou e o que sobra. */
export async function saldoIA(forcar = false): Promise<SaldoIA> {
  const cache = g.__auraCustoCache;
  if (!forcar && cache && Date.now() - cache.at < CACHE_MS) return cache.valor;

  const sb = getSupabaseServiceClient();
  const config = await lerConfig();

  let depositado = 0;
  let gasto = 0;

  if (sb) {
    const [{ data: creditos }, { data: usos }] = await Promise.all([
      sb.from("ia_creditos").select("valor_usd"),
      sb.from("ia_uso").select("custo_usd"),
    ]);
    depositado = (creditos ?? []).reduce((s, c: any) => s + Number(c.valor_usd ?? 0), 0);
    gasto = (usos ?? []).reduce((s, u: any) => s + Number(u.custo_usd ?? 0), 0);
  }

  const valor: SaldoIA = {
    depositado,
    gasto,
    saldo: depositado - gasto,
    alerta: config.alerta_saldo_usd,
    bloquearSemSaldo: config.bloquear_sem_saldo,
    precoEntrada: config.preco_entrada_usd,
    precoSaida: config.preco_saida_usd,
  };

  g.__auraCustoCache = { at: Date.now(), valor };
  return valor;
}

/**
 * Diz se a IA pode ser chamada agora.
 *
 * Só bloqueia quando o gestor pediu para bloquear E já existe algum depósito
 * registrado — assim quem ainda não usa o controle não fica sem IA por engano.
 */
export async function podeChamarIA(): Promise<boolean> {
  try {
    const s = await saldoIA();
    if (!s.bloquearSemSaldo) return true;
    if (s.depositado <= 0) return true;
    return s.saldo > 0;
  } catch {
    return true;
  }
}

/**
 * Multiplicadores do cache de prompt, conforme a tabela da Anthropic.
 * Escrita com TTL de 1 hora custa 2x o token de entrada; toda leitura do cache
 * custa 0,1x. É isso que torna o manual barato de repetir.
 */
const MULT_ESCRITA_CACHE = 2;    // usamos ttl de 1h no supervisor e no fechamento
const MULT_LEITURA_CACHE = 0.1;

/** Anota o consumo de uma chamada. Recebe o `usage` que o Claude devolve. */
export async function registrarUsoIA(dados: {
  funcao: string;
  modelo: string;
  uso?: {
    input_tokens?: number;
    output_tokens?: number;
    // O SDK devolve null (não undefined) quando a chamada não usou cache.
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  } | null;
  empresa?: string | null;
  usuarioId?: string | null;
}): Promise<void> {
  try {
    // ATENÇÃO: com cache de prompt ligado, input_tokens traz APENAS a parte que
    // não veio do cache. O que foi lido do cache vem em cache_read_input_tokens
    // e o que foi gravado em cache_creation_input_tokens. Somar só o primeiro
    // faria o manual cacheado sumir da conta, e o painel mostraria um custo
    // menor que a fatura real — justamente o número que o gestor usa para
    // decidir se a IA está cara.
    const entradaCrua = Number(dados.uso?.input_tokens ?? 0);
    const escritaCache = Number(dados.uso?.cache_creation_input_tokens ?? 0);
    const leituraCache = Number(dados.uso?.cache_read_input_tokens ?? 0);
    const saida = Number(dados.uso?.output_tokens ?? 0);

    // Guardamos o total lido pelo modelo, para o painel mostrar volume real.
    const entrada = entradaCrua + escritaCache + leituraCache;
    if (!entrada && !saida) return;

    const sb = getSupabaseServiceClient();
    if (!sb) return;

    const config = await lerConfig();
    // Cada fatia tem o seu preço: entrada normal 1x, escrita no cache 2x,
    // leitura do cache 0,1x.
    const custo =
      (entradaCrua / 1_000_000) * config.preco_entrada_usd +
      (escritaCache / 1_000_000) * config.preco_entrada_usd * MULT_ESCRITA_CACHE +
      (leituraCache / 1_000_000) * config.preco_entrada_usd * MULT_LEITURA_CACHE +
      (saida / 1_000_000) * config.preco_saida_usd;

    await sb.from("ia_uso").insert({
      empresa: dados.empresa ?? null,
      usuario_id: dados.usuarioId ?? null,
      funcao: dados.funcao,
      modelo: dados.modelo,
      tokens_entrada: entrada,
      tokens_saida: saida,
      custo_usd: Number(custo.toFixed(6)),
    });

    // O saldo mudou: força a releitura na próxima consulta.
    g.__auraCustoCache = undefined;
  } catch (e: any) {
    console.error("[custo-ia] não consegui anotar o consumo:", e?.message ?? e);
  }
}

/**
 * Anota por que a IA nao respondeu.
 *
 * Antes o motivo morria num arquivo de log dentro do servidor e o vendedor
 * so via "Nao consegui responder agora". Sem o motivo, o conserto vira
 * adivinhacao. Nunca derruba a chamada: se nem isso der certo, so nao anota.
 */
export async function registrarFalhaIA(dados: {
  funcao: string;
  erro: unknown;
  empresa?: string | null;
  usuarioId?: string | null;
  detalhe?: Record<string, unknown>;
}): Promise<void> {
  try {
    const e = dados.erro as { message?: string; status?: number; error?: unknown };
    const mensagem = String(e?.message ?? dados.erro ?? "erro sem mensagem").slice(0, 2000);

    const sb = getSupabaseServiceClient();
    if (!sb) {
      console.error(`[ia] ${dados.funcao} falhou:`, mensagem);
      return;
    }

    await sb.from("ia_falhas").insert({
      funcao: dados.funcao,
      usuario_id: dados.usuarioId ?? null,
      empresa: dados.empresa ?? null,
      mensagem,
      detalhe: {
        ...(dados.detalhe ?? {}),
        status: e?.status ?? null,
        corpo: e?.error ? JSON.parse(JSON.stringify(e.error)) : null,
      },
    });
  } catch (falha: any) {
    console.error("[custo-ia] nao consegui anotar a falha:", falha?.message ?? falha);
  }
}
