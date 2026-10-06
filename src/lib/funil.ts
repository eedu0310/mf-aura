/**
 * O funil de vendas, agora editável pelo gestor.
 *
 * ANTES: as seis etapas estavam escritas na mão em 28 arquivos — 86 lugares
 * comparando texto. `etapa === "Fechados"` decidia se a venda do mês entrava;
 * `etapa === "Perdidos"` decidia se o negócio tinha morrido; a ordem do funil
 * era um objeto fixo. Renomear uma etapa no banco deixaria todos esses
 * lugares comparando com um nome que não existe mais — os cards sumiriam da
 * tela e as vendas parariam de contar, sem erro nenhum aparecer.
 *
 * A IDEIA AQUI: o código nunca pergunta o NOME da etapa. Pergunta o PAPEL
 * dela. "Esta etapa é a de ganho?" em vez de "esta etapa se chama Fechados?".
 * O nome é do gestor; o papel é do sistema. Assim ele renomeia à vontade.
 *
 * Duas formas de papel, porque o sistema precisa das duas:
 *
 *   tipo  — grosso: aberta | ganho | perda | posvenda. É o que decide se a
 *           venda entra, se o negócio morreu, se saiu do funil de prospecção.
 *   chave — fino: prospeccao, qualificacao, apresentacao, followup,
 *           negociacao, fechamento, posvenda, perda. É o que as regras que
 *           leem a conversa usam para saber onde colocar um "me manda o
 *           orçamento".
 *
 * ETAPA NOVA criada pelo gestor nasce sem chave, e isso é de propósito: a IA
 * e as regras automáticas nunca movem um negócio para uma etapa cujo
 * significado elas não conhecem. Quem move é o vendedor.
 */

export type Etapa = string;

export type TipoEtapa = "aberta" | "ganho" | "perda" | "posvenda";

export type ChaveEtapa =
  | "prospeccao"
  | "qualificacao"
  | "apresentacao"
  | "followup"
  | "negociacao"
  | "fechamento"
  | "posvenda"
  | "perda";

export interface EtapaFunil {
  nome: string;
  ordem: number;
  tipo: TipoEtapa;
  /** Entra na conta do pipeline aberto (o dinheiro que o gestor cobra). */
  contaNoPipeline: boolean;
  probabilidade: "Baixa" | "Média" | "Alta";
  cor: string;
  ativa: boolean;
  chave: ChaveEtapa | null;
}

/**
 * O funil que vale quando o banco ainda não respondeu, ou quando a loja não
 * tem funil próprio gravado.
 *
 * Não é enfeite: sem ele, uma falha de rede faria a tela do pipeline aparecer
 * vazia e o vendedor pensar que perdeu os negócios. É o mesmo desenho que o
 * gestor aprovou e que está gravado para as quatro lojas.
 */
export const FUNIL_PADRAO: EtapaFunil[] = [
  { nome: "Prospecção", ordem: 1, tipo: "aberta", contaNoPipeline: false, probabilidade: "Baixa", cor: "#8696a0", ativa: true, chave: "prospeccao" },
  { nome: "Qualificação e Abordagem", ordem: 2, tipo: "aberta", contaNoPipeline: false, probabilidade: "Baixa", cor: "#7fd1ff", ativa: true, chave: "qualificacao" },
  { nome: "Apresentação", ordem: 3, tipo: "aberta", contaNoPipeline: false, probabilidade: "Média", cor: "#53bdeb", ativa: true, chave: "apresentacao" },
  { nome: "Follow-up", ordem: 4, tipo: "aberta", contaNoPipeline: true, probabilidade: "Média", cor: "#ffd279", ativa: true, chave: "followup" },
  { nome: "Negociação", ordem: 5, tipo: "aberta", contaNoPipeline: true, probabilidade: "Alta", cor: "#ffa65c", ativa: true, chave: "negociacao" },
  { nome: "Fechamento", ordem: 6, tipo: "ganho", contaNoPipeline: true, probabilidade: "Alta", cor: "#00a884", ativa: true, chave: "fechamento" },
  { nome: "Pós-venda", ordem: 7, tipo: "posvenda", contaNoPipeline: false, probabilidade: "Alta", cor: "#9ae6b4", ativa: true, chave: "posvenda" },
  { nome: "Perdidos", ordem: 8, tipo: "perda", contaNoPipeline: false, probabilidade: "Baixa", cor: "#f15c6d", ativa: true, chave: "perda" },
];

