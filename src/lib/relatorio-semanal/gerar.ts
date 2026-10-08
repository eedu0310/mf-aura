import type { SupabaseClient } from "@supabase/supabase-js";
import { coletarSemanaDaLoja, type SemanaDaLoja, type SemanaDoVendedor } from "./coletar";
import { avaliarAtendimento, type AvaliacaoDoAtendimento } from "./avaliar";

/**
 * Versão do formato guardado em relatorios_periodicos.dados_json.
 *
 * A tabela tem um CHECK que só aceita os tipos 'semanal_vendedor',
 * 'semanal_gestor' e 'mensal_diretor'. Criar um tipo novo exigiria derrubar e
 * recriar essa trava à mão no SQL Editor. Então o relatório novo entra como
 * 'semanal_gestor' mesmo — que é o que ele é, o relatório da loja para o
 * gestor — e esta marca diz à tela qual formato ela está lendo. Linha sem
 * `versao` é relatório antigo, só texto.
 */
export const VERSAO_RELATORIO = 2;

export interface VendedorNoRelatorio extends SemanaDoVendedor {
  avaliacao: AvaliacaoDoAtendimento;
}

export interface RelatorioSemanal extends Omit<SemanaDaLoja, "vendedores"> {
  versao: number;
  geradoEm: string;
  vendedores: VendedorNoRelatorio[];
}

