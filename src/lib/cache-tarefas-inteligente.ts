// lib/cache-tarefas-inteligente.ts
// Cache que detecta mudanças críticas e sincroniza com CRM

import { DadosTarefas } from "./obter-dados-tarefas";

export interface CacheTarefasInteligente {
  data: string; // ISO date YYYY-MM-DD
  hora: string; // HH:mm
  tarefas: any[];
  checksum: string; // Hash dos dados para detectar mudanças
  ultimosFolowUps: string[]; // IDs dos follow-ups naquele momento
  ultimasAtividades: string[]; // Nomes das atividades de hoje
  percentualMetaAoGerar: number; // % que estava quando gerou
}

const STORAGE_KEY = "aura_tarefas_inteligentes";
const INTERVALO_REGENERACAO = 60 * 60 * 1000; // 1 hora
const MINUTOS_ATUALIZAR = 30; // Atualizar se passou 30 min

/**
 * Calcula um checksum dos dados principais
 * Detecta mudanças críticas (novo follow-up, atividade concluída, meta mudou)
 */
function calcularChecksum(dados: DadosTarefas): string {
  const strDados = JSON.stringify({
    atividadesPendentesCount: dados.atividadesPendentes.length,
    atividadesHoje: dados.atividadesHoje.length,
    percentualMeta: dados.percentualMeta,
    faturamentoAtual: dados.faturamentoAtual,
    relacionamentosEmRisco: dados.relacionamentos.filter(
      (r) => r.diasSemContato > 14
    ).length,
  });

  // Simples hash
  let hash = 0;
  for (let i = 0; i < strDados.length; i++) {
    const char = strDados.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString();
}

/**
 * Obtém o cache de tarefas
 */
export function obterCacheTarefas(): CacheTarefasInteligente | null {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return null;

    const cache: CacheTarefasInteligente = JSON.parse(cached);
    const hoje = obterDataString(new Date());

    // Se o cache é de hoje, retornar
    if (cache.data === hoje) {
      return cache;
    }

    // Se é de outro dia, limpar
    localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch (erro) {
    console.error("Erro ao ler cache de tarefas:", erro);
    return null;
  }
}

/**
 * Salva as tarefas no cache
 */
export function salvarCacheTarefas(
  tarefas: any[],
  dados: DadosTarefas
): CacheTarefasInteligente {
  try {
    const agora = new Date();
    const cache: CacheTarefasInteligente = {
      data: obterDataString(agora),
      hora: obterHoraString(agora),
      tarefas,
      checksum: calcularChecksum(dados),
      ultimosFolowUps: dados.atividadesPendentes.map((f) => f.id),
      ultimasAtividades: dados.atividadesHoje.map((a) => a.nomeRelacionamento),
      percentualMetaAoGerar: dados.percentualMeta,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    return cache;
  } catch (erro) {
    console.error("Erro ao salvar cache de tarefas:", erro);
    return {
      data: obterDataString(new Date()),
      hora: obterHoraString(new Date()),
      tarefas,
      checksum: "",
      ultimosFolowUps: [],
      ultimasAtividades: [],
      percentualMetaAoGerar: 0,
    };
  }
}

/**
 * Detecta se as tarefas precisam ser regeneradas
 * Retorna verdadeiro se houver mudanças críticas
 */
export function precisaRegenerarTarefas(
  cache: CacheTarefasInteligente | null,
  dadosAtuais: DadosTarefas
): boolean {
  if (!cache) return true; // Sem cache, precisa gerar

  // Verificar se passou 1 hora
  const horaCache = new Date(`${cache.data}T${cache.hora}`);
  const agora = new Date();
  const minutoPassados = (agora.getTime() - horaCache.getTime()) / (1000 * 60);

  if (minutoPassados > INTERVALO_REGENERACAO / (1000 * 60)) {
    return true; // Passou 1 hora, regenerar
  }

  // Detectar mudanças críticas
  const checksumAtual = calcularChecksum(dadosAtuais);

  if (checksumAtual !== cache.checksum) {
    return true;
  }

  // Verificar se há novo follow-up
  const novoFollowUp = dadosAtuais.atividadesPendentes.some(
    (f) => !cache.ultimosFolowUps.includes(f.id)
  );

  if (novoFollowUp) {
    return true;
  }

  // Verificar se atividades foram concluídas
  const atividadesConcluidas = cache.ultimasAtividades.some(
    (nome) =>
      !dadosAtuais.atividadesHoje.some(
        (a) => a.nomeRelacionamento === nome
      )
  );

  if (atividadesConcluidas) {
    return true;
  }

  // Verificar se meta mudou significativamente
  const difencaPercentual = Math.abs(
    dadosAtuais.percentualMeta - cache.percentualMetaAoGerar
  );

  if (difencaPercentual > 5) {
    return true;
  }

  return false;
}

/**
 * Limpa o cache (para testes)
 */
export function limparCacheTarefas(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (erro) {
    console.error("Erro ao limpar cache:", erro);
  }
}

/**
 * Obtém a data atual como string (YYYY-MM-DD)
 */
function obterDataString(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/**
 * Obtém a hora atual como string (HH:mm)
 */
function obterHoraString(data: Date): string {
  const horas = String(data.getHours()).padStart(2, "0");
  const minutos = String(data.getMinutes()).padStart(2, "0");
  return `${horas}:${minutos}`;
}

/**
 * Reseta cache para próximo dia (para testes)
 */
export function resetarCacheTarefasParaTeste(): void {
  try {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        data: obterDataString(amanha),
        hora: obterHoraString(new Date()),
        tarefas: [],
        checksum: "",
        ultimosFolowUps: [],
        ultimasAtividades: [],
        percentualMetaAoGerar: 100,
      })
    );
  } catch (erro) {
    console.error("Erro ao resetar cache:", erro);
  }
}

/**
 * Retorna informações do cache (para debug)
 */
export function debugCacheTarefas() {
  const cache = obterCacheTarefas();
  if (!cache) {
    return;
  }

}
