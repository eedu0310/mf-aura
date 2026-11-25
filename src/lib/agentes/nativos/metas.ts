/**
 * ANALISTA DE METAS — de segunda a sábado às 9h, um card por vendedor com o
 * ritmo da meta do mês: quanto vendeu, quanto falta, quanto precisa vender
 * por dia daqui até o fim do mês e como está no ranking da loja.
 *
 * O que NÃO faz, porque outras rotinas já fazem:
 *   - cobrar quem não mandou a meta (cron cobrar-metas, dias 1 a 7);
 *   - cobrar quem está zerado em oportunidade, fechamento, atividade ou
 *     relacionamento (cobrança da supervisora, src/lib/aura/cobranca.ts).
 * Aqui é só ritmo. Vendedor sem meta não recebe card.
 *
 * Meta: a da tabela metas do mês; sem ela, o faturamento do compromisso do
 * mês APROVADO. Venda em parceria conta a fatia de cada um (src/lib/parceria.ts).
 * Até o dia 2 nada sai: no começo do mês todo mundo está "atrasado".
 */
import type { Achado, ContextoAgente, DefinicaoAgente, Prioridade, ResultadoAgente } from "../tipos";
import { somaDoVendedor, type VendaComParceria } from "@/lib/parceria";
import { anotar, chaveDe, diasNoMes, formatarMoeda, lerTudo, limitarPorPessoa, num, plural, responsaveisDaLoja, resumosPorGestor, somarDias } from "./comum";

export type SituacaoMeta = "batida" | "adiantado" | "no_ritmo" | "atrasado";

export interface RitmoDaMeta {
  pct: number;
  falta: number;
  diasRestantes: number;
  porDia: number;
  esperadoAteOntem: number;
  situacao: SituacaoMeta;
}

/** O ritmo da meta no dia `hoje` (conta o dia de hoje como dia de venda). */
export function ritmoDaMeta(meta: number, vendido: number, hoje: string): RitmoDaMeta {
  const dia = Number(hoje.slice(8, 10));
  const total = diasNoMes(hoje);
  const diasRestantes = Math.max(1, total - dia + 1);
  const falta = Math.max(0, meta - vendido);
  const esperadoAteOntem = (meta * (dia - 1)) / total;
  let situacao: SituacaoMeta;
  if (vendido >= meta) situacao = "batida";
  else if (vendido >= esperadoAteOntem * 1.1) situacao = "adiantado";
  else if (vendido >= esperadoAteOntem * 0.9) situacao = "no_ritmo";
  else situacao = "atrasado";
  return {
    pct: meta > 0 ? Math.round((vendido / meta) * 100) : 0,
    falta,
    diasRestantes,
    porDia: falta / diasRestantes,
    esperadoAteOntem,
    situacao,
  };
}

const TEXTO_SITUACAO: Record<SituacaoMeta, string> = {
  batida: "meta batida",
  adiantado: "adiantado",
  no_ritmo: "no ritmo",
  atrasado: "abaixo do ritmo",
};
const PRIORIDADE: Record<SituacaoMeta, Prioridade> = { batida: "baixa", adiantado: "baixa", no_ritmo: "media", atrasado: "alta" };

/** Posição (1 = primeiro) de cada vendedor numa lista de totais. */
function posicoes(totais: Map<string, number>): Map<string, number> {
  const ordem = [...totais].sort((a, b) => b[1] - a[1]);
  return new Map(ordem.map(([id], i) => [id, i + 1]));
}