const moeda = (n: number) => `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

const diaBR = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

/**
 * Versão em texto puro do relatório.
 *
 * A coluna `conteudo` é NOT NULL e é o que aparece em qualquer lugar que leia
 * o relatório sem entender o JSON novo — inclusive a tela antiga. Então ela
 * precisa ser legível por si só, não um "veja o JSON".
 */
export function relatorioEmTexto(r: RelatorioSemanal): string {
  const L: string[] = [];
  L.push(`RELATÓRIO SEMANAL — ${r.empresa}`);
  L.push(`Período: ${diaBR(r.periodoInicio)} a ${diaBR(r.periodoFim)}`);
  L.push("");
  L.push(
    `A loja: ${r.totais.vendedores} pessoas, ${r.totais.atividades} atividades, ` +
      `${r.totais.visitas} visitas, ${r.totais.clientesNovos} clientes novos, ` +
      `${r.totais.negociosCriados} negócios criados, ${r.totais.negociosGanhos} ganhos, ` +
      `${r.totais.negociosPerdidos} perdidos, ${moeda(r.totais.valorVendido)} vendidos.`,
  );
  L.push(
    `Atendimento: ${r.totais.conversasAtivas} conversas ativas, ` +
      `${r.totais.conversasComAlerta} com alerta da AURA.`,
  );

  for (const v of r.vendedores) {
    L.push("");
    L.push("".padEnd(60, "-"));
    L.push(`${v.nome} — ${v.cargo}`);
    L.push(
      `CRM: ${v.crm.atividades} atividades (${v.crm.visitas} visitas, ` +
        `${v.crm.ligacoes} ligações, ${v.crm.orcamentos} orçamentos)`,
    );
    if (v.prospeccao.porCategoria.length) {
      L.push(
        `Prospecção: ${v.prospeccao.porCategoria
          .map((c) => `${c.categoria} ${c.atividades}`)
          .join(", ")}`,
      );
    }
    L.push(
      `Pipeline: ${v.pipeline.criados} criados, ${v.pipeline.ganhos} ganhos, ` +
        `${v.pipeline.perdidos} perdidos, ${v.pipeline.emAberto} em aberto ` +
        `(${moeda(v.pipeline.valorEmAberto)})`,
    );
    L.push(`Vendas: ${v.vendas.quantidade} — ${moeda(v.vendas.valor)}`);
    L.push(
      `WhatsApp: ${v.atendimento.conversasAtivas} conversas ativas, ` +
        `${v.atendimento.conversasComAlerta} com alerta, ` +
        `${v.atendimento.conversasSemProximaAcao} sem próxima ação`,
    );

    if (v.avaliacao.resumo) {
      L.push("");
      L.push(`Avaliação: ${v.avaliacao.resumo}`);
    }
    if (v.avaliacao.acertos.length) {
      L.push("Acertou:");
      for (const a of v.avaliacao.acertos) L.push(`  + ${a}`);
    }
    if (v.avaliacao.erros.length) {
      L.push("Errou:");
      for (const e of v.avaliacao.erros) {
        L.push(`  - ${e.ponto}${e.exemplo ? ` (ex.: ${e.exemplo})` : ""}`);
        if (e.porque) L.push(`    porque: ${e.porque}`);
      }
    }
    if (v.avaliacao.comoMelhorar.length) {
      L.push("Para a semana que vem:");
      for (const m of v.avaliacao.comoMelhorar) L.push(`  > ${m}`);
    }
  }

  if (r.lacunas.length) {
    L.push("");
    L.push("O QUE ESTE RELATÓRIO NÃO MEDE");
    for (const l of r.lacunas) L.push(`- ${l}`);
  }

  return L.join("\n");
}

/** Avalia em pequenos lotes: rápido, sem disparar dez chamadas de uma vez. */
async function emLotes<T, R>(itens: T[], tamanho: number, f: (i: T) => Promise<R>): Promise<R[]> {
  const saida: R[] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    saida.push(...(await Promise.all(itens.slice(i, i + tamanho).map(f))));
  }
  return saida;
}

export async function gerarRelatorioSemanalDaLoja(
  sb: SupabaseClient,
  empresa: string,
  inicio: Date,
  fim: Date,
): Promise<{ relatorio: RelatorioSemanal; avisos: string[] }> {
  const loja = await coletarSemanaDaLoja(sb, empresa, inicio, fim);

  const avaliacoes = await emLotes(loja.vendedores, 3, (v) => avaliarAtendimento(sb, empresa, v));

  const relatorio: RelatorioSemanal = {
    ...loja,
    versao: VERSAO_RELATORIO,
    geradoEm: new Date().toISOString(),
    vendedores: loja.vendedores.map((v, i) => ({ ...v, avaliacao: avaliacoes[i] })),
  };

  const avisos: string[] = [];
  const texto = relatorioEmTexto(relatorio);

  /**
   * Rodar de novo o mesmo período substitui em vez de empilhar. Sem isso, um
   * sábado em que o cron fosse chamado duas vezes deixaria dois relatórios da
   * mesma semana e a tela mostraria o que viesse primeiro.
   */
  const { error: erroLimpeza } = await sb
    .from("relatorios_periodicos")
    .delete()
    .eq("empresa", empresa)
    .eq("periodo_inicio", relatorio.periodoInicio)
    .eq("periodo_fim", relatorio.periodoFim)
    .in("tipo", ["semanal_gestor", "semanal_vendedor"]);
  if (erroLimpeza) {
    avisos.push(`Não consegui limpar o relatório anterior de ${empresa}: ${erroLimpeza.message}`);
  }

  const { error: erroLoja } = await sb.from("relatorios_periodicos").insert({
    empresa,
    vendedor_id: null,
    tipo: "semanal_gestor",
    periodo_inicio: relatorio.periodoInicio,
    periodo_fim: relatorio.periodoFim,
    conteudo: texto,
    dados_json: relatorio,
  });
  if (erroLoja) {
    throw new Error(`Relatório de ${empresa} ficou pronto mas não salvou: ${erroLoja.message}`);
  }

  /**
   * Cada vendedor também recebe a própria linha, com só a fatia dele. É isso
   * que a tela "meu relatório" do vendedor lê — e é o que garante que ele vê
   * o dele e não o da loja inteira.
   */
  const linhasDoVendedor = relatorio.vendedores.map((v) => ({
    empresa,
    vendedor_id: v.vendedorId,
    tipo: "semanal_vendedor",
    periodo_inicio: relatorio.periodoInicio,
    periodo_fim: relatorio.periodoFim,
    conteudo: relatorioEmTexto({ ...relatorio, vendedores: [v], lacunas: [] }),
    dados_json: { ...v, versao: VERSAO_RELATORIO, empresa, geradoEm: relatorio.geradoEm },
  }));

  if (linhasDoVendedor.length) {
    const { error: erroVendedores } = await sb.from("relatorios_periodicos").insert(linhasDoVendedor);
    if (erroVendedores) {
      avisos.push(
        `O relatório da loja ${empresa} salvou, mas as linhas por vendedor não: ${erroVendedores.message}`,
      );
    }
  }

  for (const v of relatorio.vendedores) {
    if (v.avaliacao.semManual) {
      avisos.push(`${empresa}: sem manual carregado, o apontamento de ${v.nome} ficou sem âncora.`);
      break;
    }
  }

  return { relatorio, avisos };
}
