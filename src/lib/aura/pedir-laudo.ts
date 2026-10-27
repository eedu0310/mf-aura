/**
 * Pede à AURA o laudo de um negócio decidido (fechado ou perdido).
 *
 * É o laudo que colhe o aprendizado da conversa. Antes ele só era pedido
 * quando o vendedor ARRASTAVA o card no Pipeline, e quase todo negócio do mês
 * fechou por outro caminho: a venda lançada direto em Registrar Atividade
 * (o banco move o card para Fechamento sozinho), o card que já nasce em
 * Fechamento, o botão "Marcar como perdido" e a edição da etapa no card.
 * Nenhum desses pedia o laudo, e a AURA passou o mês sem aprender nada.
 * Agora todos passam por aqui.
 *
 * Sem await de propósito, em quem chama: a venda já está registrada e uma
 * falha da IA não pode desfazer nem travar o fechamento.
 *
 * O mesmo negócio pode chegar por dois caminhos no mesmo clique (arrastar o
 * card cria a venda, e a venda também pede). A rota já recusa refazer um
 * laudo gravado, mas as duas chamadas sairiam juntas, antes de qualquer uma
 * gravar, e seriam duas chamadas de IA pagas. A lista abaixo segura isso.
 */
const jaPedidos = new Set<string>();

export type ResultadoDoNegocio = "fechado" | "perdido";

export function pedirLaudoDoFechamento(
  oportunidadeId: string | null | undefined,
  resultado: ResultadoDoNegocio,
  motivo?: string | null,
): void {
  // Sem banco (modo demonstração) o id é local, "op-…", e não existe no servidor.
  if (!oportunidadeId || oportunidadeId.startsWith("op-")) return;
  const chave = `${oportunidadeId}:${resultado}`;
  if (jaPedidos.has(chave)) return;
  jaPedidos.add(chave);

  void fetch("/api/aura/fechamento", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oportunidadeId, resultado, motivo: motivo?.trim() || null }),
  }).catch(() => {
    /* sem IA ou sem rede: o fechamento vale do mesmo jeito */
  });
}
