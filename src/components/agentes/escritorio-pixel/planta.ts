/**
 * A PLANTA DO ESCRITÓRIO EM PIXEL — só contas, sem desenho (testável sem tela).
 *
 * Pedido do dono (25/11/2026): "ver um escritoriozinho de verdade, separado
 * em salas — vendas, pós-venda, gestão, conhecimento, dados —, clicar em cada
 * agente e ver o que ele está fazendo". Aqui sai a planta: onde fica cada
 * sala, cada mesa, cada porta e cada móvel, em "ladrilhos" (TILE unidades do
 * SVG cada). Quem desenha é sprites.tsx; quem monta a tela é mapa.tsx.
 *
 * Como a planta nasce:
 *
 *   1. uma sala por setor que tem agente (mais a Copa, que é só enfeite);
 *   2. cada agente ganha uma ESTAÇÃO de 3×3 ladrilhos (linha 0: espaço do
 *      crachá; linha 1: cadeira e pessoa; linha 2: mesa com monitor). As
 *      estações formam uma grade de colunas × fileiras que cresce com o
 *      número de agentes da sala; sobra de grade vira mesa vazia;
 *   3. a sala = parede (1 ladrilho) + grade + faixa de móveis à direita +
 *      um corredor embaixo;
 *   4. as salas entram em fileiras, na ordem fixa (Diretoria primeiro, Copa
 *      por último). A largura do prédio é a que menos desperdiça chão e deixa
 *      o desenho quase quadrado (cabe ao lado do mural sem ficar miúdo); cada fileira estica as salas para todas
 *      terem a mesma altura e o prédio ficar retinho;
 *   5. o chão que sobrou recebe móveis pela "receita" do setor (estante na
 *      biblioteca, rack na sala de dados, mesa de reunião na gestão…), sem
 *      tapar porta nem corredor.
 *
 * Tudo é determinístico: os mesmos agentes dão sempre a mesma planta (a tela
 * atualiza a cada 20 s e nada pode "pular" de lugar).
 */
import type { Setor } from "@/lib/agentes/tipos";

/** Tamanho de um ladrilho em unidades do SVG (o desenho é feito nessa grade). */
export const TILE = 16;
/** Uma estação de trabalho: 3 ladrilhos de largura por 3 de altura. */
export const CEL_L = 3;
export const CEL_A = 3;

export type TipoSala = Setor | "outros" | "copa";

export type TipoDecor =
  | "planta"
  | "planta-grande"
  | "estante"
  | "servidor"
  | "sofa"
  | "poltrona"
  | "mesa-redonda"
  | "bebedouro"
  | "arquivo"
  | "balcao"
  | "tapete";

export type TipoParede = "janela" | "quadro" | "relogio" | "mural-avisos" | "tv";

/** Uma estação: (x, y) é o canto de cima à esquerda da célula 3×3, em ladrilhos. */
export interface Lugar {
  x: number;
  y: number;
  agenteId: string | null;
  /** A mesa grande da Diretora. */
  chefe: boolean;
}

