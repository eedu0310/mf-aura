/**
 * QUEM ANDA PARA ONDE NO ESCRITÓRIO — só contas (testável sem tela).
 *
 * Pedido do dono (27/11/2026): "os agentes que não estiverem trabalhando
 * podem estar na copa, na sala de descanso ou fazendo outra coisa, e se um
 * precisa ir até outro agente ele vai caminhar até ele, para mostrar que o
 * sistema está funcionando de verdade".
 *
 * Aqui ficam as peças sem desenho:
 *
 *   montarMalha ...... onde dá para pisar: o chão das salas menos móveis e
 *                      mesas; a parede de cima só nas portas; entre duas salas
 *                      lado a lado, só pela porta da esquerda;
 *   caminho .......... o caminho mais curto (busca em largura, 4 direções)
 *                      de um ladrilho até o mais perto de uma lista de alvos;
 *   pontosDeLazer .... os lugares de quem está sem tarefa: café no balcão,
 *                      papo na mesa da copa, sofá e poltronas, bebedouro,
 *                      estante, servidores, arquivo, planta para regar;
 *   escolherLazer .... quem vai para qual lugar. Um lugar por agente; cada um
 *                      troca de lugar de tempos em tempos (cada um no seu
 *                      ritmo), e Copa e Descanso são os preferidos.
 *
 * O motor que move os bonecos na tela é andar.ts; ele usa só o que está aqui.
 */
import { hashTexto } from "./aparencia";
import { CEL_L, TILE as U, geometriaDaEstacao, type Lugar, type Planta, type SalaPlanta, type TipoSala } from "./planta";

export interface Ladrilho {
  x: number;
  y: number;
}

/** Um ponto no desenho (unidades do SVG). Para gente: onde ficam os pés. */
export interface Ponto {
  x: number;
  y: number;
}

/* ---------------------------------------------------------------- malha */

export interface Malha {
  largura: number;
  altura: number;
  /** 1 = dá para pisar. */
  livre: Uint8Array;
  /** Índice da sala dona do ladrilho (-1 = fora do prédio). */
  dono: Int16Array;
  salas: SalaPlanta[];
}

export function montarMalha(planta: Planta): Malha {
  const { largura, altura } = planta;
  const livre = new Uint8Array(largura * altura);
  const dono = new Int16Array(largura * altura).fill(-1);
  const marcar = (x: number, y: number, w: number, h: number, v: 0 | 1) => {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < largura && j < altura) livre[j * largura + i] = v;
  };
  planta.salas.forEach((s, k) => {
    for (let j = s.y; j < s.y + s.h; j++) for (let i = s.x; i < s.x + s.w; i++) dono[j * largura + i] = k;
    // Chão: tudo menos a parede de cima (fileira s.y)…
    marcar(s.x, s.y + 1, s.w, s.h - 1, 1);
    // …que só deixa passar na porta.
    if (s.portaTopo !== null) marcar(s.portaTopo, s.y, 2, 1, 1);
  });
  for (const s of planta.salas) {
    for (const d of s.decor) if (d.tipo !== "tapete") marcar(d.x, d.y, d.w, d.h, 0);
    // Estação: fileira 0 é chão (o espaço do crachá); cadeira e mesa, não.
    for (const l of s.lugares) marcar(l.x, l.y + 1, CEL_L, 2, 0);
  }
  return { largura, altura, livre, dono, salas: planta.salas };
}

export function pisavel(m: Malha, t: Ladrilho): boolean {
  return t.x >= 0 && t.y >= 0 && t.x < m.largura && t.y < m.altura && m.livre[t.y * m.largura + t.x] === 1;
}

/** Dá para ir de a até o vizinho b? (os dois pisáveis; entre salas lado a lado, só pela porta). */
function passa(m: Malha, ax: number, ay: number, bx: number, by: number): boolean {
  if (!m.livre[by * m.largura + bx]) return false;
  const da = m.dono[ay * m.largura + ax];
  const db = m.dono[by * m.largura + bx];
  if (da === db || ay !== by) return true; // mesma sala, ou subindo/descendo pela porta do topo
  // Lado a lado: a sala da direita é a que tem a porta da esquerda.
  const direita = m.salas[bx > ax ? db : da];
  const pe = direita?.portaEsquerda;
  return pe !== null && pe !== undefined && (ay === pe || ay === pe + 1);
}

const PASSOS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * O caminho mais curto de `de` até o alvo mais perto (inclusive os dois
 * pontas). null = não tem como chegar (ou `de` não é chão).
 */
