import type { SupabaseClient } from "@supabase/supabase-js";
import { chamarClaude } from "@/lib/aura/texto-ia";
import { nucleoDoManual } from "@/lib/aura/trechos";
import type { SemanaDoVendedor } from "./coletar";

export interface ErroApontado {
  /** O que saiu errado, em uma linha. */
  ponto: string;
  /** Por que isso é erro, de preferência citando o manual. */
  porque: string;
  /** Cliente ou conversa onde isso aconteceu, quando dá para apontar. */
  exemplo: string | null;
}

export interface AvaliacaoDoAtendimento {
  resumo: string;
  acertos: string[];
  erros: ErroApontado[];
  comoMelhorar: string[];
  /** Semana sem atividade: não houve o que avaliar e nada foi inventado. */
  semDados: boolean;
  /** A loja não tem manual carregado, então o apontamento não tem âncora. */
  semManual: boolean;
}

const VAZIA = (semDados: boolean, semManual: boolean, resumo: string): AvaliacaoDoAtendimento => ({
  resumo,
  acertos: [],
  erros: [],
  comoMelhorar: [],
  semDados,
  semManual,
});

/**
 * O que a AURA já disse na semana, resumido para a síntese.
 *
 * Importante para o custo: a análise conversa por conversa JÁ aconteceu
 * durante a semana e está guardada. Aqui não se reanalisa conversa nenhuma —
 * agrega-se o que ela apontou. É uma chamada por vendedor por semana.
 */
function materiaPrima(v: SemanaDoVendedor): string {
  const linhas: string[] = [];

  linhas.push(`VENDEDOR: ${v.nome} (${v.cargo})`);
  linhas.push("");
  linhas.push("NÚMEROS DA SEMANA");
  linhas.push(`Atividades registradas no CRM: ${v.crm.atividades}`);
  if (v.crm.porTipo.length) {
    linhas.push(`  por tipo: ${v.crm.porTipo.map((t) => `${t.tipo} ${t.n}`).join(", ")}`);
  }
  linhas.push(`Visitas: ${v.crm.visitas} | Ligações: ${v.crm.ligacoes} | Orçamentos: ${v.crm.orcamentos}`);
  linhas.push(`Clientes novos cadastrados: ${v.prospeccao.clientesNovos}`);
  if (v.prospeccao.porCategoria.length) {
    linhas.push(
      `Prospecção por categoria: ${v.prospeccao.porCategoria
        .map((c) => `${c.categoria} (${c.atividades} atividades, ${c.clientesNovos} novos)`)
        .join(", ")}`,
    );
  }
  linhas.push(
    `Pipeline: ${v.pipeline.criados} negócios criados, ${v.pipeline.ganhos} ganhos, ` +
      `${v.pipeline.perdidos} perdidos, ${v.pipeline.emAberto} em aberto ` +
      `(R$ ${v.pipeline.valorEmAberto.toLocaleString("pt-BR")})`,
  );
  if (v.pipeline.motivosDePerda.length) {
    linhas.push(`Motivos de perda: ${v.pipeline.motivosDePerda.map((m) => `${m.motivo} (${m.n})`).join(", ")}`);
  }
  linhas.push(
    `Vendas: ${v.vendas.quantidade}, R$ ${v.vendas.valor.toLocaleString("pt-BR")} ` +
      `(valor já dividido quando o atendimento foi em dupla)`,
  );

  linhas.push("");
  linhas.push("ATENDIMENTO NO WHATSAPP");
  linhas.push(
    `Conversas ativas na semana: ${v.atendimento.conversasAtivas} ` +
      `(${v.atendimento.conversasNovas} novas). ` +
      `Com alerta da AURA: ${v.atendimento.conversasComAlerta}. ` +
      `Sem próxima ação definida: ${v.atendimento.conversasSemProximaAcao}. ` +
      `Marcadas como não comerciais: ${v.atendimento.conversasIgnoradas}.`,
  );

  if (v.atendimento.alertas.length) {
    linhas.push("");
    linhas.push("ALERTAS QUE A AURA JÁ LEVANTOU NAS CONVERSAS DESTA SEMANA");
    linhas.push("(o número é em quantas conversas o mesmo alerta apareceu)");
    for (const a of v.atendimento.alertas.slice(0, 25)) {
      linhas.push(`- [${a.conversas}x] ${a.texto}`);
    }
  }

  if (v.atendimento.dicas.length) {
    linhas.push("");
    linhas.push("DICAS QUE A AURA JÁ DEU NAS CONVERSAS DESTA SEMANA");
    for (const d of v.atendimento.dicas.slice(0, 25)) {
      linhas.push(`- [${d.conversas}x] ${d.texto}`);
    }
  }

  if (v.atendimento.exemplos.length) {
    linhas.push("");
    linhas.push("CONVERSAS CONCRETAS (use estes nomes para exemplificar)");
    for (const e of v.atendimento.exemplos) {
      linhas.push(`- ${e.cliente}${e.etapa ? ` (${e.etapa})` : ""}: ${e.alerta}`);
    }
  }

  if (v.metas) {
    linhas.push("");
    linhas.push("METAS DO MÊS QUE ELE DEFINIU E O GESTOR APROVOU");
    linhas.push(
      `Faturamento R$ ${v.metas.faturamento.toLocaleString("pt-BR")} | ` +
        `Clientes novos ${v.metas.clientesNovos} | Arquitetos ${v.metas.arquitetos} | ` +
        `Construtoras ${v.metas.construtoras} | Obras ${v.metas.obras} | ` +
        `Visitas ${v.metas.visitas} | Ligações ${v.metas.ligacoes}`,
    );
    linhas.push("(são metas do MÊS; a semana é cerca de um quarto disso)");
  } else {
    linhas.push("");
    linhas.push("Este vendedor não tem meta do mês aprovada, então não cobre meta dele.");
  }

  return linhas.join("\n");
}

