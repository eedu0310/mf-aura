/**
 * AGENTE DE MANUTENÇÃO — a limpeza anual da chaminé (e a revisão) de quem
 * comprou lareira. É cuidado com o cliente e é venda de serviço.
 *
 * Usa a mesma montagem da tela de Manutenções (montarManutencoes, em
 * src/components/pos-venda/regras-manutencao.ts): os registros da tabela
 * pos_venda_manutencoes quando ela existe, e a PREVISÃO (instalação + 12
 * meses) para quem ainda não tem registro. Enquanto a migração 106 não estiver
 * no banco, vale só a previsão — o agente não quebra por isso.
 *
 * Avisa 30 dias antes (11º mês) e cobra o que venceu. O card tem o botão
 * "Gerar mensagem": a IA escreve a oferta da limpeza, quem envia é a pessoa.
 *
 * Quem recebe: o responsável do pós-venda; senão a pessoa de Pós-venda da
 * loja; senão o vendedor do cliente; senão o gestor da loja. Sobrou só o
 * mestre? Vai num resumo.
 */
import type { Achado, ContextoAgente, DefinicaoAgente, MensagemEscritorio, ResultadoAgente } from "../tipos";
import type { Manutencao, StatusManutencao, TipoManutencao } from "@/lib/supabase/pos-venda-manutencao";
import { ROTULO_TIPO, tabelaAusente } from "@/lib/supabase/pos-venda-manutencao";
import { montarManutencoes } from "@/components/pos-venda/regras-manutencao";
import { formatarDia } from "@/components/pos-venda/regras";
import { anotar, chaveDe, diasEntre, limitarPorPessoa, plural, responsaveisDaLoja, resumosPorGestor } from "./comum";
import { lerPosVendas, type PosVendaAgente } from "./pos-venda-linhas";
import { prioridadeManutencao, situacaoManutencao } from "./manutencao-regras";

interface LinhaManutencao {
  id: string;
  pos_venda_id: string;
  empresa: string;
  tipo: TipoManutencao;
  data_prevista: string;
  data_agendada: string | null;
  hora: string | null;
  status: StatusManutencao;
  realizada_em: string | null;
  observacao: string | null;
  responsavel_id: string | null;
  created_at: string;
}

/** Lê os registros; sem a tabela no banco, devolve `disponivel: false`. */
async function lerRegistros(ctx: ContextoAgente): Promise<{ disponivel: boolean; registros: Manutencao[] }> {
  const saida: Manutencao[] = [];
  for (let de = 0; de < 100_000; de += 1000) {
    const { data, error } = await ctx.sb
      .from("pos_venda_manutencoes")
      .select("id, pos_venda_id, empresa, tipo, data_prevista, data_agendada, hora, status, realizada_em, observacao, responsavel_id, created_at")
      .order("id")
      .range(de, de + 999);
    if (error) {
      if (tabelaAusente(error)) return { disponivel: false, registros: [] };
      throw new Error(`Não consegui ler as manutenções: ${error.message}`);
    }
    const linhas = (data ?? []) as LinhaManutencao[];
    for (const l of linhas) {
      saida.push({
        id: l.id,
        posVendaId: l.pos_venda_id,
        empresa: l.empresa,
        tipo: l.tipo,
        dataPrevista: l.data_prevista,
        dataAgendada: l.data_agendada,
        hora: l.hora,
        status: l.status,
        realizadaEm: l.realizada_em,
        observacao: l.observacao,
        responsavelId: l.responsavel_id,
        criadoEm: l.created_at,
      });
    }
    if (linhas.length < 1000) break;
  }
  return { disponivel: true, registros: saida };
}