export function caminho(m: Malha, de: Ladrilho, alvos: Ladrilho[]): Ladrilho[] | null {
  if (!pisavel(m, de)) return null;
  const objetivo = new Set(alvos.filter((a) => pisavel(m, a)).map((a) => a.y * m.largura + a.x));
  if (!objetivo.size) return null;
  const inicio = de.y * m.largura + de.x;
  const veioDe = new Int32Array(m.largura * m.altura).fill(-1);
  veioDe[inicio] = inicio;
  const fila = [inicio];
  for (let i = 0; i < fila.length; i++) {
    const atual = fila[i];
    if (objetivo.has(atual)) {
      const rota: Ladrilho[] = [];
      for (let c = atual; ; c = veioDe[c]) {
        rota.push({ x: c % m.largura, y: Math.floor(c / m.largura) });
        if (c === inicio) break;
      }
      return rota.reverse();
    }
    const ax = atual % m.largura;
    const ay = Math.floor(atual / m.largura);
    for (const [dx, dy] of PASSOS) {
      const bx = ax + dx;
      const by = ay + dy;
      if (bx < 0 || by < 0 || bx >= m.largura || by >= m.altura) continue;
      const b = by * m.largura + bx;
      if (veioDe[b] !== -1 || !passa(m, ax, ay, bx, by)) continue;
      veioDe[b] = atual;
      fila.push(b);
    }
  }
  return null;
}

/** Onde ficam os pés de quem está em pé no ladrilho. */
export function centro(t: Ladrilho): Ponto {
  return { x: t.x * U + 8, y: t.y * U + 14 };
}

/** O ladrilho em que um ponto (pés) está. */
export function ladrilhoDe(p: Ponto): Ladrilho {
  return { x: Math.floor(p.x / U), y: Math.floor((p.y - 1) / U) };
}

/* ---------------------------------------------------------------- mesa */

/** O ladrilho de chão logo atrás da cadeira: é por ali que se chega e se sai da mesa. */
export function ladrilhoDaMesa(l: Pick<Lugar, "x" | "y">): Ladrilho {
  return { x: l.x + 1, y: l.y };
}

/** Onde a pessoa fica em pé atrás da cadeira, antes de sentar (e logo depois de levantar). */
export function peAtrasDaCadeira(l: Pick<Lugar, "x" | "y" | "chefe">): Ponto {
  const g = geometriaDaEstacao(l);
  return { x: g.cx, y: g.oy + 15 };
}

/**
 * Distância dos pés até o alto do crachá de quem está em pé. A âncora de
 * quem está sentado na mesa é escolhida para o crachá cair no mesmo lugar
 * de sempre (acima da cadeira).
 */
export function crachaAcimaDosPes(chefe: boolean): number {
  // A coroa da Diretora é mais alta: o crachá sobe junto.
  return chefe ? 38 : 33;
}

export function ancoraNaMesa(l: Pick<Lugar, "x" | "y" | "chefe">): Ponto {
  const g = geometriaDaEstacao(l);
  return { x: g.cx, y: g.crachaY + crachaAcimaDosPes(l.chefe) };
}

/* --------------------------------------------------------------- lazer */

export type PoseLazer = "em-pe" | "sentado";

export interface PontoDeLazer {
  chave: string;
  sala: TipoSala;
  /** O ladrilho de chão aonde se chega andando. */
  ladrilho: Ladrilho;
  /** Onde ficam os pés no fim (no assento, para quem senta). */
  pe: Ponto;
  pose: PoseLazer;
  /** Olhando para a esquerda (o desenho vira). */
  vira: boolean;
  /** Com uma xícara na mão. */
  cafe: boolean;
  /** "Tomando um café · Copa" — aparece ao passar o mouse. */
  atividade: string;
  /** Copa ou Sala de Descanso: os lugares preferidos de quem está sem tarefa. */
  descanso: boolean;
}

const SALAS_DE_DESCANSO = new Set<TipoSala>(["copa", "descanso"]);