export interface Decor {
  tipo: TipoDecor;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Algo pendurado na parede de cima da sala (na fileira y da sala). */
export interface ItemParede {
  tipo: TipoParede;
  x: number;
  w: number;
}

export interface SalaPlanta {
  id: TipoSala;
  rotulo: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
  lugares: Lugar[];
  decor: Decor[];
  parede: ItemParede[];
  /** Primeira fileira (ladrilho) da porta de 2 ladrilhos na parede esquerda; null = sem porta (parede externa). */
  portaEsquerda: number | null;
  /** Primeira coluna da porta de 2 ladrilhos na parede de cima; null = parede externa (tem janelas). */
  portaTopo: number | null;
}

export interface Planta {
  largura: number;
  altura: number;
  salas: SalaPlanta[];
}

export interface AgenteNaPlanta {
  id: string;
  setor: string;
  /** A Diretora: senta na mesa grande da Diretoria. */
  chefe?: boolean;
}

interface Molde {
  rotulo: string;
  /** Teto de colunas de mesas (a sala cresce para baixo depois disso). */
  colsMax: number;
  /** Ladrilhos de chão livre à direita das mesas, para os móveis do setor. */
  faixa: number;
  /** Mesas mínimas (a sala nunca fica só com uma mesa solitária, menos a Diretoria). */
  minLugares: number;
  /** Móveis do setor, na ordem em que entram (o primeiro que couber primeiro). */
  receita: Array<[TipoDecor, number, number]>;
  /** Enfeite que se repete no chão que ainda sobrar (espalhado, com folga). */
  extra: Array<[TipoDecor, number, number]>;
}

const PLANTA: [TipoDecor, number, number] = ["planta", 1, 1];
const PLANTA_G: [TipoDecor, number, number] = ["planta-grande", 1, 2];
const ESTANTE: [TipoDecor, number, number] = ["estante", 2, 2];
const SERVIDOR: [TipoDecor, number, number] = ["servidor", 1, 2];
const SOFA: [TipoDecor, number, number] = ["sofa", 3, 2];
const POLTRONA: [TipoDecor, number, number] = ["poltrona", 1, 1];
const REUNIAO: [TipoDecor, number, number] = ["mesa-redonda", 3, 3];
const BEBEDOURO: [TipoDecor, number, number] = ["bebedouro", 1, 2];
const ARQUIVO: [TipoDecor, number, number] = ["arquivo", 1, 1];

export const MOLDES: Record<TipoSala, Molde> = {
  direcao: {
    rotulo: "Diretoria",
    colsMax: 2,
    faixa: 3,
    minLugares: 1,
    receita: [ESTANTE, PLANTA_G, SOFA, REUNIAO, POLTRONA, PLANTA],
    extra: [PLANTA],
  },
  vendas: {
    rotulo: "Sala de Vendas",
    colsMax: 4,
    faixa: 2,
    minLugares: 2,
    receita: [BEBEDOURO, PLANTA_G, ARQUIVO, PLANTA, SOFA],
    extra: [PLANTA, ARQUIVO],
  },
  atendimento: {
    rotulo: "Atendimento",
    colsMax: 3,
    faixa: 2,
    minLugares: 2,
    receita: [BEBEDOURO, PLANTA_G, POLTRONA, PLANTA],
    extra: [PLANTA, POLTRONA],
  },
  "pos-venda": {
    rotulo: "Pós-venda",
    colsMax: 2,
    faixa: 2,
    minLugares: 2,
    receita: [ARQUIVO, ARQUIVO, PLANTA_G, PLANTA, POLTRONA],
    extra: [PLANTA],
  },
  marketing: {
    rotulo: "Marketing",
    colsMax: 2,
    faixa: 2,
    minLugares: 2,
    receita: [PLANTA_G, POLTRONA, ARQUIVO, PLANTA],
    extra: [PLANTA, POLTRONA],
  },
  gestao: {
    rotulo: "Gestão",
    colsMax: 3,
    faixa: 3,
    minLugares: 2,
    receita: [REUNIAO, ARQUIVO, PLANTA_G, PLANTA],
    extra: [PLANTA, ARQUIVO],
  },
  conhecimento: {
    rotulo: "Conhecimento",
    colsMax: 3,
    faixa: 3,
    minLugares: 2,
    receita: [ESTANTE, ESTANTE, ESTANTE, POLTRONA, PLANTA_G, PLANTA],
    extra: [ESTANTE, POLTRONA],
  },
  dados: {
    rotulo: "Dados",
    colsMax: 2,
    faixa: 3,
    minLugares: 2,
    receita: [SERVIDOR, SERVIDOR, SERVIDOR, SERVIDOR, ARQUIVO, PLANTA],
    extra: [SERVIDOR, SERVIDOR],
  },
  outros: {
    rotulo: "Outros",
    colsMax: 3,
    faixa: 2,
    minLugares: 1,
    receita: [PLANTA_G, ARQUIVO],
    extra: [PLANTA],
  },
  copa: {
    rotulo: "Copa",
    colsMax: 0,
    faixa: 0,
    minLugares: 0,
    receita: [BEBEDOURO, SOFA, PLANTA_G, PLANTA, POLTRONA],
    extra: [PLANTA, POLTRONA],
  },
};

export const ORDEM_SALAS: TipoSala[] = [
  "direcao",
  "vendas",
  "atendimento",
  "pos-venda",
  "marketing",
  "gestao",
  "conhecimento",
  "dados",
  "outros",
  "copa",
];

const SETORES_COM_SALA = new Set<string>(["direcao", "vendas", "atendimento", "pos-venda", "marketing", "gestao", "conhecimento", "dados"]);

/** Tamanho da Copa (sala só de enfeite). */
const COPA_L = 9;
const COPA_A = 7;
/** Proporção que o prédio tenta ter (largura ÷ altura): quase quadrado, para caber ao lado do mural sem ficar miúdo. */
const PROPORCAO_ALVO = 1.1;

/** Quantas colunas de mesas para n agentes (a sala é mais larga que funda). */
export function colunasDaSala(n: number, colsMax: number): number {
  const ideal = n <= 1 ? 1 : n <= 4 ? 2 : n <= 9 ? 3 : 4;
  return Math.max(1, Math.min(colsMax, ideal));
}

/** A sala de cada agente: setor conhecido vai para a sala dele; o resto, "Outros". */
export function salaDoAgente(setor: string): TipoSala {
  return SETORES_COM_SALA.has(setor) ? (setor as TipoSala) : "outros";
}

interface Caixa {
  id: TipoSala;
  agentes: AgenteNaPlanta[];
  cols: number;
  rows: number;
  w: number;
  h: number;
}

function caixasDasSalas(agentes: AgenteNaPlanta[]): Caixa[] {
  const porSala = new Map<TipoSala, AgenteNaPlanta[]>();
  for (const a of agentes) {
    const s = salaDoAgente(a.setor);
    const lista = porSala.get(s) ?? [];
    lista.push(a);
    porSala.set(s, lista);
  }
  const caixas: Caixa[] = [];
  for (const id of ORDEM_SALAS) {
    if (id === "copa") {
      caixas.push({ id, agentes: [], cols: 0, rows: 0, w: COPA_L, h: COPA_A });
      continue;
    }
    const lista = porSala.get(id);
    if (!lista?.length) continue;
    // A chefe senta na primeira mesa (a de cima à esquerda).
    const ordenada = [...lista].sort((a, b) => Number(Boolean(b.chefe)) - Number(Boolean(a.chefe)));
    const m = MOLDES[id];
    const n = Math.max(ordenada.length, m.minLugares);
    const cols = colunasDaSala(n, m.colsMax);
    const rows = Math.ceil(n / cols);
    caixas.push({ id, agentes: ordenada, cols, rows, w: 1 + cols * CEL_L + m.faixa, h: 1 + rows * CEL_A + 1 });
  }
  return caixas;
}

/** Nota de uma divisão em fileiras: chão desperdiçado + distância da proporção alvo (menor é melhor). */
function notaDasFileiras(fileiras: Caixa[][]): number {
  const area = fileiras.reduce((s, f) => s + f.reduce((t, c) => t + c.w * c.h, 0), 0);
  const largura = Math.max(...fileiras.map((f) => f.reduce((s, c) => s + c.w, 0)));
  const altura = fileiras.reduce((s, f) => s + Math.max(...f.map((c) => c.h)), 0);
  const desperdicio = largura * altura - area;
  return desperdicio / area + 0.6 * Math.abs(Math.log(largura / altura / PROPORCAO_ALVO));
}

/**
 * Divide as salas em fileiras, mantendo a ordem. São no máximo 9 salas, então
 * dá para testar TODOS os jeitos de cortar a sequência (2⁸ = 256) e ficar com
 * o de melhor nota — o guloso deixava sala pequena esticada demais.
 */
export function dividirEmFileiras<T extends { w: number; h: number }>(caixas: T[]): T[][] {
  if (caixas.length <= 1) return caixas.length ? [caixas] : [];
  const cortes = caixas.length - 1;
  let melhor: T[][] = [caixas];
  let melhorNota = Number.POSITIVE_INFINITY;
  for (let mascara = 0; mascara < 1 << cortes; mascara++) {
    const fileiras: T[][] = [[caixas[0]]];
    for (let i = 1; i < caixas.length; i++) {
      if (mascara & (1 << (i - 1))) fileiras.push([caixas[i]]);
      else fileiras[fileiras.length - 1].push(caixas[i]);
    }
    const nota = notaDasFileiras(fileiras as unknown as Caixa[][]);
    if (nota < melhorNota - 1e-9) {
      melhor = fileiras;
      melhorNota = nota;
    }
  }
  return melhor;
}

/* ------------------------------------------------------------- móveis */

class Ocupacao {
  readonly w: number;
  readonly h: number;
  private livres: boolean[];
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.livres = new Array(w * h).fill(true);
  }
  dentro(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  livre(x: number, y: number, w: number, h: number, folga = 0): boolean {
    for (let j = y - folga; j < y + h + folga; j++) {
      for (let i = x - folga; i < x + w + folga; i++) {
        const dentroDaPeca = i >= x && i < x + w && j >= y && j < y + h;
        if (!this.dentro(i, j)) {
          if (dentroDaPeca) return false;
          continue;
        }
        if (!this.livres[j * this.w + i]) return false;
      }
    }
    return true;
  }
  contarLivres(): number {
    return this.livres.filter(Boolean).length;
  }
  ocupar(x: number, y: number, w: number, h: number) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.dentro(i, j)) this.livres[j * this.w + i] = false;
  }
  /** Primeiro lugar livre lendo como um livro (de cima para baixo, da esquerda para a direita). */
  procurar(w: number, h: number, folga = 0): { x: number; y: number } | null {
    for (let y = 0; y + h <= this.h; y++) for (let x = 0; x + w <= this.w; x++) if (this.livre(x, y, w, h, folga)) return { x, y };
    return null;
  }
}