/**
 * Nomes que o sistema usou antes de o funil virar editável.
 *
 * Enquanto houver negócio gravado com o nome antigo — e há: 23 em "Proposta",
 * 8 em "Fechados" — perguntar "esta etapa é a de ganho?" tem de responder
 * certo também para eles. Sem isto, no minuto seguinte ao deploy as 8 vendas
 * em "Fechados" deixariam de ser vendas.
 */
const CHAVE_DOS_NOMES_ANTIGOS: Record<string, ChaveEtapa> = {
  "Prospecção": "prospeccao",
  "Apresentação": "apresentacao",
  "Proposta": "followup",
  "Negociação": "negociacao",
  "Fechados": "fechamento",
  "Perdidos": "perda",
  // Nomes novos, para quando a etapa não vier do banco.
  "Qualificação e Abordagem": "qualificacao",
  "Follow-up": "followup",
  "Fechamento": "fechamento",
  "Pós-venda": "posvenda",
};

const TIPO_DA_CHAVE: Record<ChaveEtapa, TipoEtapa> = {
  prospeccao: "aberta",
  qualificacao: "aberta",
  apresentacao: "aberta",
  followup: "aberta",
  negociacao: "aberta",
  fechamento: "ganho",
  posvenda: "posvenda",
  perda: "perda",
};

/** Converte uma linha de `etapas_funil` no formato que o código usa. */
export function daLinha(linha: Record<string, unknown>): EtapaFunil {
  const tipo = String(linha.tipo ?? "aberta") as TipoEtapa;
  return {
    nome: String(linha.nome ?? ""),
    ordem: Number(linha.ordem ?? 0),
    tipo: ["aberta", "ganho", "perda", "posvenda"].includes(tipo) ? tipo : "aberta",
    contaNoPipeline: linha.conta_no_pipeline === true,
    probabilidade: (["Baixa", "Média", "Alta"].includes(String(linha.probabilidade))
      ? String(linha.probabilidade)
      : "Baixa") as "Baixa" | "Média" | "Alta",
    cor: String(linha.cor ?? "#8696a0"),
    ativa: linha.ativa !== false,
    chave: (linha.chave as ChaveEtapa) ?? null,
  };
}

/**
 * A etapa, achada pelo nome.
 *
 * Quando o nome não está no funil — negócio antigo, etapa que o gestor
 * apagou — cai no desenho antigo pela chave equivalente, para o registro não
 * virar órfão. Um negócio em "Proposta" continua sendo um negócio em aberto,
 * e não um registro sem etapa que some da tela.
 */
export function acharEtapa(nome: string | null | undefined, funil: EtapaFunil[]): EtapaFunil | null {
  if (!nome) return null;
  const direta = funil.find((e) => e.nome === nome);
  if (direta) return direta;

  const chave = CHAVE_DOS_NOMES_ANTIGOS[nome];
  if (!chave) return null;
  const porChave = funil.find((e) => e.chave === chave);
  if (porChave) return porChave;

  // Nem no funil da loja nem equivalente: devolve o mínimo necessário para o
  // registro continuar sendo tratado com o papel certo.
  return {
    nome,
    ordem: FUNIL_PADRAO.find((e) => e.chave === chave)?.ordem ?? 0,
    tipo: TIPO_DA_CHAVE[chave],
    contaNoPipeline: false,
    probabilidade: "Baixa",
    cor: "#8696a0",
    ativa: false,
    chave,
  };
}

/** Esta etapa é a que registra a venda? */
export function ehGanho(nome: string | null | undefined, funil: EtapaFunil[]): boolean {
  return acharEtapa(nome, funil)?.tipo === "ganho";
}

/** Esta etapa é a que encerra o negócio como perdido? */
export function ehPerda(nome: string | null | undefined, funil: EtapaFunil[]): boolean {
  return acharEtapa(nome, funil)?.tipo === "perda";
}

