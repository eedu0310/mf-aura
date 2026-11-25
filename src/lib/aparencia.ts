/**
 * Aparência do sistema: a paleta de cores e o fundo do pipeline que o gestor
 * escolhe para a equipe inteira, mais a agenda de datas comemorativas (Natal,
 * Black Friday, inverno...) que troca a paleta sozinha no período marcado.
 *
 * Como funciona: a paleta vira o atributo data-paleta no <html>, e o CSS
 * (globals.css, "PALETAS") troca as variáveis --aura-*. Nenhuma tela precisa
 * saber qual paleta está valendo. A paleta "aura" é a original, sem troca.
 *
 * Sem banco aqui: a tela do gestor, o aplicador e o teste usam as mesmas
 * regras.
 */

export type IdPaleta =
  | "aura"
  | "terracota"
  | "carvao"
  | "inverno"
  | "ardosia"
  | "oliva"
  | "vinho"
  | "ameixa"
  | "natal"
  | "blackfriday";

export type IdFundo = "liso" | "pontos" | "quadriculado" | "diagonal" | "tijolo" | "chamas" | "degrade" | "colunas";

/** Cores de amostra para o cartão de escolha (claro / escuro). */
interface Amostra {
  menu: string;
  menuTexto: string;
  fundo: string;
  acento: string;
}

export interface Paleta {
  id: IdPaleta;
  nome: string;
  descricao: string;
  /** Paleta pensada para uma data (aparece no grupo "Datas comemorativas"). */
  comemorativa?: boolean;
  claro: Amostra;
  escuro: Amostra;
}

export const PALETAS: Paleta[] = [
  {
    id: "aura",
    nome: "Petróleo (original)",
    descricao: "O visual de sempre da AURA",
    claro: { menu: "#ffffff", menuTexto: "#14181f", fundo: "#f6f7f9", acento: "#138780" },
    escuro: { menu: "#12161d", menuTexto: "#e8ecf1", fundo: "#0b0e13", acento: "#2ea49b" },
  },
  {
    id: "terracota",
    nome: "Areia e terracota",
    descricao: "Quente, lembra fogo e madeira",
    claro: { menu: "#f3ebe0", menuTexto: "#3b2f26", fundo: "#faf7f2", acento: "#c2562b" },
    escuro: { menu: "#1d1814", menuTexto: "#e9dfd4", fundo: "#14110e", acento: "#d0653a" },
  },
  {
    id: "carvao",
    nome: "Carvão e brasa",
    descricao: "Menu escuro, destaque cor de brasa",
    claro: { menu: "#26211e", menuTexto: "#e8dfd8", fundo: "#f7f5f3", acento: "#d9512a" },
    escuro: { menu: "#120f0d", menuTexto: "#e8dfd8", fundo: "#0b0a09", acento: "#e4572e" },
  },
  {
    id: "inverno",
    nome: "Inverno",
    descricao: "Azul gelo com a brasa da lareira",
    claro: { menu: "#1d2b3a", menuTexto: "#e3ebf3", fundo: "#f3f7fb", acento: "#e0602f" },
    escuro: { menu: "#0d151f", menuTexto: "#dbe4ee", fundo: "#080d14", acento: "#ef7440" },
  },
  {
    id: "ardosia",
    nome: "Ardósia e azul",
    descricao: "Sóbria e corporativa",
    claro: { menu: "#e8eef5", menuTexto: "#1c2a3a", fundo: "#f5f8fb", acento: "#2f5d8a" },
    escuro: { menu: "#141c26", menuTexto: "#dbe4ee", fundo: "#0c1118", acento: "#3f7bb5" },
  },
  {
    id: "oliva",
    nome: "Oliva e creme",
    descricao: "Natural e calma",
    claro: { menu: "#eef0e4", menuTexto: "#2c3120", fundo: "#f8f8f2", acento: "#5b6b2e" },
    escuro: { menu: "#171a12", menuTexto: "#e2e6d4", fundo: "#0f110b", acento: "#8fa04a" },
  },
  {
    id: "vinho",
    nome: "Vinho e rosé",
    descricao: "Elegante e marcante",
    claro: { menu: "#f5ecee", menuTexto: "#3a1f26", fundo: "#fbf7f8", acento: "#8c2f45" },
    escuro: { menu: "#1e1215", menuTexto: "#f0dfe3", fundo: "#140c0e", acento: "#b04a63" },
  },
  {
    id: "ameixa",
    nome: "Ameixa e lavanda",
    descricao: "Moderna, cara de aplicativo",
    claro: { menu: "#efedf8", menuTexto: "#24203d", fundo: "#f8f7fc", acento: "#5b4b9a" },
    escuro: { menu: "#17142a", menuTexto: "#e3e0f5", fundo: "#0f0d1c", acento: "#6f5fc0" },
  },
  {
    id: "natal",
    nome: "Natal",
    descricao: "Verde pinheiro e vermelho",
    comemorativa: true,
    claro: { menu: "#14432a", menuTexto: "#e6f2ea", fundo: "#fbf7f4", acento: "#c0262d" },
    escuro: { menu: "#0b2417", menuTexto: "#dcebe1", fundo: "#0a0f0c", acento: "#dc3f45" },
  },
  {
    id: "blackfriday",
    nome: "Black Friday",
    descricao: "Preto e dourado",
    comemorativa: true,
    claro: { menu: "#0d0d0d", menuTexto: "#ece7dc", fundo: "#f6f5f2", acento: "#b8862b" },
    escuro: { menu: "#050505", menuTexto: "#ece7dc", fundo: "#08080a", acento: "#ddb257" },
  },
];