function mobiliar(sala: SalaPlanta, temVizinhaADireita: boolean): void {
  const { w, h } = sala;
  const oc = new Ocupacao(w, h);
  // Parede de cima, coluna da porta da esquerda e o corredor de baixo ficam livres.
  oc.ocupar(0, 0, w, 1);
  oc.ocupar(0, 0, 1, h);
  oc.ocupar(0, h - 1, w, 1);
  // Mesas.
  if (sala.cols > 0) oc.ocupar(1, 1, sala.cols * CEL_L, sala.rows * CEL_A);
  // Passagem diante das portas.
  if (sala.portaTopo !== null) oc.ocupar(sala.portaTopo - sala.x, 1, 2, 1);
  if (temVizinhaADireita) oc.ocupar(w - 1, h - 3, 1, 2);

  const decor: Decor[] = [];
  const por = (tipo: TipoDecor, x: number, y: number, dw: number, dh: number) => {
    oc.ocupar(x, y, dw, dh);
    decor.push({ tipo, x: sala.x + x, y: sala.y + y, w: dw, h: dh });
  };

  // Tapete embaixo da mesa da Diretora (é chão: não ocupa lugar).
  for (const l of sala.lugares) {
    if (l.chefe) decor.push({ tipo: "tapete", x: l.x, y: l.y + 1, w: CEL_L, h: 2 });
  }

  const m = MOLDES[sala.id];
  if (sala.id === "copa") {
    // A Copa tem lugar marcado: balcão de café encostado na parede, mesa
    // redonda no meio em cima de um tapete; o resto vem da receita.
    if (oc.livre(1, 1, 3, 1)) por("balcao", 1, 1, 3, 1);
    const mx = Math.max(1, Math.floor((w - 3) / 2));
    const my = Math.max(2, Math.floor((h - 3) / 2));
    if (oc.livre(mx, my, 3, 3)) {
      decor.push({ tipo: "tapete", x: sala.x + mx - 1, y: sala.y + my - 1, w: 5, h: 5 });
      por("mesa-redonda", mx, my, 3, 3);
    }
  }

  for (const [tipo, dw, dh] of m.receita) {
    const lugar = oc.procurar(dw, dh);
    if (lugar) por(tipo, lugar.x, lugar.y, dw, dh);
  }
  // Chão que ainda sobrou: enfeite espalhado, com um ladrilho de folga, e
  // pouco (um a cada ~14 ladrilhos livres, no máximo 4) — sala não é estufa.
  const teto = Math.min(4, Math.floor(oc.contarLivres() / 14));
  for (let i = 0; i < teto && m.extra.length; i++) {
    const [tipo, dw, dh] = m.extra[i % m.extra.length];
    const lugar = oc.procurar(dw, dh, 1);
    if (!lugar) break;
    por(tipo, lugar.x, lugar.y, dw, dh);
  }
  sala.decor = decor;
}

