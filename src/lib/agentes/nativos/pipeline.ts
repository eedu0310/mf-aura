/**
 * ANALISTA DE PIPELINE — todo dia às 8h passa o pente no funil de cada loja.
 *
 * Um card por NEGÓCIO (não um por problema), com todos os motivos juntos:
 *   - parado: 7 dias ou mais sem movimento. "Movimento" é o mais recente
 *     entre a última alteração do card e a última atividade com o cliente
 *     (src/lib/oportunidade-parada.ts — a coluna dias_parado não vale);
 *   - sem valor numa etapa que exige valor (Negociação, Fechamento): o
 *     cliente já tem orçamento na mão e a previsão do mês fica vazia;
 *   - sem cliente vinculado: sem relacionamento não dá para marcar o próximo
 *     contato, e o negócio some do radar do follow-up.
 *
 * O que fica de fora de propósito:
 *   - "sem próximo contato" é do Analista de Follow-up (seria o mesmo card
 *     duas vezes);
 *   - "data de fechamento passou": a tabela oportunidades não tem data
 *     prevista de fechamento. Não há o que comparar — não se inventa.
 *
 * O gestor recebe um card só: quanto dinheiro está parado em cada loja.
 */
import type { Achado, ContextoAgente, DefinicaoAgente, Prioridade, PropostaAgente, ResultadoAgente } from "../tipos";
import { acharEtapa, exigeValor } from "@/lib/funil";
import { buscarUltimaAtividade, DIAS_PARA_PARADO, diasParadoDaLinha } from "@/lib/oportunidade-parada";
import {
  anotar, chaveDe, diaDaSemana, formatarMoeda, funilDe, funisDasLojas, lerTudo, limitarPorPessoa, negocioEmAberto, num,
  plural, responsaveisDaLoja, resumosPorGestor,
} from "./comum";

interface OpPipeline {
  id: string;
  owner_id: string;
  empresa: string;
  cliente: string;
  valor: number;
  etapa: string;
  created_at: string;
  updated_at: string | null;
  relacionamento_id: string | null;
}

export interface DiagnosticoNegocio {
  diasParado: number;
  parado: boolean;
  semValor: boolean;
  semCliente: boolean;
}

export function prioridadeDoNegocio(d: DiagnosticoNegocio, valor: number): Prioridade {
  if (d.semValor) return "alta";
  if (d.parado && d.diasParado >= 14 && valor > 0) return "alta";
  return "media";
}