async function executar(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb, hoje } = ctx;
  const equipe = await responsaveisDaLoja(sb);
  const [cards, { disponivel, registros }, caixa] = await Promise.all([
    lerPosVendas(sb),
    lerRegistros(ctx),
    ctx.caixaDeEntrada().catch(() => []),
  ]);
  const porId = new Map(cards.map((c) => [c.id, c]));
  const itens = montarManutencoes(cards, registros)
    .map((m) => ({ m, s: situacaoManutencao(m, hoje) }))
    .filter((x) => x.s !== null)
    // Vencidas primeiro (a mais antiga antes), depois as que estão chegando.
    .sort((a, b) => (a.s === b.s ? (a.m.dataAgendada ?? a.m.dataPrevista).localeCompare(b.m.dataAgendada ?? b.m.dataPrevista) : a.s === "vencida" ? -1 : 1));

  const destinoDe = (pv: PosVendaAgente, responsavelRegistro: string | null) => {
    const direto = equipe.pessoa(responsavelRegistro) ?? equipe.pessoa(pv.responsavelId);
    if (direto) return direto.id;
    const posVenda = equipe.doCargo(pv.empresa, "Pós-venda")[0];
    if (posVenda) return posVenda.id;
    const vendedor = equipe.pessoa(pv.vendedorId);
    if (vendedor) return vendedor.id;
    return equipe.gestoresDaLoja(pv.empresa)[0]?.id ?? null;
  };

  const achados: Achado[] = [];
  const resumoMestres = new Map<string, string[]>();
  const naLista = new Set<string>();
  let vencidas = 0;
  let proximas = 0;
  for (const { m, s } of itens) {
    const pv = porId.get(m.posVenda.id);
    if (!pv || !s) continue;
    if (pv.relacionamentoId) naLista.add(pv.relacionamentoId);
    if (s === "vencida") vencidas++;
    else proximas++;
    const dia = m.dataAgendada ?? m.dataPrevista;
    const rotulo = ROTULO_TIPO[m.tipo];
    const quando =
      s === "vencida"
        ? `venceu em ${formatarDia(dia)} (${diasEntre(dia, hoje)} dias)`
        : `vence em ${formatarDia(dia)}, daqui a ${diasEntre(hoje, dia)} dias`;
    const destino = destinoDe(pv, m.registro?.responsavelId ?? null);
    if (!destino) {
      for (const id of equipe.mestres().map((p) => p.id)) anotar(resumoMestres, id, `${pv.empresa}: ${pv.cliente} — ${rotulo.toLowerCase()} ${quando}`);
      continue;
    }
    achados.push({
      chave: chaveDe("manutencao", pv.id, m.tipo),
      empresa: pv.empresa,
      destinatarioId: destino,
      titulo: `${rotulo} ${s === "vencida" ? "vencida" : "chegando"}: ${pv.cliente}`,
      descricao:
        // Produto entre parênteses: "da Adatto" e "do fogão" pedem gêneros diferentes.
        `${rotulo}${pv.produto && pv.produto !== "Cliente antigo" ? ` (${pv.produto})` : ""} ${quando}. ` +
        (m.status === "agendada"
          ? "Estava agendada: marque como feita ou combine nova data."
          : "Ligue ou mande mensagem oferecendo o horário."),
      prioridade: prioridadeManutencao(s, hoje),
      entidadeTipo: "manutencao",
      entidadeId: m.registro?.id ?? pv.id,
      acaoUrl: "/pos-venda?secao=manutencoes",
      expiraEmDias: 3,
      podeGerarMensagem: true,
    });
  }

  const resumos = resumosPorGestor({
    agente: "manutencao",
    tipo: "resumo",
    linhas: resumoMestres,
    empresaDe: (id) => equipe.pessoa(id)?.empresa ?? "",
    titulo: (n) => `${plural(n, "limpeza", "limpezas")} de chaminé para oferecer`,
    abertura: "Clientes sem ninguém da loja para chamar:",
    prioridade: "media",
    acaoUrl: "/pos-venda?secao=manutencoes",
  });

  // Resposta aos colegas que mandaram clientes pedindo limpeza.
  const mensagens: MensagemEscritorio[] = [];
  for (const pedido of caixa.filter((c) => c.tipo === "pedido" && c.de !== "manutencao")) {
    const ids = Array.isArray(pedido.dados?.relacionamentoIds) ? (pedido.dados?.relacionamentoIds as string[]) : [];
    if (!ids.length) continue;
    const ja = ids.filter((id) => naLista.has(id)).length;
    mensagens.push({
      de: "manutencao",
      para: pedido.de,
      tipo: "resposta",
      empresa: pedido.empresa,
      texto:
        ja === ids.length
          ? `Recebi: os ${plural(ids.length, "cliente")} já estão na minha lista de manutenção.`
          : `Recebi: ${ja} de ${ids.length} já estão na minha lista. Os outros não têm instalação registrada — o vendedor precisa abrir o pós-venda.`,
    });
  }

  const { achados: final, cortados } = limitarPorPessoa(achados);
  return {
    resumo:
      `${plural(vencidas, "manutenção vencida", "manutenções vencidas")} e ${proximas} chegando nos próximos 30 dias` +
      (disponivel ? "." : " (pela previsão: o cadastro de manutenções ainda não está no banco)."),
    achados: [...final, ...resumos],
    mensagens,
    metricas: { vencidas, proximas30d: proximas, cadastroNoBanco: disponivel ? 1 : 0, cortadosPeloTeto: cortados },
  };
}

export const agenteManutencao: DefinicaoAgente = {
  id: "manutencao",
  nome: "Agente de Manutenção",
  cargo: "Agenda da limpeza anual",
  setor: "pos-venda",
  icone: "Flame",
  missao: "Lembra a loja de oferecer a limpeza anual da chaminé e a revisão um mês antes de vencer, e cobra as vencidas.",
  agenda: { tipo: "diario", horas: [8], minuto: 15, diasSemana: [1, 2, 3, 4, 5, 6] },
  usaIA: false,
  orcamentoMensalUsd: 0,
  tipo: "nativo",
  executar,
};