/** Largura de uma placa de sala, em ladrilhos (texto monoespaçado em caixa alta). */
export function larguraDaPlaca(rotulo: string): number {
  return Math.ceil((rotulo.length * 3.6 + 14) / TILE);
}

function pendurar(sala: SalaPlanta): void {
  const itens: ItemParede[] = [];
  const inicio = 1 + larguraDaPlaca(sala.rotulo) + 1; // depois da placa, com um respiro
  const fimLivre = sala.portaTopo !== null ? sala.portaTopo - sala.x - 1 : sala.w - 1; // não pendura na porta
  let x = inicio;
  const cabe = (largura: number) => x + largura <= fimLivre;
  const preferidos: TipoParede[] =
    sala.id === "marketing" || sala.id === "gestao"
      ? ["quadro"]
      : sala.id === "vendas"
        ? ["relogio", "mural-avisos"]
        : sala.id === "copa"
          ? ["tv"]
          : sala.id === "direcao"
            ? ["relogio"]
            : [];
  for (const tipo of preferidos) {
    const largura = tipo === "quadro" ? 3 : tipo === "relogio" ? 1 : 2;
    if (!cabe(largura)) break;
    itens.push({ tipo, x: sala.x + x, w: largura });
    x += largura + 1;
  }
  // Parede de fora (fileira de cima do prédio): janelas no que sobrou.
  if (sala.y === 0) {
    while (cabe(2)) {
      itens.push({ tipo: "janela", x: sala.x + x, w: 2 });
      x += 4;
    }
  }
  sala.parede = itens;
}

