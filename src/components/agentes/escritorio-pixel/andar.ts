/**
 * O MOTOR QUE FAZ A EQUIPE ANDAR no escritório em pixel.
 *
 * Tudo vem de dado de verdade (a tela relê a cada 20 s):
 *
 *   - quem está TRABALHANDO (rodada em andamento), com erro, atrasado,
 *     desligado ou aguardando fica na mesa. Quem acabou de trabalhar ainda
 *     fica um minuto na mesa (a rodada dura segundos, e a volta à mesa tem
 *     de dar para ver);
 *   - quem está sem tarefa (em dia, ou ainda não rodou) vai para a copa, para
 *     a sala de descanso ou faz outra coisa pelo escritório (movimento.ts
 *     escolhe o lugar), e de tempos em tempos troca de lugar;
 *   - quando um agente MANDA UM RECADO para outro no mural (fala nova, dos
 *     últimos 10 minutos), ele levanta, ANDA até onde o outro está, fica um
 *     pouco ali com o balão do recado e depois volta.
 *
 * Desempenho: a posição de cada boneco é escrita direto no SVG a cada quadro
 * (requestAnimationFrame), sem passar pelo React. O React só é avisado
 * (aoMudar) quando alguém senta ou levanta da mesa e quando começa ou acaba
 * uma conversa — coisas que mudam o desenho da estação ou o balão.
 *
 * Com "reduzir movimento" ligado no aparelho, ninguém anda: cada um aparece
 * direto no lugar.
 */
import type { EstadoMesa, FalaEscritorio, MesaAgente } from "@/lib/agentes/tipos";
import { lugaresPorAgente, type Lugar, type Planta, type TipoSala } from "./planta";
import {
  ancoraNaMesa,
  caminho,
  centro,
  crachaAcimaDosPes,
  escolherLazer,
  ladrilhoDaMesa,
  ladrilhoDe,
  ladrilhosDeVisita,
  montarMalha,
  peAtrasDaCadeira,
  pisavel,
  pontosDeLazer,
  type Ladrilho,
  type Malha,
  type Ponto,
  type PontoDeLazer,
} from "./movimento";

/** 5 ladrilhos por segundo (de uma ponta à outra do prédio, uns 15 s). */
const VELOCIDADE = 80 / 1000;
/** Quanto tempo quem foi dar um recado fica conversando. */
const CONVERSA_MS = 7000;
/** Depois de trabalhar, ainda fica este tempo na mesa. */
const FICA_NA_MESA_MS = 60_000;
/** Recado mais velho que isto não vira visita (já passou). */
const RECADO_RECENTE_MS = 10 * 60_000;
/** Ao abrir a tela, no máximo estes recados recentes são "repetidos" andando. */
const RECADOS_AO_ABRIR = 4;
const DECIDE_A_CADA_MS = 400;
const NA_MESA = new Set<EstadoMesa>(["trabalhando", "com_erro", "atrasado", "desligado", "aguardando_ativacao"]);

export type Pose = "mesa" | "em-pe" | "sentado";

type Destino =
  | { tipo: "mesa" }
  | { tipo: "lazer"; ponto: PontoDeLazer; rodada: number }
  | { tipo: "visita"; alvo: string; fala: FalaEscritorio };

interface Chegada {
  pos: Ponto;
  pose: Pose;
  vira: boolean;
  cafe: boolean;
  ladrilho: Ladrilho;
}

interface Rota {
  pts: Ponto[];
  acum: number[];
  total: number;
  inicio: number;
  fim: Chegada;
}

interface Ator {
  id: string;
  lugar: Lugar & { sala: TipoSala };
  pos: Ponto;
  pose: Pose;
  vira: boolean;
  cafe: boolean;
  /** O último ladrilho de chão em que pisou (de onde sai a próxima caminhada). */
  ladrilho: Ladrilho;
  rota: Rota | null;
  destino: Destino | null;
  chegouEm: number;
  fila: FalaEscritorio[];
  estado: EstadoMesa;
  vistoTrabalhando: number;
}

export interface VistaDoBoneco {
  x: number;
  y: number;
  pose: Pose;
  andando: boolean;
  chefe: boolean;
}

