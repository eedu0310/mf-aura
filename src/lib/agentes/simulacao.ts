/**
 * SIMULAÇÃO de um agente: roda com os dados reais e mostra o que ele faria,
 * sem gravar nada, sem avisar ninguém e sem gastar IA.
 *
 * Por que existe: o banco é o mesmo da AURA que está no ar. Rodar um agente
 * "de verdade" já cria recomendações e avisos para a equipe. Antes de ligar
 * a equipe (e sempre que um agente mudar), dá para conferir aqui se ele acha
 * as coisas certas — e quantas.
 *
 * Como garante que nada é gravado: o agente recebe um cliente do banco SÓ DE
 * LEITURA. O select passa; insert/update/upsert/delete viram uma resposta
 * vazia sem tocar no banco; o storage e o rpc ficam bloqueados. A IA devolve
 * sempre "sem IA" (o agente segue só com as regras, como faria sem saldo).
 * A caixa de entrada é lida, mas não é marcada como lida.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { diaEmSaoPaulo } from "@/lib/fuso";
import { carregarRegistro, temMigracao108 } from "./motor";
import { DIRETORA } from "./diretora";
import type { Achado, ContextoAgente, MensagemEscritorio, ResultadoAgente } from "./tipos";

const ESCRITAS = new Set(["insert", "update", "upsert", "delete"]);

/**
 * Funções do banco que só LEEM (conferido no corpo de cada uma): passam na
 * simulação. Qualquer outra rpc continua bloqueada — pode gravar.
 * São as que o Caçador de Brechas usa para olhar RLS, políticas e esquema.
 */
const RPCS_SO_LEITURA = new Set(["aura_tabelas_sem_rls", "aura_politicas_abertas", "aura_esquema_ddl"]);

/** Um "builder" que aceita qualquer encadeamento e termina vazio, sem rede. */
function escritaIgnorada(registrar: (o: string) => void, operacao: string): unknown {
  registrar(operacao);
  const resposta = { data: [], error: null, count: 0, status: 200, statusText: "simulacao" };
  const alvo = function () {} as unknown as Record<string, unknown>;
  const proxy: unknown = new Proxy(alvo, {
    get(_, prop) {
      if (prop === "then") return (ok: (v: unknown) => unknown) => Promise.resolve(resposta).then(ok);
      if (prop === "catch" || prop === "finally") return (f: () => unknown) => Promise.resolve(resposta).then(() => f?.());
      return () => proxy;
    },
    apply() {
      return proxy;
    },
  });
  return proxy;
}

/** Cliente do banco só de leitura (ver o cabeçalho). */
export function clienteSoLeitura(sb: SupabaseClient, registrar: (o: string) => void): SupabaseClient {
  return new Proxy(sb, {
    get(alvo, prop, receptor) {
      if (prop === "from") {
        return (tabela: string) => {
          const builder = alvo.from(tabela);
          return new Proxy(builder, {
            get(b, metodo, r) {
              if (typeof metodo === "string" && ESCRITAS.has(metodo)) {
                return () => escritaIgnorada(registrar, `${metodo} em ${tabela}`);
              }
              const v = Reflect.get(b, metodo, r);
              return typeof v === "function" ? v.bind(b) : v;
            },
          });
        };
      }
      if (prop === "storage") {
        return { from: () => new Proxy({}, { get: (_, m) => () => (registrar(`storage.${String(m)}`), Promise.resolve({ data: null, error: { message: "simulação: storage bloqueado" } })) }) };
      }
      if (prop === "rpc") {
        return (nome: string, ...resto: unknown[]) => {
          if (RPCS_SO_LEITURA.has(nome)) return (alvo.rpc as (...a: unknown[]) => unknown).call(alvo, nome, ...resto);
          registrar(`rpc ${nome}`);
          return Promise.resolve({ data: null, error: { message: "simulação: rpc bloqueado" } });
        };
      }
      const v = Reflect.get(alvo, prop, receptor);
      return typeof v === "function" ? v.bind(alvo) : v;
    },
  }) as SupabaseClient;
}

export interface ResultadoSimulacao {
  agente: string;
  nome?: string;
  status: "ok" | "erro" | "ignorado" | "aguardando_migracao";
  resumo?: string;
  erro?: string;
  duracaoMs?: number;
  achados?: number;
  porPrioridade?: Record<string, number>;
  pessoas?: number;
  porLoja?: Record<string, number>;
  exemplos?: Array<Pick<Achado, "titulo" | "descricao" | "prioridade" | "empresa">>;
  mensagens?: Array<Pick<MensagemEscritorio, "para" | "tipo" | "texto">>;
  aprendizados?: number;
  propostas?: string[];
  metricas?: Record<string, number>;
  /** Escritas que o agente tentou fazer e a simulação ignorou. */
  escritasIgnoradas?: string[];
}