/**
 * A planta inteira. `agentes` na ordem que vier (a planta ordena sozinha:
 * chefe primeiro na Diretoria, o resto na ordem recebida).
 */
export function montarPlanta(agentes: AgenteNaPlanta[]): Planta {
  const caixas = caixasDasSalas(agentes);
  const fileiras = dividirEmFileiras(caixas);
  const largura = Math.max(...fileiras.map((f) => f.reduce((s, c) => s + c.w, 0)));

  const salas: SalaPlanta[] = [];
  const vizinhaADireita = new Set<SalaPlanta>();
  let y = 0;
  for (const fileira of fileiras) {
    const altura = Math.max(...fileira.map((c) => c.h));
    const sobra = largura - fileira.reduce((s, c) => s + c.w, 0);
    const cada = Math.floor(sobra / fileira.length);
    let resto = sobra - cada * fileira.length;
    let x = 0;
    fileira.forEach((c, i) => {
      const w = c.w + cada + (resto > 0 ? 1 : 0);
      if (resto > 0) resto -= 1;
      const lugares: Lugar[] = [];
      for (let k = 0; k < c.cols * c.rows; k++) {
        const a = c.agentes[k];
        lugares.push({
          x: x + 1 + (k % c.cols) * CEL_L,
          y: y + 1 + Math.floor(k / c.cols) * CEL_A,
          agenteId: a?.id ?? null,
          chefe: Boolean(a?.chefe) && c.id === "direcao",
        });
      }
      const sala: SalaPlanta = {
        id: c.id,
        rotulo: MOLDES[c.id].rotulo,
        x,
        y,
        w,
        h: altura,
        cols: c.cols,
        rows: c.rows,
        lugares,
        decor: [],
        parede: [],
        portaEsquerda: x > 0 ? y + altura - 3 : null,
        portaTopo: y > 0 ? x + w - 3 : null,
      };
      salas.push(sala);
      if (i < fileira.length - 1) vizinhaADireita.add(sala);
      x += w;
    });
    y += altura;
  }

  for (const s of salas) {
    mobiliar(s, vizinhaADireita.has(s));
    pendurar(s);
  }
  return { largura, altura: y, salas };
}

/** O lugar de cada agente (para a tela posicionar os botões por cima do desenho). */
export function lugaresPorAgente(planta: Planta): Map<string, Lugar & { sala: TipoSala }> {
  const mapa = new Map<string, Lugar & { sala: TipoSala }>();
  for (const s of planta.salas) for (const l of s.lugares) if (l.agenteId) mapa.set(l.agenteId, { ...l, sala: s.id });
  return mapa;
}