interface Recorte {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Registro =
  | { tipo: "boneco"; el: SVGGElement }
  | { tipo: "botao"; el: HTMLElement; vb: Recorte }
  /** O balão de fala clicável: `largura` em unidades do SVG. */
  | { tipo: "balao"; el: HTMLElement; vb: Recorte; largura: number };

export class Movimento {
  private aoMudar: () => void;
  private planta: Planta | null = null;
  private malha: Malha | null = null;
  private pontos: PontoDeLazer[] = [];
  private atores = new Map<string, Ator>();
  private registros = new Map<string, Set<Registro>>();
  private escrito = new WeakMap<Element, string>();
  private falasVistas = new Set<string>();
  private primeiraLeitura = true;
  private primeiraDecisao = true;
  private ultimaDecisao = 0;
  private quadro = 0;
  private reduzido = false;
  private sujo = false;

  constructor(aoMudar: () => void) {
    this.aoMudar = aoMudar;
  }

  /* ------------------------------------------------------------ dados */

  /** Chamar a cada leitura do escritório (planta, estado das mesas e mural). */
  sincronizar(planta: Planta, mesas: MesaAgente[], falas: FalaEscritorio[], agora = Date.now()): void {
    if (planta !== this.planta) this.novaPlanta(planta);
    for (const m of mesas) {
      const a = this.atores.get(m.id);
      if (!a) continue;
      a.estado = m.estado;
      if (m.estado === "trabalhando") a.vistoTrabalhando = agora;
    }
    this.lerRecados(falas, agora);
    if (this.primeiraDecisao) this.decidir(agora);
    this.escreverTodos();
    // Chamado de um useLayoutEffect: o React redesenha as cadeiras vazias antes de pintar.
    if (this.sujo) {
      this.sujo = false;
      this.aoMudar();
    }
  }

  private novaPlanta(planta: Planta): void {
    const antigos = this.atores;
    this.planta = planta;
    this.malha = montarMalha(planta);
    this.pontos = pontosDeLazer(planta, this.malha);
    this.atores = new Map();
    for (const [id, lugar] of lugaresPorAgente(planta)) {
      const velho = antigos.get(id);
      this.atores.set(id, {
        id,
        lugar,
        pos: ancoraNaMesa(lugar),
        pose: "mesa",
        vira: false,
        cafe: false,
        ladrilho: ladrilhoDaMesa(lugar),
        rota: null,
        destino: null,
        chegouEm: 0,
        fila: velho?.fila ?? [],
        estado: velho?.estado ?? "ocioso",
        vistoTrabalhando: velho?.vistoTrabalhando ?? 0,
      });
    }
    // Planta nova (agente entrou ou saiu): cada um aparece direto no lugar.
    this.primeiraDecisao = true;
    this.sujo = true;
  }

  private lerRecados(falas: FalaEscritorio[], agora: number): void {
    const novas: FalaEscritorio[] = [];
    for (const f of falas) {
      if (this.falasVistas.has(f.id)) continue;
      this.falasVistas.add(f.id);
      const t = new Date(f.criadoEm).getTime();
      if (!Number.isFinite(t) || agora - t > RECADO_RECENTE_MS || t - agora > 5 * 60_000) continue;
      if (!f.para || f.para === "todos" || f.para === f.de) continue;
      if (!this.atores.has(f.de) || !this.atores.has(f.para)) continue;
      novas.push(f);
    }
    novas.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
    const valem = this.primeiraLeitura ? novas.slice(-RECADOS_AO_ABRIR) : novas;
    this.primeiraLeitura = false;
    for (const f of valem) {
      const a = this.atores.get(f.de)!;
      a.fila.push(f);
      if (a.fila.length > 3) a.fila.shift();
    }
  }

  /* --------------------------------------------------------- decisões */

  private precisaDaMesa(a: Ator, agora: number): boolean {
    return NA_MESA.has(a.estado) || agora - a.vistoTrabalhando < FICA_NA_MESA_MS;
  }