export function pontosDeLazer(planta: Planta, m: Malha): PontoDeLazer[] {
  const saida: PontoDeLazer[] = [];
  const usados = new Set<string>();
  for (const s of planta.salas) {
    const descanso = SALAS_DE_DESCANSO.has(s.id);
    const ponto = (
      tipo: string,
      opcoes: Ladrilho[],
      fazer: string,
      extra: { pe?: (t: Ladrilho) => Ponto; pose?: PoseLazer; vira?: (t: Ladrilho) => boolean; cafe?: boolean } = {},
    ) => {
      const t = opcoes.find((o) => pisavel(m, o) && m.dono[o.y * m.largura + o.x] === planta.salas.indexOf(s));
      if (!t) return;
      const pe = extra.pe ? extra.pe(t) : centro(t);
      const chave = `${tipo}:${pe.x},${pe.y}`;
      if (usados.has(chave)) return;
      usados.add(chave);
      saida.push({
        chave,
        sala: s.id,
        ladrilho: t,
        pe,
        pose: extra.pose ?? "em-pe",
        vira: extra.vira ? extra.vira(t) : false,
        cafe: Boolean(extra.cafe),
        atividade: `${fazer} · ${s.rotulo}`,
        descanso,
      });
    };
    for (const d of s.decor) {
      switch (d.tipo) {
        case "balcao":
          for (let i = 0; i < d.w; i++) ponto("balcao", [{ x: d.x + i, y: d.y + 1 }], "Tomando um café", { cafe: true });
          break;
        case "mesa-redonda":
          if (!descanso) break;
          ponto("mesa", [{ x: d.x - 1, y: d.y + 1 }], "Batendo papo", { cafe: true });
          ponto("mesa", [{ x: d.x + d.w, y: d.y + 1 }], "Batendo papo", { vira: () => true });
          ponto("mesa", [{ x: d.x + 1, y: d.y + d.h }], "Batendo papo", { cafe: true });
          break;
        case "sofa":
          // Dois lugares no sofá; chega-se pelo ladrilho logo embaixo de cada um.
          for (const [i, dx] of [
            [0, 14],
            [2, 34],
          ] as const) {
            ponto("sofa", [{ x: d.x + i, y: d.y + d.h }], "Descansando no sofá", {
              pose: "sentado",
              pe: () => ({ x: d.x * U + dx, y: d.y * U + 22 }),
              vira: () => i === 2,
            });
          }
          break;
        case "poltrona":
          ponto(
            "poltrona",
            [
              { x: d.x, y: d.y + 1 },
              { x: d.x + 1, y: d.y },
              { x: d.x - 1, y: d.y },
            ],
            "Descansando na poltrona",
            { pose: "sentado", pe: () => ({ x: d.x * U + 8, y: d.y * U + 13 }) },
          );
          break;
        case "bebedouro":
          ponto(
            "bebedouro",
            [
              { x: d.x + 1, y: d.y + 1 },
              { x: d.x - 1, y: d.y + 1 },
              { x: d.x, y: d.y + d.h },
            ],
            "Pegando água",
            { vira: (t) => t.x > d.x },
          );
          break;
        case "estante":
          ponto(
            "estante",
            [
              { x: d.x, y: d.y + d.h },
              { x: d.x + 1, y: d.y + d.h },
            ],
            "Procurando um livro",
          );
          break;
        case "servidor":
          ponto("servidor", [{ x: d.x, y: d.y + d.h }], "Conferindo os servidores");
          break;
        case "arquivo":
          ponto("arquivo", [{ x: d.x, y: d.y + d.h }], "Mexendo no arquivo");
          break;
        case "planta-grande":
          ponto(
            "planta",
            [
              { x: d.x + 1, y: d.y + 1 },
              { x: d.x - 1, y: d.y + 1 },
            ],
            "Regando a planta",
            { vira: (t) => t.x > d.x },
          );
          break;
        default:
          break;
      }
    }
  }
  // Móvel encurralado (poltrona num canto, planta entre a estante e a parede):
  // o lugar só vale se dá para chegar nele a partir do resto do prédio.
  const ligado = maiorRegiao(m);
  return saida.filter((p) => ligado[p.ladrilho.y * m.largura + p.ladrilho.x] === 1);
}

/** Marca (1) o maior pedaço de chão ligado: é onde todo mundo circula. */
export function maiorRegiao(m: Malha): Uint8Array {
  const regiao = new Int32Array(m.largura * m.altura).fill(-1);
  let melhor = -1;
  let melhorTam = 0;
  for (let k = 0, id = 0; k < regiao.length; k++) {
    if (!m.livre[k] || regiao[k] !== -1) continue;
    const fila = [k];
    regiao[k] = id;
    for (let i = 0; i < fila.length; i++) {
      const ax = fila[i] % m.largura;
      const ay = Math.floor(fila[i] / m.largura);
      for (const [dx, dy] of PASSOS) {
        const bx = ax + dx;
        const by = ay + dy;
        if (bx < 0 || by < 0 || bx >= m.largura || by >= m.altura) continue;
        const b = by * m.largura + bx;
        if (regiao[b] !== -1 || !passa(m, ax, ay, bx, by)) continue;
        regiao[b] = id;
        fila.push(b);
      }
    }
    if (fila.length > melhorTam) {
      melhorTam = fila.length;
      melhor = id;
    }
    id += 1;
  }
  return Uint8Array.from(regiao, (r) => (r === melhor ? 1 : 0));
}