async function executar(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb, agora } = ctx;
  const equipe = await responsaveisDaLoja(sb);
  const [ops, funis] = await Promise.all([
    lerTudo<OpPipeline>((de, ate) =>
      sb
        .from("oportunidades")
        .select("id, owner_id, empresa, cliente, valor, etapa, created_at, updated_at, relacionamento_id")
        .order("id")
        .range(de, ate),
    ),
    funisDasLojas(sb, equipe.lojas()),
  ]);
  const abertas = ops
    .filter((o) => negocioEmAberto(o.etapa, funilDe(funis, o.empresa)))
    .map((o) => ({ ...o, valor: num(o.valor) }));
  const ultimaAtividade = await buscarUltimaAtividade(sb, abertas.map((o) => o.relacionamento_id));

  const itens = abertas
    .map((o) => {
      const funil = funilDe(funis, o.empresa);
      const diasParado = diasParadoDaLinha(o, o.relacionamento_id ? ultimaAtividade.get(o.relacionamento_id) : null, agora);
      const d: DiagnosticoNegocio = {
        diasParado,
        parado: diasParado >= DIAS_PARA_PARADO,
        semValor: o.valor <= 0 && exigeValor(o.etapa, funil),
        semCliente: !o.relacionamento_id,
      };
      return { o, d, ordem: acharEtapa(o.etapa, funil)?.ordem ?? 0, chaveEtapa: acharEtapa(o.etapa, funil)?.chave ?? null };
    })
    .filter((x) => x.d.parado || x.d.semValor || x.d.semCliente)
    .sort((a, b) => b.o.valor - a.o.valor || b.ordem - a.ordem || b.d.diasParado - a.d.diasParado);

  const achados: Achado[] = [];
  const paradoPorLoja = new Map<string, { qtd: number; valor: number }>();
  for (const { o, d } of itens) {
    if (d.parado) {
      const p = paradoPorLoja.get(o.empresa) ?? { qtd: 0, valor: 0 };
      p.qtd++;
      p.valor += o.valor;
      paradoPorLoja.set(o.empresa, p);
    }
    const destino = equipe.destinoDoItem(o.owner_id, o.empresa);
    if (!destino) continue;
    const motivos: string[] = [];
    if (d.parado) motivos.push(`Parado há ${d.diasParado} dias em ${o.etapa}: chame o cliente ou mova o card.`);
    if (d.semValor) motivos.push(`Está em ${o.etapa} sem valor: lance o valor do orçamento.`);
    if (d.semCliente) motivos.push("Sem cliente vinculado: vincule para poder marcar o próximo contato.");
    const titulo = d.semValor
      ? `Negócio sem valor: ${o.cliente}`
      : d.parado
        ? `Negócio parado há ${d.diasParado} dias: ${o.cliente}`
        : `Negócio sem cliente vinculado: ${o.cliente}`;
    achados.push({
      chave: chaveDe("pipeline", o.id),
      empresa: o.empresa,
      destinatarioId: destino,
      titulo,
      descricao: (o.valor > 0 ? `${formatarMoeda(o.valor)}. ` : "") + motivos.join(" "),
      prioridade: prioridadeDoNegocio(d, o.valor),
      entidadeTipo: "oportunidade",
      entidadeId: o.id,
      acaoUrl: "/pipeline",
      expiraEmDias: 2,
      podeGerarMensagem: d.parado,
    });
  }

  // Um card por gestor com o dinheiro parado de cada loja.
  const paraGestor = new Map<string, string[]>();
  for (const [empresa, p] of [...paradoPorLoja].sort((a, b) => b[1].valor - a[1].valor)) {
    const destino = equipe.gestoresPara(empresa);
    for (const id of destino.ids) {
      anotar(paraGestor, id, `${empresa}: ${plural(p.qtd, "negócio parado", "negócios parados")}, ${formatarMoeda(p.valor)}`);
    }
  }
  const resumos = resumosPorGestor({
    agente: "pipeline",
    tipo: "resumo",
    linhas: paraGestor,
    empresaDe: (id) => equipe.pessoa(id)?.empresa ?? "",
    titulo: () => "Dinheiro parado no pipeline",
    abertura: `Negócios sem movimento há ${DIAS_PARA_PARADO} dias ou mais:`,
    prioridade: "media",
    acaoUrl: "/pipeline",
  });

  /*
   * Proposta de agente (rara): toda segunda, se alguma loja tem 20 ou mais
   * orçamentos com valor parados no Follow-up, sugere um vigia só para eles.
   * O gestor decide; recusar uma vez não impede a sugestão de voltar.
   */
  const propostas: PropostaAgente[] = [];
  if (diaDaSemana(ctx.hoje) === 1) {
    const orcamentosParados = itens.filter((x) => x.d.parado && x.o.valor > 0 && x.chaveEtapa === "followup").length;
    if (orcamentosParados >= 20) {
      propostas.push({
        propostoPor: "pipeline",
        nome: "Vigia de Orçamentos",
        setor: "vendas",
        missao: "Cobra, todo dia, o retorno dos orçamentos enviados que estão parados no Follow-up.",
        justificativa: `${orcamentosParados} orçamentos com valor estão parados no Follow-up há 7 dias ou mais.`,
        config: {
          fonte: "oportunidades",
          filtroDescricao: "Negócios na etapa de Follow-up, com valor, sem movimento há 7 dias ou mais.",
          instrucoes:
            "Para cada negócio, diga ao vendedor há quantos dias o orçamento está sem retorno e sugira uma pergunta curta para retomar a conversa. Use só os números dos dados.",
          agenda: { tipo: "diario", horas: [10], minuto: 0, diasSemana: [1, 2, 3, 4, 5] },
          destinatario: "dono",
          limitePorExecucao: 30,
        },
      });
    }
  }

  const { achados: final, cortados } = limitarPorPessoa(achados);
  const conta = (f: (d: DiagnosticoNegocio) => boolean) => itens.filter((x) => f(x.d)).length;
  const valorParado = [...paradoPorLoja.values()].reduce((s, p) => s + p.valor, 0);
  return {
    resumo: `${plural(conta((d) => d.parado), "negócio parado", "negócios parados")} (${formatarMoeda(valorParado)}), ${conta((d) => d.semValor)} sem valor, ${conta((d) => d.semCliente)} sem cliente.`,
    achados: [...final, ...resumos],
    propostas,
    metricas: {
      abertos: abertas.length,
      parados: conta((d) => d.parado),
      valorParado: Math.round(valorParado),
      semValor: conta((d) => d.semValor),
      semCliente: conta((d) => d.semCliente),
      cortadosPeloTeto: cortados,
    },
  };
}

export const agentePipeline: DefinicaoAgente = {
  id: "pipeline",
  nome: "Analista de Pipeline",
  cargo: "Analista de pipeline",
  setor: "vendas",
  icone: "TrendingUp",
  missao: "Acha os negócios parados, sem valor ou sem cliente, e mostra ao gestor quanto dinheiro está travado em cada loja.",
  agenda: { tipo: "diario", horas: [8], minuto: 0, diasSemana: [1, 2, 3, 4, 5, 6] },
  usaIA: false,
  orcamentoMensalUsd: 0,
  tipo: "nativo",
  executar,
};
