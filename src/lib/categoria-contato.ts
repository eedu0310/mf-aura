/**
 * O que é um contato: natureza e categoria.
 *
 * Dois eixos que respondem perguntas diferentes e por isso não se misturam:
 *
 *   natureza  — o que ele é PARA O NEGÓCIO. Decide se entra no pipeline.
 *   categoria — o que ele é NO MERCADO. Decide como se fala com ele.
 *
 * Um arquiteto pode ser lead (vai especificar uma obra), não-lead (ligou só
 * para tirar dúvida técnica de um projeto que não é nosso) ou cliente (já
 * comprou). Os dois eixos são independentes.
 *
 * A lista de categorias é a mesma de relacionamentos.categoria. Ela estava
 * copiada em quatro arquivos de tela; agora mora aqui, para a etiqueta do
 * WhatsApp e o cadastro da carteira nunca discordarem sobre o que existe.
 */

export const NATUREZAS = ["lead", "nao_lead", "cliente"] as const;
export type NaturezaContato = (typeof NATUREZAS)[number];

export const INFO_NATUREZA: Record<
  NaturezaContato,
  { label: string; curto: string; descricao: string; cor: string; fundo: string }
> = {
  lead: {
    label: "Lead",
    curto: "Lead",
    descricao: "Cliente ou possível cliente. Entra no pipeline.",
    cor: "#00a884",
    fundo: "#0a332c",
  },
  nao_lead: {
    label: "Não é lead",
    curto: "Não é lead",
    // Instalador, colega, chefe, amigo, fornecedor. A IA para de acompanhar.
    descricao: "Instalador, colega, fornecedor, amigo. A AURA não acompanha.",
    cor: "#8696a0",
    fundo: "#202c33",
  },
  cliente: {
    label: "Já é nosso cliente",
    curto: "Cliente",
    descricao: "Já comprou da casa. É pós-venda, não prospecção.",
    cor: "#53bdeb",
    fundo: "#0d2b36",
  },
};

/** Por que não é lead. Serve para a AURA aprender o padrão, não só obedecer. */
export const MOTIVOS_NAO_LEAD = [
  "Instalador",
  "Fornecedor",
  "Colega de equipe",
  "Gestor ou chefe",
  "Amigo ou família",
  "Suporte técnico",
  "Outro assunto",
] as const;
export type MotivoNaoLead = (typeof MOTIVOS_NAO_LEAD)[number];

export const CATEGORIAS_CONTATO = [
  "Cliente Final",
  "Arquiteto",
  "Construtora",
  "Revendedor",
  "Engenheiro",
  "Designer de Interiores",
  "Consultor",
  "Obra",
  "Distribuidor",
  "Outro",
] as const;
export type CategoriaContato = (typeof CATEGORIAS_CONTATO)[number];

/**
 * Etiqueta de cada categoria: o texto curto que cabe ao lado do nome na lista
 * de conversas, e a cor que o vendedor reconhece sem ler.
 */
export const INFO_CATEGORIA: Record<CategoriaContato, { curto: string; cor: string; fundo: string }> = {
  "Cliente Final": { curto: "Final", cor: "#aebac1", fundo: "#2a3942" },
  Arquiteto: { curto: "Arquiteto", cor: "#c9a7ff", fundo: "#2c2440" },
  Construtora: { curto: "Construtora", cor: "#ffa65c", fundo: "#3d2a19" },
  Revendedor: { curto: "Revenda", cor: "#ffd279", fundo: "#3d3219" },
  Engenheiro: { curto: "Engenheiro", cor: "#7fd1ff", fundo: "#13303d" },
  "Designer de Interiores": { curto: "Design", cor: "#ff9ec7", fundo: "#3a1f2d" },
  Consultor: { curto: "Consultor", cor: "#9ae6b4", fundo: "#17352a" },
  Obra: { curto: "Obra", cor: "#d9c48a", fundo: "#33301c" },
  Distribuidor: { curto: "Distrib.", cor: "#8fd4c1", fundo: "#17352f" },
  Outro: { curto: "Outro", cor: "#8696a0", fundo: "#202c33" },
};

export function ehCategoria(v: unknown): v is CategoriaContato {
  return typeof v === "string" && (CATEGORIAS_CONTATO as readonly string[]).includes(v);
}

export function ehNatureza(v: unknown): v is NaturezaContato {
  return typeof v === "string" && (NATUREZAS as readonly string[]).includes(v);
}