/** De quanto em quanto tempo quem está sem tarefa troca de lugar (cada um com seu atraso). */
export const TROCA_DE_LUGAR_MS = 4 * 60_000;

/** A "rodada" de lugar do agente: muda a cada TROCA_DE_LUGAR_MS, cada um num momento diferente. */
export function rodadaDeLugar(id: string, agora: number, periodo = TROCA_DE_LUGAR_MS): number {
  return Math.floor((agora + (hashTexto(`atraso:${id}`) % periodo)) / periodo);
}

/**
 * Um lugar para cada agente sem tarefa. Quem já tem lugar nesta rodada e o
 * lugar continua livre, fica; o resto escolhe pelo sorteio estável
 * (id + rodada), preferindo Copa e Descanso. Sobrou gente e faltou lugar:
 * fica sem (e o motor deixa na mesa).
 */
export function escolherLazer(
  ids: string[],
  pontos: PontoDeLazer[],
  atuais: Map<string, { chave: string; rodada: number }>,
  agora: number,
  periodo = TROCA_DE_LUGAR_MS,
): Map<string, { ponto: PontoDeLazer; rodada: number }> {
  const porChave = new Map(pontos.map((p) => [p.chave, p]));
  const ocupados = new Set<string>();
  const saida = new Map<string, { ponto: PontoDeLazer; rodada: number }>();
  const ordem = [...ids].sort();
  const rodadas = new Map(ordem.map((id) => [id, rodadaDeLugar(id, agora, periodo)]));
  for (const id of ordem) {
    const atual = atuais.get(id);
    const p = atual && porChave.get(atual.chave);
    if (p && atual.rodada === rodadas.get(id) && !ocupados.has(p.chave)) {
      ocupados.add(p.chave);
      saida.set(id, { ponto: p, rodada: atual.rodada });
    }
  }
  for (const id of ordem) {
    if (saida.has(id)) continue;
    const rodada = rodadas.get(id)!;
    let melhor: PontoDeLazer | null = null;
    let nota = Number.POSITIVE_INFINITY;
    for (const p of pontos) {
      if (ocupados.has(p.chave)) continue;
      // Sorteio estável; os lugares fora de Copa e Descanso levam "multa" e
      // só ganham quando a sorte ajuda (ou quando a copa encheu).
      const n = (hashTexto(`${id}:${rodada}:${p.chave}`) % 1000) + (p.descanso ? 0 : 650);
      if (n < nota) {
        nota = n;
        melhor = p;
      }
    }
    if (!melhor) continue;
    ocupados.add(melhor.chave);
    saida.set(id, { ponto: melhor, rodada });
  }
  return saida;
}

/**
 * Os ladrilhos aonde quem visita pode ficar, perto de quem é visitado, em
 * grupos por preferência (o motor tenta o primeiro grupo; sem caminho, o
 * próximo). Na mesa: primeiro ao lado da mesa (corredor ou faixa livre);
 * só se não der, atrás da cadeira — que na primeira fileira encosta na parede.
 */
export function ladrilhosDeVisita(m: Malha, perto: Ladrilho, mesa: Pick<Lugar, "x" | "y"> | null): Ladrilho[][] {
  const ok = (t: Ladrilho) => pisavel(m, t) && !(t.x === perto.x && t.y === perto.y);
  if (!mesa) return [vizinhos(perto).filter(ok)];
  const lado = [
    { x: mesa.x + CEL_L, y: mesa.y + 1 },
    { x: mesa.x - 1, y: mesa.y + 1 },
    { x: mesa.x + CEL_L, y: mesa.y + 2 },
    { x: mesa.x - 1, y: mesa.y + 2 },
  ].filter(ok);
  const atras = [
    { x: mesa.x + 2, y: mesa.y },
    { x: mesa.x, y: mesa.y },
  ].filter(ok);
  return [lado, atras, vizinhos(perto).filter(ok)].filter((g) => g.length > 0);
}

function vizinhos(perto: Ladrilho): Ladrilho[] {
  const lista: Ladrilho[] = [];
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
  ])
    lista.push({ x: perto.x + dx, y: perto.y + dy });
  return lista;
}