  private decidir(agora: number): void {
    if (!this.malha) return;
    const direto = this.primeiraDecisao || this.reduzido;
    const livres: Ator[] = [];
    for (const a of this.atores.values()) {
      if (a.destino?.tipo === "visita") {
        if (a.rota || agora - a.chegouEm < CONVERSA_MS) continue; // indo, ou conversando
        a.destino = null; // acabou a conversa: o balão some
        this.sujo = true;
      }
      // Recado na fila: vai até quem recebeu (na primeira decisão, não: aí todo mundo só aparece no lugar).
      if (!this.primeiraDecisao && a.fila.length && this.irDarRecado(a, a.fila.shift()!, agora)) continue;
      livres.push(a);
    }
    const semTarefa = livres.filter((a) => !this.precisaDaMesa(a, agora)).map((a) => a.id);
    const atuais = new Map<string, { chave: string; rodada: number }>();
    for (const a of livres) if (a.destino?.tipo === "lazer") atuais.set(a.id, { chave: a.destino.ponto.chave, rodada: a.destino.rodada });
    const escolha = escolherLazer(semTarefa, this.pontos, atuais, agora);
    for (const a of livres) {
      const e = escolha.get(a.id);
      const quer: Destino = e ? { tipo: "lazer", ponto: e.ponto, rodada: e.rodada } : { tipo: "mesa" };
      if (mesmoDestino(a.destino, quer)) {
        if (quer.tipo === "lazer" && a.destino?.tipo === "lazer") a.destino.rodada = quer.rodada;
        continue;
      }
      this.partir(a, quer, agora, direto);
    }
    this.primeiraDecisao = false;
  }

  private partir(a: Ator, destino: Destino, agora: number, direto: boolean): void {
    if (destino.tipo === "mesa") {
      const l = a.lugar;
      this.mover(a, destino, [ladrilhoDaMesa(l)], peAtrasDaCadeira(l), agora, direto, () => ({
        pos: ancoraNaMesa(l),
        pose: "mesa",
        vira: false,
        cafe: false,
        ladrilho: ladrilhoDaMesa(l),
      }));
    } else if (destino.tipo === "lazer") {
      const p = destino.ponto;
      this.mover(a, destino, [p.ladrilho], p.pe, agora, direto, () => ({
        pos: p.pe,
        pose: p.pose,
        vira: p.vira,
        cafe: p.cafe,
        ladrilho: p.ladrilho,
      }));
    }
  }

  private irDarRecado(a: Ator, fala: FalaEscritorio, agora: number): boolean {
    const alvo = this.atores.get(String(fala.para));
    if (!alvo || !this.malha) return false;
    // Onde o outro está (ou para onde está indo).
    const pertoDe = alvo.rota ? alvo.rota.fim.ladrilho : alvo.ladrilho;
    const naMesa = (alvo.rota ? alvo.rota.fim.pose : alvo.pose) === "mesa";
    const ondeFica = alvo.rota ? alvo.rota.fim.pos : alvo.pos;
    // O primeiro grupo de lugares (ao lado da mesa) que tiver caminho.
    const grupos = ladrilhosDeVisita(this.malha, pertoDe, naMesa ? alvo.lugar : null);
    const opcoes = grupos.find((g) => caminho(this.malha!, a.ladrilho, g)) ?? grupos[0];
    if (!opcoes?.length) return false;
    return this.mover(a, { tipo: "visita", alvo: alvo.id, fala }, opcoes, null, agora, this.reduzido, (t) => {
      const pos = centro(t);
      return { pos, pose: "em-pe", vira: ondeFica.x < pos.x, cafe: false, ladrilho: t };
    });
  }

