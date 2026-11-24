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
import { todasAsLinhas } from "@/lib/supabase/todas-as-linhas";
import { inicioDoDiaEmSaoPaulo, inicioDoMesEmSaoPaulo } from "@/lib/fuso";

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

export interface TotaisIA {
  gastoTotal: number;
  gastoHoje: number;
  gastoMes: number;
  chamadasHoje: number;
  depositado: number;
  /**
   * Gasto a partir do PRIMEIRO depósito registrado — é este que abate do
   * saldo. O ia_uso tem gasto desde setembro, pago com crédito que nunca foi
   * lançado aqui; contar tudo zeraria o saldo e, com o bloqueio ligado,
   * desligaria a AURA no minuto seguinte à correção da soma.
   */
  gastoDesdeDeposito: number;
}

/**
 * Somas do consumo da IA, feitas NO BANCO (função aura_ia_totais, migração
 * 105).
 *
 * Antes a soma era feita aqui, em cima de `select custo_usd from ia_uso` — e o
 * Supabase devolve no máximo 1000 linhas sem avisar. Com 21 mil chamadas
 * registradas, o "gasto total" era o das últimas mil: o saldo parecia sobrar,
 * o bloqueio por falta de saldo nunca disparava e o painel subestimava a
 * conta (auditoria de 24/11/2026).
 *
 * Se a migração ainda não foi aplicada, cai na leitura paginada: mais lenta,
 * mas com o número certo.
 */
