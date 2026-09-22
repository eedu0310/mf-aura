import type { Relacionamento } from "@/lib/types";

export interface TarefaPendente {
  id: string;
  titulo: string;
  quando: string;
  urgente: boolean;
}

/**
 * Deriva uma lista de tarefas reais a partir dos relacionamentos que
 * precisam de contato (atrasados, marcados para hoje, ou esfriando).
 * Não é uma lista fixa — muda conforme o CRM muda.
 */
export function computePendingTasks(relacionamentos: Relacionamento[]): TarefaPendente[] {
  const atrasados = relacionamentos
    .filter((r) => r.proximoContato.toLowerCase().includes("atrasado"))
    .map((r) => ({
      id: r.id,
      titulo: `Follow-up · ${r.nome}`,
      quando: "Atrasado",
      urgente: true,
    }));

  const hoje = relacionamentos
    .filter((r) => r.proximoContato.toLowerCase().includes("hoje"))
    .map((r) => ({
      id: r.id,
      titulo: `Follow-up · ${r.nome}`,
      quando: "Hoje",
      urgente: false,
    }));

  const esfriando = relacionamentos
    .filter(
      (r) =>
        (r.temperatura === "esfriando" || r.temperatura === "frio") &&
        !r.proximoContato.toLowerCase().includes("atrasado") &&
        !r.proximoContato.toLowerCase().includes("hoje")
    )
    .map((r) => ({
      id: r.id,
      titulo: `Retomar contato · ${r.nome}`,
      quando: "Esfriando",
      urgente: false,
    }));

  return [...atrasados, ...hoje, ...esfriando].slice(0, 6);
}