export async function simularAgente(id: string, opcoes: { agora?: Date; limiteMs?: number } = {}): Promise<ResultadoSimulacao> {
  const real = getSupabaseServiceClient();
  if (!real) throw new Error("Supabase não configurado.");
  if (!(await temMigracao108(real))) return { agente: id, status: "aguardando_migracao" };

  const registro = await carregarRegistro(real, true);
  const def = registro.find((a) => a.id === id);
  if (!def) return { agente: id, status: "erro", erro: "Agente desconhecido." };
  if (typeof def.executar !== "function") return { agente: id, nome: def.nome, status: "ignorado", resumo: "Rotina do sistema ou sem configuração." };

  const escritas: string[] = [];
  const sb = clienteSoLeitura(real, (o) => escritas.push(o));
  const agora = opcoes.agora ?? new Date();
  const ctx: ContextoAgente = {
    sb,
    agora,
    hoje: diaEmSaoPaulo(agora),
    agente: id,
    ia: async () => null,
    caixaDeEntrada: async () => {
      let consulta = real
        .from("aura_escritorio_mensagens")
        .select("id, de_agente, para_agente, tipo, texto, empresa, dados, criado_em")
        .eq("lida_por_agente", false)
        .neq("de_agente", id)
        .order("criado_em", { ascending: true })
        .limit(50);
      consulta = id === DIRETORA.id ? consulta.or(`para_agente.is.null,para_agente.eq.${id}`) : consulta.eq("para_agente", id);
      const { data } = await consulta;
      return (data ?? []).map((m) => ({
        id: m.id as string,
        criadoEm: m.criado_em as string,
        de: m.de_agente as string,
        para: (m.para_agente as string | null) ?? undefined,
        tipo: m.tipo as MensagemEscritorio["tipo"],
        texto: m.texto as string,
      }));
    },
    log: () => {},
  };

  const inicio = Date.now();
  let r: ResultadoAgente;
  try {
    r = await Promise.race([
      def.executar(ctx),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("passou do tempo")), opcoes.limiteMs ?? 120_000)),
    ]);
  } catch (e) {
    return { agente: id, nome: def.nome, status: "erro", erro: e instanceof Error ? e.message : String(e), escritasIgnoradas: escritas };
  }

  const achados = r.achados ?? [];
  const contar = (f: (a: Achado) => string) =>
    achados.reduce<Record<string, number>>((acc, a) => ((acc[f(a)] = (acc[f(a)] ?? 0) + 1), acc), {});
  return {
    agente: id,
    nome: def.nome,
    status: "ok",
    resumo: r.resumo,
    duracaoMs: Date.now() - inicio,
    achados: achados.length,
    porPrioridade: contar((a) => a.prioridade),
    pessoas: new Set(achados.map((a) => a.destinatarioId)).size,
    porLoja: contar((a) => a.empresa),
    exemplos: achados.slice(0, 4).map((a) => ({ titulo: a.titulo, descricao: a.descricao, prioridade: a.prioridade, empresa: a.empresa })),
    mensagens: (r.mensagens ?? []).slice(0, 4).map((m) => ({ para: m.para, tipo: m.tipo, texto: m.texto })),
    aprendizados: r.aprendizados?.length ?? 0,
    propostas: (r.propostas ?? []).map((p) => p.nome),
    metricas: r.metricas,
    escritasIgnoradas: escritas,
  };
}

/** Simula todos os agentes que têm executar (um de cada vez). */
export async function simularTodos(opcoes: { limiteMs?: number } = {}): Promise<ResultadoSimulacao[]> {
  const real = getSupabaseServiceClient();
  if (!real) throw new Error("Supabase não configurado.");
  const registro = await carregarRegistro(real, await temMigracao108(real));
  const saida: ResultadoSimulacao[] = [];
  const fim = Date.now() + (opcoes.limiteMs ?? 240_000);
  for (const def of registro) {
    if (typeof def.executar !== "function") continue;
    if (Date.now() > fim) {
      saida.push({ agente: def.id, nome: def.nome, status: "ignorado", resumo: "Ficou para a próxima (tempo)." });
      continue;
    }
    saida.push(await simularAgente(def.id, { limiteMs: Math.min(120_000, fim - Date.now()) }));
  }
  return saida;
}