export async function totaisIA(agora: Date = new Date()): Promise<TotaisIA> {
  const sb = getSupabaseServiceClient();
  const vazio: TotaisIA = {
    gastoTotal: 0, gastoHoje: 0, gastoMes: 0, chamadasHoje: 0, depositado: 0, gastoDesdeDeposito: 0,
  };
  if (!sb) return vazio;

  const inicioDia = inicioDoDiaEmSaoPaulo(agora);
  const inicioMes = inicioDoMesEmSaoPaulo(agora);

  const { data, error } = await sb.rpc("aura_ia_totais", {
    p_inicio_dia: inicioDia,
    p_inicio_mes: inicioMes,
  });
  const linha = Array.isArray(data) ? data[0] : data;
  if (!error && linha) {
    return {
      gastoTotal: Number(linha.gasto_total ?? 0),
      gastoHoje: Number(linha.gasto_hoje ?? 0),
      gastoMes: Number(linha.gasto_mes ?? 0),
      chamadasHoje: Number(linha.chamadas_hoje ?? 0),
      depositado: Number(linha.depositado ?? 0),
      gastoDesdeDeposito: Number(linha.gasto_desde_deposito ?? 0),
    };
  }

  // Plano B: sem a função no banco, soma tudo página por página.
  const [usos, creditos] = await Promise.all([
    todasAsLinhas<{ custo_usd: number; criado_em: string }>((de, ate) =>
      sb.from("ia_uso").select("custo_usd, criado_em").order("id").range(de, ate),
    ),
    todasAsLinhas<{ valor_usd: number; criado_em: string }>((de, ate) =>
      sb.from("ia_creditos").select("valor_usd, criado_em").order("id").range(de, ate),
    ),
  ]);
  const t = { ...vazio };
  const primeiroDeposito = creditos.reduce<string | null>(
    (min, c) => (min === null || c.criado_em < min ? c.criado_em : min),
    null,
  );
  for (const u of usos) {
    const custo = Number(u.custo_usd ?? 0);
    t.gastoTotal += custo;
    if (primeiroDeposito && u.criado_em >= primeiroDeposito) t.gastoDesdeDeposito += custo;
    if (u.criado_em >= inicioMes) t.gastoMes += custo;
    if (u.criado_em >= inicioDia) {
      t.gastoHoje += custo;
      t.chamadasHoje += 1;
    }
  }
  t.depositado = creditos.reduce((s, c) => s + Number(c.valor_usd ?? 0), 0);
  return t;
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
    const totais = await totaisIA();
    depositado = totais.depositado;
    gasto = totais.gastoDesdeDeposito;
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
 *
 * Escrita com o TTL PADRÃO (5 minutos) custa 1,25x o token de entrada; só o
 * TTL estendido de 1 hora custa 2x. O sistema inteiro usa o padrão — o
 * supervisor largou o "1h" quando se descobriu que ele nem valia sem o
 * cabeçalho de beta (ver supervisor.ts) —, mas esta conta continuava em 2x e
 * inflava toda escrita de cache em 60% (auditoria de 24/11/2026).
 *
 * A leitura do cache custa 0,1x na maioria dos modelos; os da geração 5.5
 * cobram menos (ver PRECO_POR_MODELO).
 */
const MULT_ESCRITA_CACHE = 1.25;
const MULT_LEITURA_CACHE = 0.1;

/**
 * Preço por modelo, em dólar por milhão de tokens.
 *
 * O preço era UM SÓ para o sistema inteiro — e o sistema usa dois modelos. O
 * Haiku faz 94% das chamadas (supervisor do WhatsApp e recados) e custa a
 * metade do que estava configurado. Resultado: o painel mostrava cerca do
 * DOBRO do gasto real, que é justamente o número que o gestor olha para
 * decidir se a IA está cara.
 *
 * A tabela abaixo é o preço de tabela da Anthropic. O que o gestor configurar
 * em ia_config continua valendo como PADRÃO para modelo que não esteja aqui —
 * assim um modelo novo nunca passa a custar zero por engano.
 */
//
// Conferida em 24/11/2026: o Sonnet 5 estava a 3/15 e o Opus 5 a 15/75 (os
// preços de gerações antigas); os certos são 2/10 e 5/25.
//
// A ORDEM IMPORTA: a busca é pelo começo do nome, então "claude-sonnet-5-5"
// precisa vir antes de "claude-sonnet-5", senão o 5.5 pegaria o preço do 5.
// `leitura` é o preço da releitura do cache, quando foge do 0,1x padrão.
const PRECO_POR_MODELO: Record<string, { entrada: number; saida: number; leitura?: number }> = {
  "claude-haiku-5-5": { entrada: 0.1, saida: 0.5 },
  "claude-haiku-4-5": { entrada: 1, saida: 5 },
  "claude-sonnet-5-5": { entrada: 2, saida: 10, leitura: 0.1 },
  "claude-sonnet-5": { entrada: 2, saida: 10 },
  "claude-opus-5-5": { entrada: 4, saida: 20, leitura: 0.2 },
  "claude-opus-5": { entrada: 5, saida: 25 },
};

/**
 * Acha o preço do modelo pelo começo do nome, porque o identificador vem com
 * data colada no fim ("claude-haiku-4-5-20251001") e amanhã vem com outra.
 * Sem isto, toda atualização de versão silenciosamente voltaria ao preço
 * genérico — o erro que esta função existe para consertar.
 */
function precoDoModelo(
  modelo: string,
  padrao: { entrada: number; saida: number },
): { entrada: number; saida: number; leitura?: number } {
  const m = (modelo ?? "").toLowerCase();
  for (const [chave, preco] of Object.entries(PRECO_POR_MODELO)) {
    if (m.startsWith(chave)) return preco;
  }
  return padrao;
}

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
    // O preço é DO MODELO que atendeu esta chamada, não um preço só para o
    // sistema inteiro. O que o gestor configurou vale como padrão para modelo
    // desconhecido.
    const preco = precoDoModelo(dados.modelo, {
      entrada: config.preco_entrada_usd,
      saida: config.preco_saida_usd,
    });
    // Cada fatia tem o seu preço: entrada normal 1x, escrita no cache 1,25x,
    // leitura do cache 0,1x (ou o preço próprio do modelo).
    const precoLeitura = preco.leitura ?? preco.entrada * MULT_LEITURA_CACHE;
    const custo =
      (entradaCrua / 1_000_000) * preco.entrada +
      (escritaCache / 1_000_000) * preco.entrada * MULT_ESCRITA_CACHE +
      (leituraCache / 1_000_000) * precoLeitura +
      (saida / 1_000_000) * preco.saida;

    await sb.from("ia_uso").insert({
      empresa: dados.empresa ?? null,
      usuario_id: dados.usuarioId ?? null,
      funcao: dados.funcao,
      modelo: dados.modelo,
      tokens_entrada: entrada,
      tokens_saida: saida,
      /**
       * As três fatias separadas, não só o total.
       *
       * O total sozinho diz quanto se gastou, mas não por quê: entrada crua
       * custa 1x, escrita no cache custa 1,25x e leitura do cache custa 0,1x.
       * Guardando separado dá para ver se o cache está sendo APROVEITADO ou
       * só reescrito — que é a diferença entre pagar um décimo e pagar o
       * dobro pelo mesmo manual.
       */
      tokens_entrada_crua: entradaCrua,
      tokens_cache_escrita: escritaCache,
      tokens_cache_leitura: leituraCache,
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
