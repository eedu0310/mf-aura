/**
 * Leitura do pós-venda no servidor, no MESMO formato que a tela usa
 * (PosVenda, de src/lib/supabase/pos-venda.ts). Assim os agentes de
 * pós-venda e de manutenção chamam as regras da própria tela
 * (src/components/pos-venda/regras.ts e regras-manutencao.ts) em vez de
 * reescrever a conta — o card do agente e o quadro dizem sempre a mesma coisa.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PosVenda } from "@/lib/supabase/pos-venda";
import type { StatusPosVenda } from "@/lib/types";
import { lerTudo } from "./comum";

export interface LinhaPosVendaAgente {
  id: string;
  venda_id: string | null;
  origem: string | null;
  empresa: string;
  status: string;
  data_agendamento: string | null;
  hora_agendamento: string | null;
  observacao: string | null;
  reclamacao: string | null;
  reclamacao_resolvida: boolean | null;
  avaliou_loja: boolean | null;
  nota_avaliacao: number | null;
  comentario_avaliacao: string | null;
  token_avaliacao: string;
  cliente: string | null;
  produto: string | null;
  telefone: string | null;
  created_at: string;
  instalacao_agendada_em: string | null;
  instalacao_realizada_em: string | null;
  pos_venda_realizado_em: string | null;
  possui_reclamacao: boolean | null;
  reclamacao_aberta_em: string | null;
  reclamacao_resolvida_em: string | null;
  endereco_instalacao: string | null;
  vendedor_id: string | null;
  responsavel_id: string | null;
  relacionamento_id: string | null;
  vendas: { cliente: string; produto: string; valor: number; data: string } | null;
}

export interface PosVendaAgente extends PosVenda {
  responsavelId: string | null;
  relacionamentoId: string | null;
}

/** Linha do banco → PosVenda (o mesmo doBanco da tela, com dois campos a mais). */
export function posVendaDaLinha(l: LinhaPosVendaAgente): PosVendaAgente {
  // Reclamação marcada sem texto continua sendo reclamação aberta.
  const reclamacao = l.reclamacao?.trim() || (l.possui_reclamacao && !l.reclamacao_resolvida_em ? "(sem descrição)" : null);
  return {
    id: l.id,
    vendaId: l.venda_id,
    origem: l.origem === "cliente_antigo" ? "cliente_antigo" : "venda",
    empresa: l.empresa,
    status: l.status as StatusPosVenda,
    // A data da instalação é data_agendamento (é onde a tela grava). Não cai
    // para instalacao_agendada_em de propósito: aquele é o carimbo de QUANDO
    // agendaram (src/lib/supabase/pos-venda.ts), e usá-lo como data da
    // instalação faria toda instalação recém-agendada parecer atrasada.
    dataAgendamento: l.data_agendamento,
    horaAgendamento: l.hora_agendamento,
    observacao: l.observacao,
    reclamacao,
    reclamacaoResolvida: Boolean(l.reclamacao_resolvida) || Boolean(l.reclamacao_resolvida_em),
    avaliouLoja: Boolean(l.avaliou_loja),
    notaAvaliacao: l.nota_avaliacao,
    comentarioAvaliacao: l.comentario_avaliacao,
    tokenAvaliacao: l.token_avaliacao,
    cliente: l.vendas?.cliente ?? l.cliente ?? "Cliente",
    produto: l.vendas?.produto ?? l.produto ?? "",
    valor: Number(l.vendas?.valor ?? 0),
    dataVenda: l.vendas?.data ?? l.created_at?.slice(0, 10) ?? "",
    telefone: l.telefone,
    instalacaoAgendadaEm: l.instalacao_agendada_em,
    instalacaoRealizadaEm: l.instalacao_realizada_em,
    posVendaRealizadoEm: l.pos_venda_realizado_em,
    possuiReclamacao: Boolean(l.possui_reclamacao),
    reclamacaoAbertaEm: l.reclamacao_aberta_em,
    reclamacaoResolvidaEm: l.reclamacao_resolvida_em,
    enderecoInstalacao: l.endereco_instalacao,
    vendedorId: l.vendedor_id,
    criadoEm: l.created_at,
    responsavelId: l.responsavel_id,
    relacionamentoId: l.relacionamento_id,
  };
}

export async function lerPosVendas(sb: SupabaseClient): Promise<PosVendaAgente[]> {
  const linhas = await lerTudo<LinhaPosVendaAgente>((de, ate) =>
    sb
      .from("pos_vendas")
      .select(
        "id, venda_id, origem, empresa, status, data_agendamento, hora_agendamento, observacao, reclamacao, reclamacao_resolvida, " +
          "avaliou_loja, nota_avaliacao, comentario_avaliacao, token_avaliacao, cliente, produto, telefone, created_at, " +
          "instalacao_agendada_em, instalacao_realizada_em, pos_venda_realizado_em, possui_reclamacao, reclamacao_aberta_em, " +
          "reclamacao_resolvida_em, endereco_instalacao, vendedor_id, responsavel_id, relacionamento_id, vendas(cliente, produto, valor, data)",
      )
      .order("id")
      .range(de, ate),
  );
  return linhas.map(posVendaDaLinha);
}