  /**
   * Começa a caminhada até o alvo mais perto. `extra` = o último passo fora
   * do chão (sentar no sofá, encostar na cadeira). Sem caminho, ou com
   * `direto`, aparece no lugar.
   */
  private mover(
    a: Ator,
    destino: Destino,
    alvos: Ladrilho[],
    extra: Ponto | null,
    agora: number,
    direto: boolean,
    chegada: (t: Ladrilho) => Chegada,
  ): boolean {
    const m = this.malha!;
    const rota = caminho(m, a.ladrilho, alvos);
    a.destino = destino;
    if (direto || !rota) {
      const alvo = rota ? rota[rota.length - 1] : (alvos.find((t) => pisavel(m, t)) ?? alvos[0]);
      if (!alvo) return false;
      this.chegar(a, chegada(alvo), agora);
      return true;
    }
    // Levanta: da mesa, sai por trás da cadeira; do sofá, fica em pé onde está.
    if (a.pose === "mesa") {
      a.pos = peAtrasDaCadeira(a.lugar);
      this.sujo = true;
    }
    a.pose = "em-pe";
    a.cafe = false;
    const pts: Ponto[] = [a.pos];
    for (const t of rota) pts.push(centro(t));
    if (extra) pts.push(extra);
    const limpos = pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
    const acum = [0];
    for (let i = 1; i < limpos.length; i++) acum.push(acum[i - 1] + Math.hypot(limpos[i].x - limpos[i - 1].x, limpos[i].y - limpos[i - 1].y));
    a.rota = { pts: limpos, acum, total: acum[acum.length - 1], inicio: agora, fim: chegada(rota[rota.length - 1]) };
    if (destino.tipo === "visita") this.sujo = true;
    return true;
  }

  private chegar(a: Ator, fim: Chegada, agora: number): void {
    if (a.pose === "mesa" || fim.pose === "mesa") this.sujo = true;
    if (a.destino?.tipo === "visita") this.sujo = true;
    a.pos = fim.pos;
    a.pose = fim.pose;
    a.vira = fim.vira;
    a.cafe = fim.cafe;
    a.ladrilho = fim.ladrilho;
    a.rota = null;
    a.chegouEm = agora;
  }

  /* ----------------------------------------------------------- quadros */