/**
 * Negócio decidido: ganho ou perdido. Não se mexe mais nele automaticamente —
 * nem a IA avança, nem a transferência de carteira leva junto.
 */
export function ehFechada(nome: string | null | undefined, funil: EtapaFunil[]): boolean {
  const t = acharEtapa(nome, funil)?.tipo;
  return t === "ganho" || t === "perda";
}

/** Já virou cliente: saiu do funil de prospecção e entrou no pós-venda. */
export function ehPosVenda(nome: string | null | undefined, funil: EtapaFunil[]): boolean {
  return acharEtapa(nome, funil)?.tipo === "posvenda";
}

/** Entra na soma do pipeline aberto que o gestor cobra. */
export function contaNoPipeline(nome: string | null | undefined, funil: EtapaFunil[]): boolean {
  const e = acharEtapa(nome, funil);
  return !!e && e.contaNoPipeline && e.tipo === "aberta";
}

/**
 * Posição no funil, para saber se um negócio avançou ou voltou.
 *
 * Perda fica em -1 de propósito: perder não é avançar, e sem isso a regra
 * "só avança" empurraria negócio para Perdidos achando que é progresso.
 */
export function ordemDe(nome: string | null | undefined, funil: EtapaFunil[]): number {
  const e = acharEtapa(nome, funil);
  if (!e) return -1;
  return e.tipo === "perda" ? -1 : e.ordem;
}

export function corDe(nome: string | null | undefined, funil: EtapaFunil[]): string {
  return acharEtapa(nome, funil)?.cor ?? "#8696a0";
}

export function probabilidadeDe(
  nome: string | null | undefined,
  funil: EtapaFunil[],
): "Baixa" | "Média" | "Alta" {
  return acharEtapa(nome, funil)?.probabilidade ?? "Baixa";
}

/** A etapa que faz um papel. `nomeDaChave("fechamento", funil)` → "Fechamento". */
export function nomeDaChave(chave: ChaveEtapa, funil: EtapaFunil[]): string | null {
  return funil.find((e) => e.chave === chave && e.ativa)?.nome ?? null;
}

/**
 * Em QUAL coluna este negócio aparece.
 *
 * O negócio guarda o nome da etapa como texto. Depois de o gestor renomear
 * "Proposta" para "Follow-up", os 23 negócios gravados como "Proposta"
 * continuam dizendo "Proposta" — e o quadro, que monta cada coluna filtrando
 * pelo nome exato, não acharia nenhum deles. Vinte e três negócios sumiriam
 * da tela do vendedor sem erro nenhum aparecer.
 *
 * Esta função traduz o nome gravado para a etapa viva equivalente. Vale
 * também para o caminho inverso: um negócio de uma etapa que o gestor apagou
 * cai na etapa de papel equivalente em vez de virar invisível.
 */
export function colunaDoNegocio(
  etapaGravada: string | null | undefined,
  funil: EtapaFunil[],
): string | null {
  const e = acharEtapa(etapaGravada, funil);
  if (!e) return etapaGravada ?? null;
  return funil.some((x) => x.nome === e.nome) ? e.nome : (etapaGravada ?? null);
}

/** As etapas que aparecem no quadro do pipeline, na ordem, sem as desligadas. */
export function etapasVisiveis(funil: EtapaFunil[]): EtapaFunil[] {
  return funil.filter((e) => e.ativa).sort((a, b) => a.ordem - b.ordem);
}

/** Só os nomes, na ordem — para listas e para o prompt da IA. */
export function nomesDasEtapas(funil: EtapaFunil[]): string[] {
  return etapasVisiveis(funil).map((e) => e.nome);
}

/**
 * A etapa onde um negócio novo nasce: a primeira em aberto.
 *
 * Pelo nome seria "Prospecção", mas o gestor pode renomear ou desligar essa
 * etapa, e um negócio tem de nascer em algum lugar de qualquer jeito.
 */
export function primeiraEtapa(funil: EtapaFunil[]): string {
  const abertas = etapasVisiveis(funil).filter((e) => e.tipo === "aberta");
  return abertas[0]?.nome ?? FUNIL_PADRAO[0].nome;
}
