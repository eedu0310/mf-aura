import type { Relacionamento } from "@/lib/types";
import { diaEmSaoPaulo } from "@/lib/fuso";

/*
 * Atrasado / hoje pela DATA marcada (proximoContatoEm), no dia de São Paulo —
 * a mesma conta do cartão "Follow-ups vencidos" do Meu Dia. Antes procurava
 * as palavras "atrasado"/"hoje" no texto do próximo contato, que não é mais
 * escrito assim: o painel nunca listava follow-up nenhum.
 */
function diaMarcado(r: Relacionamento): string {
  return (r.proximoContatoEm ?? "").slice(0, 10)
    ? diaEmSaoPaulo(new Date(r.proximoContatoEm as string))
    : "";
}

export interface TarefaPendente {
  id: string;
  titulo: string;
  quando: string;
  urgente: boolean;
  /** Para onde o aviso leva. Sem isto, abre o cliente pelo nome. */
  href?: string;
}

/**
 * Deriva uma lista de tarefas reais a partir dos relacionamentos que
 * precisam de contato (atrasados, marcados para hoje, ou esfriando).
 * Não é uma lista fixa — muda conforme o CRM muda.
 */
export function computePendingTasks(relacionamentos: Relacionamento[]): TarefaPendente[] {
  const hojeSP = diaEmSaoPaulo();
  const atrasados = relacionamentos
    .filter((r) => {
      const d = diaMarcado(r);
      return !!d && d < hojeSP;
    })
    .map((r) => ({
      id: r.id,
      titulo: `Follow-up · ${r.nome}`,
      quando: "Atrasado",
      urgente: true,
    }));

  const hoje = relacionamentos
    .filter((r) => diaMarcado(r) === hojeSP)
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
        !(diaMarcado(r) && diaMarcado(r) <= hojeSP)
    )
    .map((r) => ({
      id: r.id,
      titulo: `Retomar contato · ${r.nome}`,
      quando: "Esfriando",
      urgente: false,
    }));

  return [...atrasados, ...hoje, ...esfriando].slice(0, 6);
}
