import { obterDadosTarefas } from "./obter-dados-tarefas";
import {
  obterCacheTarefas,
  salvarCacheTarefas,
  precisaRegenerarTarefas,
} from "./cache-tarefas-inteligente";

export interface TarefaDiaria {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: "urgente" | "alta" | "média" | "baixa";
  icone: string;
  relacionamentoId?: string;
  estimativaMinutos?: number;
}

/** Obtém somente tarefas derivadas de dados reais do Supabase e da AURA. */
export async function obterTarefasInteligentes(
  usuarioId: string,
  cargo: string,
): Promise<{ tarefas: TarefaDiaria[]; synced: boolean; timestamp: string }> {
  try {
    const dados = await obterDadosTarefas(usuarioId);
    if (!dados) return { tarefas: [], synced: false, timestamp: new Date().toISOString() };

    const cache = obterCacheTarefas();
    if (cache && !precisaRegenerarTarefas(cache, dados)) {
      return { tarefas: cache.tarefas, synced: true, timestamp: new Date().toISOString() };
    }

    const response = await fetch("/api/gerar-tarefas-diarias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dados, cargo }),
    });
    if (!response.ok) return { tarefas: [], synced: false, timestamp: new Date().toISOString() };

    const result = await response.json();
    const tarefas: TarefaDiaria[] = Array.isArray(result.tarefas) ? result.tarefas : [];
    if (tarefas.length === 0) return { tarefas: [], synced: false, timestamp: new Date().toISOString() };

    salvarCacheTarefas(tarefas, dados);
    return { tarefas, synced: true, timestamp: new Date().toISOString() };
  } catch (erro) {
    console.error("AURA: erro ao gerar tarefas com dados reais", erro);
    return { tarefas: [], synced: false, timestamp: new Date().toISOString() };
  }
}

export async function regenerarTarefasForcar(
  usuarioId: string,
  cargo: string,
): Promise<{ tarefas: TarefaDiaria[]; synced: boolean; timestamp: string }> {
  const timestamp = new Date().toISOString();
  try {
    const dados = await obterDadosTarefas(usuarioId);
    if (!dados) return { tarefas: [], synced: false, timestamp };

    const response = await fetch("/api/gerar-tarefas-diarias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dados, cargo }),
    });
    if (!response.ok) return { tarefas: [], synced: false, timestamp };

    const result = await response.json();
    const tarefas: TarefaDiaria[] = Array.isArray(result.tarefas) ? result.tarefas : [];
    if (tarefas.length === 0) return { tarefas: [], synced: false, timestamp };

    salvarCacheTarefas(tarefas, dados);
    return { tarefas, synced: true, timestamp: new Date().toISOString() };
  } catch (erro) {
    console.error("AURA: erro ao regenerar tarefas com dados reais", erro);
    return { tarefas: [], synced: false, timestamp };
  }
}
