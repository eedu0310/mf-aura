/**
 * Atendimento em dupla: quando um vendedor passa o atendimento para um colega
 * e os dois seguem trabalhando o mesmo cliente.
 *
 * O caso que originou isto: a Denise atendeu, repassou para a Maju, as duas
 * conversaram com a cliente e, no fechamento, o valor tinha que ficar dividido
 * entre as duas — e as duas precisavam continuar vendo a conversa.
 *
 * O banco guarda isso em dois campos na venda:
 *
 *   parceiro_id          quem entrou junto (o dono continua em owner_id)
 *   percentual_parceiro  quanto da venda é do parceiro, de 0 a 100
 *
 * O dono fica com o resto. Meio a meio é percentual 50; a divisão não precisa
 * ser igual, porque nem sempre o trabalho foi igual.
 *
 * ESTE ARQUIVO É A ÚNICA FONTE DESSA CONTA. Antes dele, "quanto o vendedor
 * vendeu" era `vendas.filter(v => v.owner_id === id)` espalhado por relatório,
 * ranking, meta e painel do gestor. Com venda dividida, cada um desses lugares
 * erraria de um jeito diferente: uns dariam o valor inteiro para os dois
 * (somando mais do que a loja vendeu), outros esconderiam a venda do parceiro.
 *
 * As funções aceitam tanto a venda em camelCase (src/lib/types.ts, telas) como
 * a linha crua do banco em snake_case (src/lib/aura/dados.ts, relatórios), de
 * propósito: as duas formas convivem no sistema e duplicar a regra para cada
 * uma seria exatamente o risco que este arquivo existe para fechar.
 */

export interface VendaComParceria {
  owner_id?: string | null;
  ownerId?: string | null;
  vendedor_id?: string | null;
  vendedorId?: string | null;
  parceiro_id?: string | null;
  parceiroId?: string | null;
  percentual_parceiro?: number | null;
  percentualParceiro?: number | null;
  valor?: number | null;
  valor_fechado?: number | null;
  valorFechado?: number | null;
}

function id(valor: unknown): string | null {
  const t = typeof valor === "string" ? valor.trim() : "";
  return t ? t : null;
}

/** Quem é o dono da venda — o vendedor que responde por ela. */
export function donoDaVenda(v: VendaComParceria): string | null {
  return (
    id(v.owner_id) ?? id(v.ownerId) ?? id(v.vendedor_id) ?? id(v.vendedorId)
  );
}

/**
 * Quem entrou junto, ou null. Parceiro igual ao dono é tratado como "sem
 * parceiro": é dado sujo (ou um repasse que voltou para quem começou) e
 * contá-lo como dupla faria a mesma pessoa receber duas fatias.
 */
export function parceiroDaVenda(v: VendaComParceria): string | null {
  const p = id(v.parceiro_id) ?? id(v.parceiroId);
  if (!p) return null;
  return p === donoDaVenda(v) ? null : p;
}

/** O valor da venda inteira, do jeito que a loja conta. */
export function valorCheio(v: VendaComParceria): number {
  const fechado = v.valor_fechado ?? v.valorFechado;
  const bruto = fechado ?? v.valor ?? 0;
  const n = Number(bruto);
  return Number.isFinite(n) ? n : 0;
}

/**
 * A fatia do parceiro, de 0 a 1. Sem parceiro é 0. Fora da faixa 0–100 é
 * aparado: o banco já tem um check de 0 a 100, e aqui a conta não pode
 * devolver um valor negativo nem mais do que a venda inteira mesmo se um dia
 * entrar dado torto por outro caminho.
 */
export function fatiaDoParceiro(v: VendaComParceria): number {
  if (!parceiroDaVenda(v)) return 0;
  const bruto = v.percentual_parceiro ?? v.percentualParceiro ?? 0;
  const n = Number(bruto);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), 100) / 100;
}

/** Esta venda é desta pessoa (como dono ou como parceiro)? */
export function participaDaVenda(
  v: VendaComParceria,
  vendedorId: string | null | undefined,
): boolean {
  const alvo = id(vendedorId);
  if (!alvo) return false;
  return alvo === donoDaVenda(v) || alvo === parceiroDaVenda(v);
}

/**
 * Quanto desta venda é desta pessoa em dinheiro.
 *
 * Quem não participou recebe 0 — e não a venda inteira, que é o que um
 * `filter` esquecido devolveria.
 *
 * A soma das fatias de todos os participantes é sempre o valor cheio, nunca
 * mais: é isto que mantém "o que a loja vendeu" igual à soma do que os
 * vendedores venderam.
 */
export function valorDoVendedor(
  v: VendaComParceria,
  vendedorId: string | null | undefined,
): number {
  const alvo = id(vendedorId);
  if (!alvo) return 0;
  const cheio = valorCheio(v);
  const parceiro = parceiroDaVenda(v);
  if (alvo === parceiro) return cheio * fatiaDoParceiro(v);
  if (alvo === donoDaVenda(v)) return cheio * (1 - fatiaDoParceiro(v));
  return 0;
}

/** Soma as fatias desta pessoa numa lista de vendas. */
export function somaDoVendedor(
  vendas: VendaComParceria[],
  vendedorId: string | null | undefined,
): number {
  return vendas.reduce((s, v) => s + valorDoVendedor(v, vendedorId), 0);
}

/** As vendas em que esta pessoa entrou, de qualquer um dos dois lados. */
export function vendasDoVendedor<T extends VendaComParceria>(
  vendas: T[],
  vendedorId: string | null | undefined,
): T[] {
  return vendas.filter((v) => participaDaVenda(v, vendedorId));
}

/** Rótulo curto para a tela: "50% / 50%" visto do lado de quem está olhando. */
export function rotuloDaDivisao(
  v: VendaComParceria,
  vendedorId?: string | null,
): string | null {
  const parceiro = parceiroDaVenda(v);
  if (!parceiro) return null;
  const doParceiro = Math.round(fatiaDoParceiro(v) * 100);
  const meu =
    id(vendedorId) === parceiro ? doParceiro : 100 - doParceiro;
  return id(vendedorId) && participaDaVenda(v, vendedorId)
    ? `${meu}% seu`
    : `dividida ${100 - doParceiro}% / ${doParceiro}%`;
}