const SISTEMA = `Você é a AURA, analista de vendas de uma rede de lojas de lareiras, churrasqueiras e aquecimento (Grupo MF). Avalie a semana de UM vendedor e aponte onde o atendimento dele seguiu ou não seguiu o manual da casa.

Você recebe: os números do CRM dele na semana, e os alertas e dicas que você mesma já registrou conversa por conversa durante a semana. Esses alertas são a sua evidência — é a partir deles que você aponta o erro.

REGRAS DURAS:
- Nunca invente número, nome de cliente ou fato. Se um dado não está no material, não fale dele.
- Ao apontar um erro, diga por que é erro ancorando no manual da casa quando o manual tratar daquilo. Se o manual não tratar, diga que é boa prática comercial, sem inventar citação.
- Cite cliente pelo nome quando a lista de conversas concretas permitir. Apontamento genérico não ajuda ninguém.
- Um alerta que apareceu em muitas conversas é padrão, não acidente: trate-o como prioridade.
- Seja direto e respeitoso. Isso vai ser lido pelo vendedor e pelo gestor.
- Se a semana teve pouca coisa, diga isso com honestidade em vez de encher linguiça.

TAMANHO (a resposta precisa caber inteira; resposta cortada é perdida):
- "resumo": no máximo 3 frases.
- "acertos": no máximo 3 itens, uma linha cada.
- "erros": no máximo 4 itens. "ponto" em uma linha; "porque" em no máximo 2 frases.
- "comoMelhorar": no máximo 4 itens, uma linha cada.
- Prefira o apontamento mais importante a listar tudo. O que ficou de fora
  aparece na semana seguinte se continuar acontecendo.

Responda SOMENTE com um JSON válido, sem cercas de código, nesta forma:
{
  "resumo": "2 a 3 frases sobre como foi a semana dele",
  "acertos": ["o que ele fez bem, com número ou nome quando houver"],
  "erros": [{"ponto": "o que saiu errado", "porque": "por que é errado, citando o manual quando couber", "exemplo": "cliente ou conversa, ou null"}],
  "comoMelhorar": ["ação concreta para a semana que vem, na ordem de prioridade"]
}`;

