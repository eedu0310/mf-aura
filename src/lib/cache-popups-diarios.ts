"use client";

const MOTIVACIONAL_KEY = "aura_motivacional_mostrado";
const TAREFAS_KEY = "aura_tarefas_mostrado";

function obterDataString(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function foiMotivacionalMostrado(): boolean {
  try {
    const dados = localStorage.getItem(MOTIVACIONAL_KEY);
    if (!dados) return false;
    const { data } = JSON.parse(dados);
    return data === obterDataString(new Date());
  } catch {
    return false;
  }
}

export function marcarMotivacionalMostrado(): void {
  try {
    localStorage.setItem(
      MOTIVACIONAL_KEY,
      JSON.stringify({ data: obterDataString(new Date()) })
    );
  } catch (erro) {
    console.error("Erro ao marcar motivacional:", erro);
  }
}

export function foiTarefasMostrado(): boolean {
  try {
    const dados = localStorage.getItem(TAREFAS_KEY);
    if (!dados) return false;
    const { data } = JSON.parse(dados);
    return data === obterDataString(new Date());
  } catch {
    return false;
  }
}

export function marcarTarefasMostrado(): void {
  try {
    localStorage.setItem(
      TAREFAS_KEY,
      JSON.stringify({ data: obterDataString(new Date()) })
    );
  } catch (erro) {
    console.error("Erro ao marcar tarefas:", erro);
  }
}

export function limparCachePopups(): void {
  try {
    localStorage.removeItem(MOTIVACIONAL_KEY);
    localStorage.removeItem(TAREFAS_KEY);
  } catch (erro) {
    console.error("Erro ao limpar cache:", erro);
  }
}