export interface Fundo {
  id: IdFundo;
  nome: string;
  descricao: string;
}

export const FUNDOS: Fundo[] = [
  { id: "liso", nome: "Liso", descricao: "Como era" },
  { id: "pontos", nome: "Pontilhado", descricao: "Pontinhos discretos" },
  { id: "quadriculado", nome: "Quadriculado", descricao: "Linhas finas, de caderno" },
  { id: "diagonal", nome: "Diagonal", descricao: "Listras leves" },
  { id: "tijolo", nome: "Tijolinho", descricao: "Parede de lareira" },
  { id: "chamas", nome: "Chamas", descricao: "Desenho suave de chamas" },
  { id: "degrade", nome: "Degradê", descricao: "Cor da paleta no topo" },
  { id: "colunas", nome: "Colunas pela etapa", descricao: "Cada coluna com a cor dela" },
];

/** Uma data comemorativa: de "MM-DD" até "MM-DD" (pode virar o ano). */
export interface ItemAgenda {
  id: string;
  nome: string;
  paleta: IdPaleta;
  inicio: string;
  fim: string;
  ativo: boolean;
}

/** Sugestões que a tela oferece; ficam desligadas até o gestor ligar. */
export const AGENDA_SUGERIDA: ItemAgenda[] = [
  { id: "inverno", nome: "Temporada de inverno", paleta: "inverno", inicio: "06-01", fim: "08-31", ativo: false },
  { id: "blackfriday", nome: "Black Friday", paleta: "blackfriday", inicio: "11-20", fim: "11-30", ativo: false },
  { id: "natal", nome: "Natal", paleta: "natal", inicio: "12-01", fim: "12-26", ativo: false },
];

export interface ConfigAparencia {
  paleta: IdPaleta;
  fundoPipeline: IdFundo;
  agenda: ItemAgenda[];
}

export const APARENCIA_PADRAO: ConfigAparencia = {
  paleta: "aura",
  fundoPipeline: "liso",
  agenda: AGENDA_SUGERIDA,
};

const IDS_PALETA = new Set(PALETAS.map((p) => p.id));
const IDS_FUNDO = new Set(FUNDOS.map((f) => f.id));
const MMDD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const ehPaleta = (v: unknown): v is IdPaleta => typeof v === "string" && IDS_PALETA.has(v as IdPaleta);
export const ehFundo = (v: unknown): v is IdFundo => typeof v === "string" && IDS_FUNDO.has(v as IdFundo);

/** Lê o que veio do banco sem confiar nele: valor estranho vira o padrão. */
export function normalizarAparencia(bruto: unknown): ConfigAparencia {
  const b = (bruto ?? {}) as Record<string, unknown>;
  const agendaBruta = Array.isArray(b.agenda) ? b.agenda : null;
  const agenda: ItemAgenda[] = agendaBruta
    ? agendaBruta
        .map((x, i) => {
          const a = (x ?? {}) as Record<string, unknown>;
          if (!ehPaleta(a.paleta) || typeof a.inicio !== "string" || typeof a.fim !== "string") return null;
          if (!MMDD.test(a.inicio) || !MMDD.test(a.fim)) return null;
          return {
            id: typeof a.id === "string" && a.id ? a.id : `data-${i}`,
            nome: typeof a.nome === "string" && a.nome.trim() ? a.nome.trim().slice(0, 60) : "Data especial",
            paleta: a.paleta,
            inicio: a.inicio,
            fim: a.fim,
            ativo: a.ativo === true,
          };
        })
        .filter((x): x is ItemAgenda => x !== null)
    : AGENDA_SUGERIDA;
  return {
    paleta: ehPaleta(b.paleta) ? b.paleta : "aura",
    fundoPipeline: ehFundo(b.fundo_pipeline ?? b.fundoPipeline)
      ? ((b.fundo_pipeline ?? b.fundoPipeline) as IdFundo)
      : "liso",
    agenda,
  };
}

/** "MM-DD" de hoje em São Paulo. */
export function hojeMMDD(agora: Date = new Date()): string {
  return agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(5);
}

/** Se "MM-DD" cai na janela; janela que vira o ano (12-20 a 01-06) funciona. */
export function dentroDaJanela(dia: string, inicio: string, fim: string): boolean {
  return inicio <= fim ? dia >= inicio && dia <= fim : dia >= inicio || dia <= fim;
}

/**
 * A paleta que vale hoje: a da primeira data comemorativa ligada que cobre o
 * dia; senão, a escolhida pelo gestor.
 */
export function paletaDoDia(c: ConfigAparencia, dia: string = hojeMMDD()): { paleta: IdPaleta; data: ItemAgenda | null } {
  const data = c.agenda.find((a) => a.ativo && dentroDaJanela(dia, a.inicio, a.fim)) ?? null;
  return { paleta: data ? data.paleta : c.paleta, data };
}

/** Onde o navegador guarda a última aparência, para não piscar ao abrir. */
export const CHAVE_APARENCIA = "aura-aparencia";
/** Evento que a tela do gestor dispara para pré-visualizar ou aplicar. */
export const EVENTO_APARENCIA = "aura:aparencia";

/** Põe a paleta e o fundo no <html> (e guarda para a próxima abertura). */
export function aplicarAparencia(paleta: IdPaleta, fundo: IdFundo, guardar = true) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.dataset.paleta = paleta;
  html.dataset.fundoPipeline = fundo;
  if (guardar) {
    try {
      localStorage.setItem(CHAVE_APARENCIA, JSON.stringify({ p: paleta, f: fundo }));
    } catch {
      /* navegador sem localStorage: só não lembra */
    }
  }
}