export async function avaliarAtendimento(
  sb: SupabaseClient,
  empresa: string,
  v: SemanaDoVendedor,
): Promise<AvaliacaoDoAtendimento> {
  const semAtividade = v.crm.atividades === 0 && v.atendimento.conversasAtivas === 0 && v.vendas.quantidade === 0;

  /**
   * Semana sem nada registrado não vai para a IA. Não é economia só: pedir
   * análise de uma semana vazia é pedir para a IA preencher o vazio, e o
   * vendedor receberia um apontamento sobre uma semana que não existiu.
   */
  if (semAtividade) {
    return VAZIA(
      true,
      false,
      `${v.nome} não tem nenhuma atividade, conversa ou venda registrada nesta semana. ` +
        `Sem registro não há o que avaliar — vale checar se ele está usando o CRM.`,
    );
  }

  const manual = await nucleoDoManual(sb, empresa);
  const semManual = !manual.trim();

  const pergunta = semManual
    ? materiaPrima(v)
    : `MANUAL DA CASA (use para ancorar os apontamentos):\n${manual}\n\n---\n\n${materiaPrima(v)}`;

  let bruto: string;
  try {
    bruto = await chamarClaude({
      sistema: SISTEMA,
      pergunta,
      /**
       * Teto alto de propósito. Com 2.000, DEZ das doze avaliações da primeira
       * rodada real bateram no limite (saída média de 1.986 tokens): o JSON
       * chegava cortado no meio, o parse falhava e o relatório mostrava o
       * texto cru em vez dos acertos e erros separados. O prompt agora limita
       * a quantidade de itens, e este teto dá a folga para a resposta fechar.
       */
      maxTokens: 4000,
      funcao: "relatorio-semanal-atendimento",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro desconhecido";
    console.error(`avaliarAtendimento: IA falhou para ${v.nome}:`, err);
    return VAZIA(false, semManual, `Não consegui avaliar o atendimento de ${v.nome}: ${msg}`);
  }

  /**
   * A IA às vezes embrulha o JSON em cercas de código mesmo mandado não
   * fazer. Vale limpar antes de desistir — e se nem assim der, o texto cru
   * vai no resumo em vez de o relatório sair vazio.
   */
  const limpo = bruto.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const abre = limpo.indexOf("{");
  const fecha = limpo.lastIndexOf("}");

  try {
    if (abre < 0 || fecha <= abre) throw new Error("sem JSON na resposta");
    const j = JSON.parse(limpo.slice(abre, fecha + 1)) as Record<string, unknown>;
    const lista = (x: unknown) =>
      Array.isArray(x) ? x.map((i) => String(i).trim()).filter(Boolean) : [];

    return {
      resumo: String(j.resumo ?? "").trim(),
      acertos: lista(j.acertos),
      erros: Array.isArray(j.erros)
        ? (j.erros as Record<string, unknown>[])
            .map((e) => ({
              ponto: String(e?.ponto ?? "").trim(),
              porque: String(e?.porque ?? "").trim(),
              exemplo: e?.exemplo ? String(e.exemplo).trim() : null,
            }))
            .filter((e) => e.ponto)
        : [],
      comoMelhorar: lista(j.comoMelhorar),
      semDados: false,
      semManual,
    };
  } catch {
    /**
     * Resposta cortada tem assinatura: começa com '{' e não fecha. Vale
     * distinguir no log, porque o conserto é diferente — cortada pede mais
     * teto ou menos itens; malformada pede ajuste no prompt.
     */
    const cortada = limpo.startsWith("{") && !limpo.trimEnd().endsWith("}");
    console.error(
      `avaliarAtendimento: ${cortada ? "resposta CORTADA no limite de tokens" : "resposta não era JSON"} para ${v.nome}` +
        ` (${limpo.length} caracteres)`,
    );
    return VAZIA(false, semManual, limpo.slice(0, 1200));
  }
}