async function executar(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb, hoje } = ctx;
  if (Number(hoje.slice(8, 10)) < 3) {
    return { resumo: "Começo de mês: o ritmo da meta só é cobrado a partir do dia 3.", achados: [] };
  }
  const mes = hoje.slice(0, 7);
  const inicioMes = `${mes}-01`;
  const semanaPassada = somarDias(hoje, -7);
  const equipe = await responsaveisDaLoja(sb);

  const [metas, compromissos, vendas] = await Promise.all([
    lerTudo<{ owner_id: string; valor_meta: number }>((de, ate) =>
      sb.from("metas").select("owner_id, valor_meta").eq("mes", mes).order("id").range(de, ate),
    ),
    lerTudo<{ vendedor_id: string; meta_faturamento: number }>((de, ate) =>
      sb.from("compromissos_mensais").select("vendedor_id, meta_faturamento").eq("mes", mes).eq("status", "aprovado").order("id").range(de, ate),
    ),
    lerTudo<VendaComParceria & { data: string; empresa: string }>((de, ate) =>
      sb
        .from("vendas")
        .select("owner_id, parceiro_id, percentual_parceiro, valor, valor_fechado, data, empresa")
        .gte("data", inicioMes)
        .order("id")
        .range(de, ate),
    ),
  ]);
  const metaDe = new Map<string, number>();
  for (const c of compromissos) if (num(c.meta_faturamento) > 0) metaDe.set(c.vendedor_id, num(c.meta_faturamento));
  for (const m of metas) if (num(m.valor_meta) > 0) metaDe.set(m.owner_id, num(m.valor_meta)); // a tabela metas manda

  const achados: Achado[] = [];
  const paraGestor = new Map<string, string[]>();
  const contagem: Record<SituacaoMeta, number> = { batida: 0, adiantado: 0, no_ritmo: 0, atrasado: 0 };

  for (const empresa of equipe.lojas()) {
    const vendedores = equipe.vendedores(empresa);
    if (!vendedores.length) continue;
    // Ranking da loja: agora e como estava há 7 dias (só dentro do mesmo mês).
    const totalAgora = new Map(vendedores.map((v) => [v.id, somaDoVendedor(vendas, v.id)]));
    const comparaSemana = semanaPassada >= inicioMes;
    const totalAntes = new Map(
      vendedores.map((v) => [v.id, somaDoVendedor(vendas.filter((x) => x.data <= semanaPassada), v.id)]),
    );
    const posAgora = posicoes(totalAgora);
    const posAntes = posicoes(totalAntes);
    const gestores = equipe.gestoresPara(empresa);

    for (const v of vendedores) {
      const meta = metaDe.get(v.id);
      if (!meta) continue;
      const vendido = totalAgora.get(v.id) ?? 0;
      const r = ritmoDaMeta(meta, vendido, hoje);
      contagem[r.situacao]++;
      const pos = posAgora.get(v.id) ?? 0;
      const mudou = comparaSemana ? (posAntes.get(v.id) ?? pos) - pos : 0;
      const ranking =
        vendedores.length > 1
          ? ` Você está em ${pos}º de ${vendedores.length} na loja` +
            (mudou > 0 ? ` (subiu ${plural(mudou, "posição", "posições")} na semana).` : mudou < 0 ? ` (caiu ${plural(-mudou, "posição", "posições")} na semana).` : ".")
          : "";
      const ritmo =
        r.situacao === "batida"
          ? `Meta batida: ${formatarMoeda(vendido)} de ${formatarMoeda(meta)}. Tudo o que entrar agora é extra.`
          : `Vendeu ${formatarMoeda(vendido)} de ${formatarMoeda(meta)}. Faltam ${formatarMoeda(r.falta)} em ${plural(r.diasRestantes, "dia")}: ${formatarMoeda(r.porDia)} por dia.`;
      achados.push({
        chave: chaveDe("metas", v.id, mes),
        empresa,
        destinatarioId: v.id,
        titulo: `Meta do mês: ${r.pct}% (${TEXTO_SITUACAO[r.situacao]})`,
        descricao: ritmo + ranking,
        prioridade: PRIORIDADE[r.situacao],
        entidadeTipo: "perfil",
        entidadeId: v.id,
        acaoUrl: "/meu-dia",
        expiraEmDias: 1,
      });
      for (const id of gestores.ids) {
        anotar(
          paraGestor,
          id,
          `${gestores.mestres ? `${empresa} · ` : ""}${v.nome}: ${r.pct}% (${TEXTO_SITUACAO[r.situacao]}` +
            (r.situacao === "batida" ? ")" : `, precisa ${formatarMoeda(r.porDia)}/dia)`),
        );
      }
    }
  }

  const resumos = resumosPorGestor({
    agente: "metas",
    tipo: `resumo-${mes}`,
    linhas: paraGestor,
    empresaDe: (id) => equipe.pessoa(id)?.empresa ?? "",
    titulo: () => "Ritmo das metas da equipe",
    abertura: "Como cada um está em relação à meta do mês:",
    prioridade: contagem.atrasado > 0 ? "alta" : "media",
    acaoUrl: "/gestor?aba=ranking",
  });

  const { achados: final, cortados } = limitarPorPessoa(achados);
  const comMeta = Object.values(contagem).reduce((s, n) => s + n, 0);
  return {
    resumo: comMeta
      ? `${plural(comMeta, "vendedor")} com meta: ${contagem.batida} já bateram, ${contagem.adiantado + contagem.no_ritmo} no ritmo, ${contagem.atrasado} abaixo.`
      : "Nenhum vendedor com meta aprovada neste mês.",
    achados: [...final, ...resumos],
    metricas: { comMeta, batida: contagem.batida, adiantado: contagem.adiantado, noRitmo: contagem.no_ritmo, atrasado: contagem.atrasado, cortadosPeloTeto: cortados },
  };
}

export const agenteMetas: DefinicaoAgente = {
  id: "metas",
  nome: "Analista de Metas",
  cargo: "Analista de metas",
  setor: "gestao",
  icone: "Target",
  missao: "Mostra a cada vendedor quanto falta da meta, quanto precisa vender por dia e como está no ranking da loja.",
  agenda: { tipo: "diario", horas: [9], minuto: 0, diasSemana: [1, 2, 3, 4, 5, 6] },
  usaIA: false,
  orcamentoMensalUsd: 0,
  tipo: "nativo",
  executar,
};