  private passo(agora: number): void {
    const m = this.malha;
    if (!m) return;
    for (const a of this.atores.values()) {
      const r = a.rota;
      if (!r) continue;
      const d = (agora - r.inicio) * VELOCIDADE;
      if (d >= r.total) {
        this.chegar(a, r.fim, agora);
        continue;
      }
      let i = 0;
      while (i < r.acum.length - 2 && r.acum[i + 1] <= d) i++;
      const p0 = r.pts[i];
      const p1 = r.pts[i + 1];
      const seg = r.acum[i + 1] - r.acum[i] || 1;
      const t = (d - r.acum[i]) / seg;
      a.pos = { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
      if (p1.x !== p0.x) a.vira = p1.x < p0.x;
      const lt = ladrilhoDe(a.pos);
      if (pisavel(m, lt)) a.ladrilho = lt;
    }
  }

  iniciar(): void {
    if (typeof window === "undefined" || this.quadro) return;
    this.reduzido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const tique = () => {
      const agora = Date.now();
      if (agora - this.ultimaDecisao >= DECIDE_A_CADA_MS) {
        this.ultimaDecisao = agora;
        this.decidir(agora);
      }
      this.passo(agora);
      this.escreverTodos();
      if (this.sujo) {
        this.sujo = false;
        this.aoMudar();
      }
      this.quadro = window.requestAnimationFrame(tique);
    };
    this.quadro = window.requestAnimationFrame(tique);
  }

  parar(): void {
    if (this.quadro && typeof window !== "undefined") window.cancelAnimationFrame(this.quadro);
    this.quadro = 0;
  }

  /* --------------------------------------------------------- desenho */

  /** O boneco (SVG) de um agente. Devolve a limpeza (ref de React 19). */
  registrarBoneco(id: string, el: SVGGElement | null): (() => void) | undefined {
    if (!el) return undefined;
    return this.registrar(id, { tipo: "boneco", el });
  }

  /** O botão (HTML, por cima do desenho) de um agente, no recorte `vb` (unidades do SVG). */
  registrarBotao(id: string, el: HTMLElement | null, vb: Recorte): (() => void) | undefined {
    if (!el) return undefined;
    return this.registrar(id, { tipo: "botao", el, vb });
  }

  /** O botão por cima do balão de fala (abre o relatório e as aprovações do agente). */
  registrarBalao(id: string, el: HTMLElement | null, vb: Recorte, largura: number): (() => void) | undefined {
    if (!el) return undefined;
    return this.registrar(id, { tipo: "balao", el, vb, largura });
  }

  private registrar(id: string, r: Registro): () => void {
    const lista = this.registros.get(id) ?? new Set<Registro>();
    lista.add(r);
    this.registros.set(id, lista);
    this.escrito.delete(r.el);
    const a = this.atores.get(id);
    if (a) this.escrever(a, r);
    return () => {
      lista.delete(r);
    };
  }

  private escreverTodos(): void {
    for (const [id, lista] of this.registros) {
      const a = this.atores.get(id);
      if (!a) continue;
      for (const r of lista) this.escrever(a, r);
    }
  }

  private escrever(a: Ator, r: Registro): void {
    const x = Math.round(a.pos.x);
    const y = Math.round(a.pos.y);
    const andando = a.rota ? "1" : "0";
    if (r.tipo === "boneco") {
      const chave = `${x},${y},${a.pose},${andando},${a.vira},${a.cafe}`;
      if (this.escrito.get(r.el) === chave) return;
      this.escrito.set(r.el, chave);
      r.el.setAttribute("transform", `translate(${x} ${y})`);
      r.el.setAttribute("data-pose", a.pose);
      r.el.setAttribute("data-andando", andando);
      r.el.setAttribute("data-cafe", a.cafe ? "1" : "0");
      const vira = r.el.querySelector(".pxe-vira");
      if (vira) vira.setAttribute("transform", a.vira ? "scale(-1 1)" : "");
      return;
    }
    // Botão: a área clicável em volta do boneco (na mesa, a estação toda, como antes).
    const alto = crachaAcimaDosPes(a.lugar.chefe) + 1;
    const caixa =
      r.tipo === "balao"
        ? { x: x + 2, y: y - alto - 10, w: r.largura, h: 10 }
        : a.pose === "mesa"
          ? { x: x - 13, y: y - alto, w: 40, h: a.lugar.chefe ? 41 : 36 }
          : { x: x - 9, y: y - alto, w: 18, h: alto + 2 };
    const { vb } = r;
    const fora = caixa.x + caixa.w < vb.x || caixa.x > vb.x + vb.w || caixa.y + caixa.h < vb.y || caixa.y > vb.y + vb.h;
    const chave = fora ? "fora" : `${caixa.x},${caixa.y},${caixa.w},${caixa.h}`;
    if (this.escrito.get(r.el) === chave) return;
    this.escrito.set(r.el, chave);
    const s = r.el.style;
    s.display = fora ? "none" : "";
    if (fora) return;
    s.left = `${((caixa.x - vb.x) / vb.w) * 100}%`;
    s.top = `${((caixa.y - vb.y) / vb.h) * 100}%`;
    s.width = `${(caixa.w / vb.w) * 100}%`;
    s.height = `${(caixa.h / vb.h) * 100}%`;
  }

  /* --------------------------------------------------------- leitura */

  /** Sentado na própria mesa (a estação desenha a pessoa). */
  naMesa(id: string): boolean {
    const a = this.atores.get(id);
    return !a || a.pose === "mesa";
  }

  /** O recado que ele está dando agora (já chegou e está conversando). */
  recadoEmConversa(id: string): FalaEscritorio | null {
    const a = this.atores.get(id);
    return a && a.destino?.tipo === "visita" && !a.rota ? a.destino.fala : null;
  }

  vista(id: string): VistaDoBoneco | null {
    const a = this.atores.get(id);
    return a ? { x: a.pos.x, y: a.pos.y, pose: a.pose, andando: Boolean(a.rota), chefe: a.lugar.chefe } : null;
  }

  /** O que está fazendo fora da mesa, em uma frase (null = na mesa). */
  atividade(id: string, nomeDe: (id: string) => string): string | null {
    const a = this.atores.get(id);
    const d = a?.destino;
    if (!a || !d) return null;
    if (d.tipo === "visita") return a.rota ? `Indo levar um recado para ${nomeDe(d.alvo)}` : `Dando um recado para ${nomeDe(d.alvo)}`;
    if (a.rota) return d.tipo === "mesa" ? "Voltando para a mesa" : `A caminho: ${d.ponto.atividade}`;
    return d.tipo === "lazer" ? d.ponto.atividade : null;
  }
}

function mesmoDestino(a: Destino | null, b: Destino): boolean {
  if (!a || a.tipo !== b.tipo) return false;
  return b.tipo !== "lazer" || (a.tipo === "lazer" && a.ponto.chave === b.ponto.chave);
}
