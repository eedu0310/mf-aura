/**
 * Os desenhos do escritório em pixel: chão, paredes, móveis, mesas, gente,
 * crachás e balões. Tudo em SVG puro (sem imagem de fora), num grid de
 * TILE = 16 unidades por ladrilho; cada "pixel" da arte é 1 unidade, e o SVG
 * é desenhado com shape-rendering="crispEdges" para as bordas ficarem secas.
 *
 * As cores do CENÁRIO vêm de classes (k-<nome>) com dois tons — claro e
 * escuro (classe .dark no <html>, ver globals.css): no tema escuro o chão e
 * as paredes ficam mais escuros e aconchegantes, sem ofuscar. As cores das
 * PESSOAS (pele, cabelo, roupa) são fixas: são personagens, não tema.
 *
 * Animação só com "reduzir movimento" desligado (@media prefers-reduced-motion).
 * Arte original, feita aqui — nenhum recurso copiado de outro produto.
 */
import type { ReactElement } from "react";
import type { EstadoMesa } from "@/lib/agentes/tipos";
import type { Aparencia, Balao } from "./aparencia";
import { TILE as U, geometriaDaEstacao, type Decor, type ItemParede, type Lugar, type SalaPlanta } from "./planta";

/* ------------------------------------------------------------------ cores */

/** [claro, escuro] de cada cor do cenário. */
const CORES: Record<string, [string, string]> = {
  chao1: ["#e7d9be", "#3a332a"],
  chao2: ["#e0d0b2", "#352f27"],
  junta: ["#cfbd9b", "#322c24"],
  carpete1: ["#dcc6b3", "#3e3231"],
  carpete2: ["#d5bca7", "#392d2c"],
  carpeteJunta: ["#c6a993", "#30262a"],
  ladrilho1: ["#ebe8e1", "#34373b"],
  ladrilho2: ["#e0dcd3", "#2f3236"],
  ladrilhoJunta: ["#cfcabf", "#27292d"],
  biblio1: ["#d8c19a", "#3c3228"],
  biblio2: ["#d0b78e", "#372e25"],
  biblioJunta: ["#bea478", "#332b22"],
  parede: ["#ddd0b8", "#4a4238"],
  paredeTopo: ["#6e5d4c", "#1d1814"],
  paredeLinha: ["#d1c3a9", "#433b32"],
  rodape: ["#b9a78b", "#3a332b"],
  madeira: ["#b98653", "#8a643f"],
  madeiraClara: ["#d29e65", "#a07549"],
  madeiraEsc: ["#8c5f36", "#62442a"],
  mogno: ["#7d402b", "#63321f"],
  mognoEsc: ["#5c2d1d", "#4a2416"],
  ouro: ["#d9ad4a", "#c39a3e"],
  metal: ["#aab1b9", "#7b828a"],
  metalEsc: ["#6f777f", "#4f555c"],
  monitor: ["#3a3f47", "#262a30"],
  teclado: ["#d9dce0", "#9aa0a6"],
  tecladoEsc: ["#b6bac0", "#7c8289"],
  papel: ["#fbfaf6", "#cbc8bf"],
  cadeira: ["#4b5563", "#343b46"],
  cadeiraClara: ["#64707f", "#47505d"],
  cadeiraChefe: ["#7a2e3a", "#5e2330"],
  folha: ["#5a9a4b", "#477b3b"],
  folhaClara: ["#7bb964", "#5b954a"],
  folhaEsc: ["#3f7a37", "#2f5c2a"],
  vaso: ["#b4663f", "#8c4e31"],
  vasoClaro: ["#cf7d52", "#a45f3e"],
  sofa: ["#5f86a6", "#476580"],
  sofaEsc: ["#4a6b86", "#354f65"],
  poltrona: ["#c27b50", "#945f3e"],
  poltronaEsc: ["#9c5f3b", "#75482d"],
  tapete1: ["#8f4a3c", "#6a372d"],
  tapete2: ["#c98a5a", "#966443"],
  tapete3: ["#e1b17b", "#b1875b"],
  rack: ["#30353c", "#212429"],
  rackPainel: ["#454c55", "#333940"],
  agua: ["#8fcaec", "#5f9cc2"],
  bebedouro: ["#eef0f2", "#b7bcc2"],
  balcao: ["#a9805a", "#7d5e41"],
  balcaoTopo: ["#e7e2d9", "#9ea3a8"],
  quadro: ["#fbfbf8", "#d5d7d4"],
  cortica: ["#c9a06a", "#9a7a4f"],
  vidro: ["#aad9f1", "#1f3150"],
  vidroBrilho: ["#e6f6ff", "#3a5583"],
  janelaMoldura: ["#f4efe6", "#5b5249"],
  placa: ["#3b2f26", "#2a221c"],
  placaTexto: ["#f4e8d4", "#eadcc5"],
  estanteFundo: ["#6b4a2e", "#4b3420"],
  balao: ["#fffdf7", "#ebe6da"],
  telaTv: ["#24365a", "#1a2741"],
};

const SOMBRA = "k-sombra";

/** O CSS do escritório: cores (claro/escuro), sombra, destaque e animações. */
export const CSS_ESCRITORIO_PIXEL = [
  ...Object.entries(CORES).map(([nome, [claro]]) => `.pxe .k-${nome}{fill:${claro}}`),
  ...Object.entries(CORES).map(([nome, [, escuro]]) => `.dark .pxe .k-${nome}{fill:${escuro}}`),
  `.pxe .k-sombra{fill:#2b1d10;fill-opacity:.14}.dark .pxe .k-sombra{fill:#000;fill-opacity:.32}`,
  `.pxe .k-destaque{fill:#1f8a8f;fill-opacity:.2}.dark .pxe .k-destaque{fill:#4fd1c5;fill-opacity:.18}`,
  `.pxe .k-moldura{fill:none;stroke:#6e5d4c}.dark .pxe .k-moldura{stroke:#1d1814}`,
  `@keyframes pxe-respira{0%,100%{transform:translateY(0)}50%{transform:translateY(-1px)}}`,
  `@keyframes pxe-digita{0%,100%{transform:translateY(0)}50%{transform:translateY(-1px)}}`,
  `@keyframes pxe-pulso{0%{transform:scale(1);opacity:.75}100%{transform:scale(2.8);opacity:0}}`,
  `@keyframes pxe-pisca{0%,100%{opacity:1}50%{opacity:.2}}`,
  `@keyframes pxe-ponto{0%,100%{opacity:.25}35%{opacity:1}}`,
  `@keyframes pxe-troca{0%{opacity:1}50%{opacity:0}}`,
  // Boneco que anda (andar.ts põe data-pose, data-andando e data-cafe no <g>).
  `.pxe .pxe-passo-a,.pxe .pxe-passo-b,.pxe .pxe-pernas-sentado,.pxe .pxe-xicara{display:none}`,
  `.pxe g[data-pose="mesa"]>.pxe-corpo{display:none}`,
  `.pxe g[data-pose="sentado"] .pxe-passo-0{display:none}`,
  `.pxe g[data-pose="sentado"] .pxe-pernas-sentado{display:inline}`,
  `.pxe g[data-andando="1"] .pxe-passo-0{display:none}`,
  `.pxe g[data-andando="1"] .pxe-passo-a{display:inline}`,
  `.pxe g[data-cafe="1"] .pxe-xicara{display:inline}`,
  `@media (prefers-reduced-motion:no-preference){`,
  `.pxe g[data-andando="1"] .pxe-passo-a{animation:pxe-troca .32s steps(1,end) infinite}`,
  `.pxe g[data-andando="1"] .pxe-passo-b{display:inline;animation:pxe-troca .32s steps(1,end) infinite;animation-delay:-.16s}`,
  `.pxe g[data-andando="1"] .pxe-tronco{animation:pxe-digita .32s steps(1,end) infinite}`,
  `.pxe g[data-andando="0"] .pxe-tronco{animation:pxe-respira 3.6s steps(1,end) infinite}`,
  `.pxe .pxe-respira{animation:pxe-respira 3.6s steps(1,end) infinite}`,
  `.pxe .pxe-digita{animation:pxe-digita .5s steps(1,end) infinite}`,
  `.pxe .pxe-pulso{animation:pxe-pulso 1.8s ease-out infinite;transform-box:fill-box;transform-origin:center}`,
  `.pxe .pxe-led{animation:pxe-pisca 1.4s steps(1,end) infinite}`,
  `.pxe .pxe-ponto{animation:pxe-ponto 1.2s steps(1,end) infinite}`,
  `.pxe .pxe-brilho{animation:pxe-pisca 2.4s steps(1,end) infinite}`,
  `}`,
].join("\n");

export const FONTE_PIXEL = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/* ------------------------------------------------------------- peça base */

/** Um retângulo da arte. `k` = cor do cenário (classe); `f` = cor fixa. */
function Px({
  x,
  y,
  w = 1,
  h = 1,
  k,
  f,
  o,
  className,
  atraso,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  k?: string;
  f?: string;
  o?: number;
  className?: string;
  /** Atraso da animação, em segundos (para os agentes não piscarem juntos). */
  atraso?: number;
}) {
  const classes = [k ? `k-${k}` : "", className ?? ""].filter(Boolean).join(" ") || undefined;
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      className={classes}
      fill={f}
      opacity={o}
      style={atraso ? { animationDelay: `${atraso}s` } : undefined}
    />
  );
}

/** Gerador pseudoaleatório pequeno e estável (cor dos livros, da caneca…). */
function sorteio(semente: number) {
  let s = (semente * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10_000) / 10_000;
  };
}

const LIVROS = ["#b5574b", "#3f6f8f", "#d0a03a", "#4f8a6a", "#7b5ea7", "#d8d1bf", "#a64d79", "#2f7f86"];

/* ------------------------------------------------------------------ chão */

export type Piso = "madeira" | "carpete" | "ladrilho" | "biblio";

export function pisoDaSala(sala: Pick<SalaPlanta, "id">): Piso {
  if (sala.id === "direcao" || sala.id === "descanso") return "carpete";
  if (sala.id === "conhecimento") return "biblio";
  if (sala.id === "dados" || sala.id === "seguranca" || sala.id === "copa") return "ladrilho";
  return "madeira";
}

/** Os quatro pisos como <pattern> (alinhados ao prédio inteiro: userSpaceOnUse). */
export function DefsPisos({ prefixo }: { prefixo: string }) {
  const ladrilhos = (a: string, b: string, desenho: (tx: number, ty: number) => ReactElement[]) =>
    [
      [0, 0, a],
      [16, 0, b],
      [0, 16, b],
      [16, 16, a],
    ].flatMap(([tx, ty, k]) => [
      <Px key={`b${tx}-${ty}`} x={tx as number} y={ty as number} w={16} h={16} k={k as string} />,
      ...desenho(tx as number, ty as number),
    ]);
  const tabuas = (junta: string) => (tx: number, ty: number) => [
    <Px key={`t1${tx}${ty}`} x={tx} y={ty + 7} w={16} k={junta} />,
    <Px key={`t2${tx}${ty}`} x={tx} y={ty + 15} w={16} k={junta} />,
    <Px key={`t3${tx}${ty}`} x={tx + ((tx + ty) % 32 ? 4 : 11)} y={ty} h={7} k={junta} />,
    <Px key={`t4${tx}${ty}`} x={tx + ((tx + ty) % 32 ? 12 : 3)} y={ty + 8} h={7} k={junta} />,
  ];
  return (
    <>
      <pattern id={`${prefixo}-madeira`} width={32} height={32} patternUnits="userSpaceOnUse">
        {ladrilhos("chao1", "chao2", tabuas("junta"))}
      </pattern>
      <pattern id={`${prefixo}-biblio`} width={32} height={32} patternUnits="userSpaceOnUse">
        {ladrilhos("biblio1", "biblio2", tabuas("biblioJunta"))}
      </pattern>
      <pattern id={`${prefixo}-carpete`} width={32} height={32} patternUnits="userSpaceOnUse">
        {ladrilhos("carpete1", "carpete2", (tx, ty) => [
          <Px key={`c1${tx}${ty}`} x={tx + 4} y={ty + 4} k="carpeteJunta" />,
          <Px key={`c2${tx}${ty}`} x={tx + 12} y={ty + 11} k="carpeteJunta" />,
          <Px key={`c3${tx}${ty}`} x={tx + 8} y={ty + 7} k="carpeteJunta" />,
        ])}
      </pattern>
      <pattern id={`${prefixo}-ladrilho`} width={32} height={32} patternUnits="userSpaceOnUse">
        {ladrilhos("ladrilho1", "ladrilho2", (tx, ty) => [
          <Px key={`l1${tx}${ty}`} x={tx} y={ty} w={16} k="ladrilhoJunta" />,
          <Px key={`l2${tx}${ty}`} x={tx} y={ty} h={16} k="ladrilhoJunta" />,
        ])}
      </pattern>
    </>
  );
}

/* --------------------------------------------------------------- paredes */

/** Chão da sala, parede de cima (com porta e placa) e parede da esquerda (com porta). */
export function ChaoEParedes({ sala, prefixo }: { sala: SalaPlanta; prefixo: string }) {
  const X = sala.x * U;
  const Y = sala.y * U;
  const segmentos: Array<[number, number]> =
    sala.portaTopo === null
      ? [[sala.x, sala.x + sala.w]]
      : [
          [sala.x, sala.portaTopo],
          [sala.portaTopo + 2, sala.x + sala.w],
        ];
  const partes: ReactElement[] = [];
  segmentos.forEach(([a, b], i) => {
    if (b <= a) return;
    partes.push(
      <Px key={`f${i}`} x={a * U} y={Y} w={(b - a) * U} h={U} k="parede" />,
      <Px key={`t${i}`} x={a * U} y={Y} w={(b - a) * U} h={3} k="paredeTopo" />,
      <Px key={`r${i}`} x={a * U} y={Y + 14} w={(b - a) * U} h={2} k="rodape" />,
    );
    for (let c = a + 1; c < b; c += 2) partes.push(<Px key={`l${i}-${c}`} x={c * U} y={Y + 4} h={9} k="paredeLinha" />);
  });
  if (sala.portaTopo !== null) {
    partes.push(
      <Px key="bt1" x={sala.portaTopo * U - 1} y={Y} w={2} h={U} k="paredeTopo" />,
      <Px key="bt2" x={(sala.portaTopo + 2) * U - 1} y={Y} w={2} h={U} k="paredeTopo" />,
    );
  }
  if (sala.x > 0) {
    const pe = sala.portaEsquerda;
    const trechos: Array<[number, number]> =
      pe === null
        ? [[sala.y, sala.y + sala.h]]
        : [
            [sala.y, pe],
            [pe + 2, sala.y + sala.h],
          ];
    trechos.forEach(([a, b], i) => {
      if (b > a) partes.push(<Px key={`e${i}`} x={X - 2} y={a * U} w={4} h={(b - a) * U} k="paredeTopo" />);
    });
  }
  // Placa com o nome da sala, na parede.
  const texto = sala.rotulo.toUpperCase();
  const larguraPlaca = Math.round(texto.length * 3.6 + 8);
  return (
    <g>
      <rect x={X} y={Y} width={sala.w * U} height={sala.h * U} fill={`url(#${prefixo}-${pisoDaSala(sala)})`} />
      {partes}
      <Px x={X + 6} y={Y + 4} w={larguraPlaca} h={9} k="placa" />
      <Px x={X + 6} y={Y + 4} w={larguraPlaca} h={1} k="madeiraEsc" />
      <text
        x={X + 10}
        y={Y + 10.6}
        fontSize={6}
        fontWeight={700}
        fontFamily={FONTE_PIXEL}
        className="k-placaTexto"
        style={{ letterSpacing: 0 }}
      >
        {texto}
      </text>
    </g>
  );
}

/** A moldura externa do prédio. */
export function Moldura({ largura, altura }: { largura: number; altura: number }) {
  return <rect x={1.5} y={1.5} width={largura * U - 3} height={altura * U - 3} strokeWidth={3} className="k-moldura" />;
}

/* --------------------------------------------------------- na parede */

export function NaParede({ item, y }: { item: ItemParede; y: number }) {
  const X = item.x * U;
  const Y = y * U;
  switch (item.tipo) {
    case "janela":
      return (
        <g>
          <Px x={X + 2} y={Y + 2} w={28} h={11} k="janelaMoldura" />
          <Px x={X + 4} y={Y + 3} w={24} h={9} k="vidro" />
          <Px x={X + 15} y={Y + 3} w={2} h={9} k="janelaMoldura" />
          <Px x={X + 6} y={Y + 4} w={3} k="vidroBrilho" />
          <Px x={X + 6} y={Y + 5} h={2} k="vidroBrilho" />
          <Px x={X + 19} y={Y + 4} w={2} k="vidroBrilho" />
        </g>
      );
    case "quadro":
      return (
        <g>
          <Px x={X + 2} y={Y + 2} w={44} h={12} k="metal" />
          <Px x={X + 3} y={Y + 3} w={42} h={10} k="quadro" />
          <Px x={X + 6} y={Y + 5} w={12} f="#4a7bd0" />
          <Px x={X + 6} y={Y + 8} w={16} f="#c0564b" />
          <Px x={X + 6} y={Y + 10} w={9} f="#4a7bd0" />
          <Px x={X + 30} y={Y + 9} w={2} h={3} f="#4f9a5a" />
          <Px x={X + 33} y={Y + 7} w={2} h={5} f="#4f9a5a" />
          <Px x={X + 36} y={Y + 5} w={2} h={7} f="#4f9a5a" />
          <Px x={X + 39} y={Y + 6} w={2} h={6} f="#d0a03a" />
          <Px x={X + 20} y={Y + 13} w={6} h={1} f="#7d838a" />
        </g>
      );
    case "relogio":
      return (
        <g>
          <circle cx={X + 8} cy={Y + 8} r={5.5} fill="#3a3f47" />
          <circle cx={X + 8} cy={Y + 8} r={4.5} className="k-quadro" />
          <Px x={X + 7.5} y={Y + 4.5} h={3.5} f="#2b2f36" />
          <Px x={X + 7.5} y={Y + 7.5} w={3} f="#2b2f36" />
        </g>
      );
    case "mural-avisos":
      return (
        <g>
          <Px x={X + 2} y={Y + 2} w={28} h={12} k="madeiraEsc" />
          <Px x={X + 3} y={Y + 3} w={26} h={10} k="cortica" />
          <Px x={X + 5} y={Y + 4} w={6} h={5} f="#f6e27a" />
          <Px x={X + 13} y={Y + 5} w={5} h={6} f="#f4b6c2" />
          <Px x={X + 20} y={Y + 4} w={6} h={5} f="#a9d6f5" />
          <Px x={X + 7} y={Y + 4} f="#c0392b" />
          <Px x={X + 15} y={Y + 5} f="#2f7f86" />
          <Px x={X + 22} y={Y + 4} f="#c0392b" />
        </g>
      );
    case "tv":
      return (
        <g>
          <Px x={X + 2} y={Y + 2} w={28} h={12} f="#15171b" />
          <Px x={X + 3} y={Y + 3} w={26} h={10} k="telaTv" />
          <Px x={X + 5} y={Y + 9} w={3} h={3} f="#4fd1c5" />
          <Px x={X + 9} y={Y + 7} w={3} h={5} f="#4fd1c5" />
          <Px x={X + 13} y={Y + 5} w={3} h={7} f="#f6c453" />
          <Px x={X + 18} y={Y + 5} w={8} f="#e9edf2" />
          <Px x={X + 18} y={Y + 7} w={6} f="#9fb0c6" />
        </g>
      );
    default:
      return null;
  }
}

/* --------------------------------------------------------------- móveis */

export function Movel({ d }: { d: Decor }) {
  const X = d.x * U;
  const Y = d.y * U;
  switch (d.tipo) {
    case "tapete": {
      const W = d.w * U;
      const H = d.h * U;
      return (
        <g>
          <Px x={X + 2} y={Y + 2} w={W - 4} h={H - 4} k="tapete1" />
          <Px x={X + 4} y={Y + 4} w={W - 8} h={H - 8} k="tapete2" />
          <Px x={X + 7} y={Y + 7} w={W - 14} h={H - 14} k="tapete1" />
          <Px x={X + 8} y={Y + 8} w={W - 16} h={H - 16} k="tapete3" />
        </g>
      );
    }
    case "planta":
      return (
        <g>
          <Px x={X + 4} y={Y + 15} w={8} className={SOMBRA} />
          <Px x={X + 5} y={Y + 10} w={6} h={5} k="vaso" />
          <Px x={X + 4} y={Y + 9} w={8} h={2} k="vasoClaro" />
          <Px x={X + 4} y={Y + 3} w={8} h={6} k="folha" />
          <Px x={X + 2} y={Y + 5} w={3} h={3} k="folha" />
          <Px x={X + 11} y={Y + 4} w={3} h={3} k="folha" />
          <Px x={X + 6} y={Y + 1} w={4} h={3} k="folhaClara" />
          <Px x={X + 5} y={Y + 6} w={3} h={2} k="folhaEsc" />
          <Px x={X + 9} y={Y + 7} w={2} h={2} k="folhaEsc" />
        </g>
      );
    case "planta-grande":
      return (
        <g>
          <Px x={X + 3} y={Y + 31} w={10} className={SOMBRA} />
          <Px x={X + 4} y={Y + 24} w={8} h={7} k="vaso" />
          <Px x={X + 3} y={Y + 22} w={10} h={2} k="vasoClaro" />
          <Px x={X + 7} y={Y + 16} w={2} h={6} k="madeiraEsc" />
          <Px x={X + 3} y={Y + 4} w={10} h={11} k="folha" />
          <Px x={X + 1} y={Y + 8} w={3} h={7} k="folha" />
          <Px x={X + 12} y={Y + 6} w={3} h={7} k="folha" />
          <Px x={X + 5} y={Y + 1} w={6} h={4} k="folhaClara" />
          <Px x={X + 4} y={Y + 14} w={8} h={4} k="folha" />
          <Px x={X + 6} y={Y + 8} w={3} h={3} k="folhaEsc" />
          <Px x={X + 9} y={Y + 13} w={3} h={3} k="folhaEsc" />
          <Px x={X + 4} y={Y + 5} w={2} h={2} k="folhaClara" />
        </g>
      );
    case "estante": {
      const r = sorteio(d.x * 31 + d.y * 17 + 7);
      const livros: ReactElement[] = [];
      for (const prateleira of [0, 1, 2]) {
        let bx = X + 4;
        const base = Y + 9 + prateleira * 9;
        while (bx < X + 27) {
          const larg = 2 + Math.floor(r() * 2);
          const alt = 5 + Math.floor(r() * 3);
          if (bx + larg > X + 28) break;
          livros.push(
            <Px key={`${prateleira}-${bx}`} x={bx} y={base - alt} w={larg} h={alt} f={LIVROS[Math.floor(r() * LIVROS.length)]} />,
          );
          bx += larg + (r() < 0.15 ? 2 : 0);
        }
      }
      return (
        <g>
          <Px x={X + 2} y={Y + 31} w={28} className={SOMBRA} />
          <Px x={X + 1} y={Y} w={30} h={31} k="madeiraEsc" />
          <Px x={X + 3} y={Y + 2} w={26} h={27} k="estanteFundo" />
          {livros}
          <Px x={X + 3} y={Y + 9} w={26} h={2} k="madeiraEsc" />
          <Px x={X + 3} y={Y + 18} w={26} h={2} k="madeiraEsc" />
          <Px x={X + 3} y={Y + 27} w={26} h={2} k="madeiraEsc" />
          <Px x={X + 1} y={Y} w={30} h={1} k="madeira" />
        </g>
      );
    }
    case "servidor": {
      const leds: ReactElement[] = [];
      for (let i = 0; i < 5; i++) {
        leds.push(
          <Px key={`p${i}`} x={X + 3} y={Y + 4 + i * 5} w={10} h={3} k="rackPainel" />,
          <Px
            key={`a${i}`}
            x={X + 4}
            y={Y + 5 + i * 5}
            f={i % 2 ? "#4fd1a5" : "#5ab0ff"}
            className="pxe-led"
            atraso={((d.x * 3 + d.y + i) % 7) * 0.23}
          />,
          <Px key={`b${i}`} x={X + 6} y={Y + 5 + i * 5} f="#4fd1a5" />,
          <Px key={`c${i}`} x={X + 9} y={Y + 5 + i * 5} w={3} f="#5d6570" />,
        );
      }
      return (
        <g>
          <Px x={X + 2} y={Y + 31} w={12} className={SOMBRA} />
          <Px x={X + 2} y={Y + 1} w={12} h={30} k="rack" />
          <Px x={X + 2} y={Y + 1} w={12} h={1} k="metalEsc" />
          {leds}
        </g>
      );
    }
    case "sofa":
      return (
        <g>
          <Px x={X + 2} y={Y + 28} w={44} h={2} className={SOMBRA} />
          <Px x={X + 2} y={Y + 6} w={44} h={9} k="sofaEsc" />
          <Px x={X + 4} y={Y + 13} w={40} h={11} k="sofa" />
          <Px x={X + 24} y={Y + 13} w={1} h={11} k="sofaEsc" />
          <Px x={X + 1} y={Y + 11} w={5} h={16} k="sofaEsc" />
          <Px x={X + 42} y={Y + 11} w={5} h={16} k="sofaEsc" />
          <Px x={X + 4} y={Y + 24} w={40} h={3} k="sofaEsc" />
          <Px x={X + 3} y={Y + 6} w={42} h={1} k="sofa" />
          <Px x={X + 9} y={Y + 9} w={6} h={5} f="#e9d9a6" />
        </g>
      );
    case "poltrona":
      return (
        <g>
          <Px x={X + 2} y={Y + 15} w={12} className={SOMBRA} />
          <Px x={X + 3} y={Y + 1} w={10} h={6} k="poltronaEsc" />
          <Px x={X + 3} y={Y + 6} w={10} h={7} k="poltrona" />
          <Px x={X + 1} y={Y + 4} w={3} h={10} k="poltronaEsc" />
          <Px x={X + 12} y={Y + 4} w={3} h={10} k="poltronaEsc" />
          <Px x={X + 4} y={Y + 13} w={8} h={2} k="poltronaEsc" />
        </g>
      );
    case "mesa-redonda":
      return (
        <g>
          <Px x={X + 18} y={Y + 3} w={12} h={7} k="cadeira" />
          <Px x={X + 3} y={Y + 18} w={7} h={12} k="cadeira" />
          <Px x={X + 38} y={Y + 18} w={7} h={12} k="cadeira" />
          <Px x={X + 13} y={Y + 37} w={22} h={2} className={SOMBRA} />
          <Px x={X + 15} y={Y + 11} w={18} h={26} k="madeira" />
          <Px x={X + 11} y={Y + 15} w={26} h={18} k="madeira" />
          <Px x={X + 13} y={Y + 13} w={22} h={22} k="madeira" />
          <Px x={X + 16} y={Y + 13} w={10} h={2} k="madeiraClara" />
          <Px x={X + 13} y={Y + 33} w={22} h={2} k="madeiraEsc" />
          <Px x={X + 15} y={Y + 35} w={18} h={2} k="madeiraEsc" />
          <Px x={X + 18} y={Y + 19} w={3} h={3} k="papel" />
          <Px x={X + 27} y={Y + 25} w={3} h={3} k="papel" />
          <Px x={X + 22} y={Y + 23} w={6} h={5} k="papel" />
          <Px x={X + 18} y={Y + 39} w={12} h={7} k="cadeira" />
          <Px x={X + 18} y={Y + 39} w={12} h={1} k="cadeiraClara" />
        </g>
      );
    case "bebedouro":
      return (
        <g>
          <Px x={X + 3} y={Y + 30} w={10} h={2} className={SOMBRA} />
          <Px x={X + 4} y={Y + 2} w={8} h={10} k="agua" />
          <Px x={X + 6} y={Y + 1} w={4} h={1} k="agua" />
          <Px x={X + 5} y={Y + 4} w={1} h={5} k="bebedouro" o={0.7} />
          <Px x={X + 3} y={Y + 12} w={10} h={18} k="bebedouro" />
          <Px x={X + 3} y={Y + 12} w={10} h={1} k="metal" />
          <Px x={X + 5} y={Y + 16} w={2} h={2} f="#5ab0ff" />
          <Px x={X + 9} y={Y + 16} w={2} h={2} f="#e2574c" />
          <Px x={X + 5} y={Y + 21} w={6} h={1} k="metalEsc" />
        </g>
      );
    case "arquivo":
      return (
        <g>
          <Px x={X + 2} y={Y + 15} w={12} className={SOMBRA} />
          <Px x={X + 2} y={Y + 1} w={12} h={14} k="metal" />
          <Px x={X + 3} y={Y + 5} w={10} k="metalEsc" />
          <Px x={X + 3} y={Y + 10} w={10} k="metalEsc" />
          <Px x={X + 7} y={Y + 3} w={2} k="metalEsc" />
          <Px x={X + 7} y={Y + 7} w={2} k="metalEsc" />
          <Px x={X + 7} y={Y + 12} w={2} k="metalEsc" />
        </g>
      );
    case "balcao":
      return (
        <g>
          <Px x={X} y={Y + 15} w={48} className={SOMBRA} />
          <Px x={X} y={Y + 2} w={48} h={13} k="balcao" />
          <Px x={X} y={Y + 2} w={48} h={3} k="balcaoTopo" />
          <Px x={X + 4} y={Y - 5} w={9} h={10} k="metalEsc" />
          <Px x={X + 6} y={Y - 3} w={5} h={2} f="#2b2f36" />
          <Px x={X + 10} y={Y + 1} w={1} h={1} f="#e2574c" />
          <Px x={X + 17} y={Y} w={3} h={3} k="papel" />
          <Px x={X + 22} y={Y} w={3} h={3} f="#c0564b" />
          <Px x={X + 31} y={Y + 2} w={11} h={3} k="metal" />
          <Px x={X + 35} y={Y - 1} w={2} h={3} k="metalEsc" />
          <Px x={X + 8} y={Y + 8} w={1} h={4} k="madeiraEsc" />
          <Px x={X + 24} y={Y + 8} w={1} h={4} k="madeiraEsc" />
          <Px x={X + 40} y={Y + 8} w={1} h={4} k="madeiraEsc" />
        </g>
      );
    default:
      return null;
  }
}

/* ---------------------------------------------------------------- gente */

/**
 * Uma pessoa sentada, de frente para quem olha (o monitor está virado para
 * ela; a gente vê as costas dele). (cx, topo) = centro e alto da cabeça.
 * Do peito para baixo a mesa cobre.
 */
export function CorpoPixel({ ap, cx, topo }: { ap: Aparencia; cx: number; topo: number }) {
  const x0 = cx - 6;
  const p = (x: number, y: number, w: number, h: number, f: string, key: string) => (
    <rect key={key} x={x0 + x} y={topo + y} width={w} height={h} fill={f} />
  );
  const olho = "#2a211c";
  const partes: ReactElement[] = [];
  // Cabelo de trás (fica atrás do rosto).
  if (ap.penteado === "longo") partes.push(p(2, 1, 8, 9, ap.cabelo, "ct"));
  if (ap.penteado === "rabo") partes.push(p(9, 3, 2, 5, ap.cabelo, "rb"));
  if (ap.penteado === "coque") partes.push(p(4, -2, 4, 2, ap.cabelo, "cq"), p(5, -3, 2, 1, ap.cabelo, "cq2"));
  // Tronco e ombros.
  partes.push(
    p(2, 8, 8, 6, ap.camisa, "tr"),
    p(1, 9, 1, 5, ap.camisa, "oe"),
    p(10, 9, 1, 5, ap.camisa, "od"),
    p(2, 12, 8, 2, ap.camisaSombra, "ts"),
    p(1, 12, 1, 2, ap.camisaSombra, "tse"),
    p(10, 12, 1, 2, ap.camisaSombra, "tsd"),
  );
  if (ap.chefe) {
    partes.push(p(5, 8, 2, 3, "#f4f1ea", "gola"), p(4, 8, 1, 1, "#f4f1ea", "gola2"), p(7, 8, 1, 1, "#f4f1ea", "gola3"), p(8, 10, 1, 1, "#e3b341", "broche"));
  } else {
    partes.push(p(5, 8, 2, 1, ap.camisaSombra, "gola"));
  }
  // Pescoço e rosto.
  partes.push(p(5, 7, 2, 1, ap.peleSombra, "pe"), p(3, 2, 6, 5, ap.pele, "ro"), p(3, 6, 6, 1, ap.peleSombra, "qx"));
  // Cabelo de cima.
  if (ap.penteado === "raspado") {
    partes.push(p(3, 1, 6, 1, ap.cabelo, "cr"));
  } else {
    partes.push(p(3, 0, 6, 1, ap.cabelo, "c0"), p(2, 1, 8, 1, ap.cabelo, "c1"), p(2, 2, 1, 2, ap.cabelo, "c2"), p(9, 2, 1, 2, ap.cabelo, "c3"));
    partes.push(ap.penteado === "curto" ? p(6, 2, 3, 1, ap.cabelo, "fr") : p(3, 2, 2, 1, ap.cabelo, "fr"));
  }
  // Olhos (ou óculos).
  if (ap.oculos) {
    partes.push(p(3, 4, 2, 1, "#22252b", "oc1"), p(7, 4, 2, 1, "#22252b", "oc2"), p(5, 4, 2, 1, "#6b7179", "oc3"));
  } else {
    partes.push(p(4, 4, 1, 1, olho, "ol1"), p(7, 4, 1, 1, olho, "ol2"));
  }
  partes.push(p(4, 5, 1, 1, "#e79a8b", "bc1"), p(7, 5, 1, 1, "#e79a8b", "bc2"));
  // Coroa da Diretora.
  if (ap.chefe) {
    const ouro = "#e3b341";
    partes.push(
      p(3, -2, 6, 2, ouro, "k0"),
      p(3, -4, 1, 2, ouro, "k1"),
      p(8, -4, 1, 2, ouro, "k2"),
      p(5, -5, 2, 3, ouro, "k3"),
      p(5, -1, 2, 1, "#c0392b", "k4"),
      p(4, -2, 1, 1, "#f6d77a", "k5"),
    );
  }
  return <>{partes}</>;
}

/** Só a cabeça e os ombros, num quadradinho (avatar da Diretora na conversa). */
export function RetratoPixel({ ap, tamanho = 32, className }: { ap: Aparencia; tamanho?: number; className?: string }) {
  return (
    <svg
      viewBox="-2 -6 16 18"
      width={tamanho}
      height={tamanho}
      shapeRendering="crispEdges"
      className={className}
      style={{ imageRendering: "pixelated" }}
      aria-hidden
    >
      <CorpoPixel ap={ap} cx={6} topo={0} />
    </svg>
  );
}

/**
 * Uma pessoa de corpo inteiro, para andar pelo escritório. (0, 0) = os pés.
 * Traz as três poses de perna (parada, os dois passos e sentada) e a xícara;
 * o CSS mostra a certa conforme os data-* que andar.ts põe no <g> de fora.
 */
export function PessoaEmPe({ ap }: { ap: Aparencia }) {
  const calca = ap.chefe ? "#1a2238" : "#3a414e";
  const sapato = "#241c17";
  const perna = (x: number, y: number, h: number, k: string) => (
    <g key={k}>
      <rect x={x} y={y} width={3} height={h} fill={calca} />
      <rect x={x} y={y + h} width={3} height={2} fill={sapato} />
    </g>
  );
  return (
    <>
      <ellipse cx={0} cy={0} rx={6} ry={1.6} className={SOMBRA} />
      <g className="pxe-passo-0">{[perna(-4, -9, 7, "e"), perna(1, -9, 7, "d")]}</g>
      <g className="pxe-passo-a">{[perna(-4, -9, 8, "e"), perna(1, -10, 6, "d")]}</g>
      <g className="pxe-passo-b">{[perna(-4, -10, 6, "e"), perna(1, -9, 8, "d")]}</g>
      <g className="pxe-pernas-sentado">
        <rect x={-5} y={-9} width={4} height={3} fill={calca} />
        <rect x={1} y={-9} width={4} height={3} fill={calca} />
        {[perna(-4, -6, 4, "e"), perna(1, -6, 4, "d")]}
      </g>
      <g className="pxe-tronco">
        <CorpoPixel ap={ap} cx={0} topo={-23} />
        <g className="pxe-xicara">
          <rect x={4} y={-12} width={3} height={3} fill="#f4f1ea" />
          <rect x={7} y={-11} width={1} height={1} fill="#f4f1ea" />
          <rect x={4} y={-12} width={3} height={1} fill="#6b3f22" />
        </g>
      </g>
    </>
  );
}

/* --------------------------------------------------------------- estação */

const COR_ESTADO: Record<EstadoMesa, string> = {
  trabalhando: "#43c463",
  em_dia: "#43c463",
  atrasado: "#e8b04a",
  ocioso: "#a3a9b2",
  com_erro: "#ef5a50",
  desligado: "#c3c8cf",
  aguardando_ativacao: "#c3c8cf",
};

export { geometriaDaEstacao };

/**
 * Cadeira, pessoa, mesa, teclado e monitor. Sem agente = mesa vazia.
 * O monitor acende (brilho atrás dele) quando o agente está trabalhando, e
 * fica avermelhado quando a última rodada deu erro.
 */
export function Estacao({
  lugar,
  ap,
  estado,
  destacado,
  atraso,
}: {
  lugar: Lugar;
  ap: Aparencia | null;
  estado: EstadoMesa | null;
  destacado: boolean;
  atraso: number;
}) {
  const { ox, oy, cx, topo } = geometriaDaEstacao(lugar);
  const r = sorteio(lugar.x * 13 + lugar.y * 7);
  const caneca = ["#c0564b", "#3f6f8f", "#d0a03a", "#f4f1ea"][Math.floor(r() * 4)];
  const parado = !estado || estado === "desligado" || estado === "aguardando_ativacao";
  const trabalhando = estado === "trabalhando";
  const led = !ap || parado ? null : estado === "com_erro" ? "#ef5a50" : trabalhando ? "#43c463" : "#7fb4ff";
  const brilho = trabalhando ? "#8fe3ff" : estado === "com_erro" ? "#ff6b5e" : null;
  const chefe = lugar.chefe;

  return (
    <g>
      {destacado && <rect x={ox + 5} y={oy + 16} width={26} height={22} rx={4} className="k-destaque" />}
      {/* Cadeira (atrás da pessoa). */}
      {chefe ? (
        <>
          <Px x={cx - 8} y={oy + 17} w={16} h={18} k="cadeiraChefe" />
          <Px x={cx - 7} y={oy + 16} w={14} h={1} k="cadeiraChefe" />
          <Px x={cx - 6} y={oy + 18} w={12} h={1} f="#9a4452" />
        </>
      ) : (
        <>
          <Px x={cx - 7} y={oy + (ap ? 24 : 26)} w={14} h={ap ? 11 : 9} k="cadeira" />
          <Px x={cx - 6} y={oy + (ap ? 23 : 25)} w={12} h={1} k="cadeira" />
          <Px x={cx - 6} y={oy + (ap ? 24 : 26)} w={12} h={1} k="cadeiraClara" />
        </>
      )}
      {/* A pessoa, com respiração bem leve (só sem "reduzir movimento"). */}
      {ap && (
        <g opacity={parado ? 0.55 : 1}>
          <g className={parado ? undefined : "pxe-respira"} style={{ animationDelay: `${atraso}s` }}>
            <CorpoPixel ap={ap} cx={cx} topo={topo} />
          </g>
        </g>
      )}
      {/* Mesa. */}
      {chefe ? (
        <>
          <Px x={ox + 1} y={oy + 47} w={46} className={SOMBRA} />
          <Px x={ox + 1} y={oy + 33} w={46} h={10} k="mogno" />
          <Px x={ox + 1} y={oy + 33} w={46} h={1} k="ouro" />
          <Px x={ox + 1} y={oy + 43} w={46} h={4} k="mognoEsc" />
          <Px x={ox + 1} y={oy + 43} w={46} h={1} k="ouro" />
          <Px x={ox + 19} y={oy + 44} w={10} h={2} k="ouro" />
          <Px x={ox + 3} y={oy + 26} w={7} h={3} k="ouro" />
          <Px x={ox + 6} y={oy + 29} w={1} h={5} k="metalEsc" />
          <Px x={ox + 4} y={oy + 34} w={5} h={1} k="metalEsc" />
          <Px x={ox + 42} y={oy + 35} w={4} h={4} k="vaso" />
          <Px x={ox + 41} y={oy + 30} w={6} h={5} k="folha" />
          <Px x={ox + 43} y={oy + 29} w={2} h={2} k="folhaClara" />
        </>
      ) : (
        <>
          <Px x={ox + 4} y={oy + 47} w={41} className={SOMBRA} />
          <Px x={ox + 3} y={oy + 34} w={42} h={9} k="madeira" />
          <Px x={ox + 3} y={oy + 34} w={42} h={1} k="madeiraClara" />
          <Px x={ox + 3} y={oy + 43} w={42} h={4} k="madeiraEsc" />
          <Px x={ox + 5} y={oy + 36} w={5} h={6} k="papel" />
          <Px x={ox + 6} y={oy + 38} w={3} k="tecladoEsc" />
          <Px x={ox + 6} y={oy + 40} w={2} k="tecladoEsc" />
          <Px x={ox + 41} y={oy + 37} w={3} h={3} f={caneca} />
          <Px x={ox + 44} y={oy + 38} w={1} h={1} f={caneca} />
        </>
      )}
      {/* Teclado e mãos. */}
      <Px x={cx - 6} y={oy + 37} w={12} h={3} k="teclado" />
      <Px x={cx - 5} y={oy + 38} w={10} h={1} k="tecladoEsc" />
      {ap && !parado && (
        <g className={trabalhando ? "pxe-digita" : undefined} style={{ animationDelay: `${atraso / 3}s` }}>
          <Px x={cx - 6} y={oy + 36} w={3} h={2} f={ap.pele} />
          <Px x={cx + 3} y={oy + 36} w={3} h={2} f={ap.pele} />
        </g>
      )}
      {/* Monitor (de costas para nós) com o brilho da tela. */}
      {brilho && <rect x={ox + 24} y={oy + 18} width={20} height={17} rx={3} fill={brilho} opacity={0.3} />}
      <Px x={ox + 27} y={oy + 21} w={14} h={11} k="monitor" />
      <Px x={ox + 27} y={oy + 21} w={14} h={1} k="metalEsc" />
      <Px x={ox + 33} y={oy + 32} w={2} h={3} k="metalEsc" />
      <Px x={ox + 31} y={oy + 35} w={6} h={2} k="metalEsc" />
      {led && <Px x={ox + 38} y={oy + 30} f={led} className={trabalhando ? "pxe-led" : undefined} />}
    </g>
  );
}

/* ------------------------------------------------------ crachá e balão */

export function larguraDoCracha(texto: string) {
  return Math.round(texto.length * 3.25 + 13);
}

/**
 * Crachá acima da cabeça: pílula escura, bolinha de estado (verde pulsando =
 * trabalhando; cinza = ocioso; vermelha = erro; vazada = desligado ou
 * aguardando ativação), o apelido, e os selinhos: engrenagem (rotina do
 * sistema) e brilho (agente criado pela equipe).
 */
export function Cracha({
  cx,
  y,
  texto,
  estado,
  sistema,
  novo,
  atraso,
}: {
  cx: number;
  y: number;
  texto: string;
  estado: EstadoMesa;
  sistema: boolean;
  novo: boolean;
  atraso: number;
}) {
  const largura = larguraDoCracha(texto);
  const x = cx - largura / 2;
  const vazada = estado === "desligado" || estado === "aguardando_ativacao";
  const cor = COR_ESTADO[estado] ?? COR_ESTADO.ocioso;
  let selo = x + largura + 1;
  return (
    <g>
      <rect x={x} y={y} width={largura} height={8} rx={4} fill="#171a21" opacity={0.9} />
      {vazada ? (
        <circle cx={x + 5} cy={y + 4} r={1.8} fill="none" stroke={cor} strokeWidth={0.8} strokeDasharray="1.2 0.8" />
      ) : (
        <>
          {estado === "trabalhando" && (
            <circle cx={x + 5} cy={y + 4} r={2} fill={cor} className="pxe-pulso" style={{ animationDelay: `${atraso}s` }} />
          )}
          <circle cx={x + 5} cy={y + 4} r={2} fill={cor} />
        </>
      )}
      <text x={x + 9} y={y + 5.9} fontSize={5.4} fontWeight={600} fontFamily={FONTE_PIXEL} fill="#f5f6f8">
        {texto}
      </text>
      {sistema &&
        (() => {
          const gx = selo + 3;
          const gy = y + 4;
          selo += 7;
          return (
            <g>
              <rect x={gx - 3} y={gy - 0.75} width={6} height={1.5} fill="#8d96a1" />
              <rect x={gx - 0.75} y={gy - 3} width={1.5} height={6} fill="#8d96a1" />
              <circle cx={gx} cy={gy} r={2.1} fill="#aab3bd" />
              <circle cx={gx} cy={gy} r={0.8} fill="#171a21" />
            </g>
          );
        })()}
      {novo && (
        <g className="pxe-brilho" style={{ animationDelay: `${atraso}s` }}>
          <rect x={selo + 2} y={y - 1} width={1} height={5} fill="#ffd34d" />
          <rect x={selo} y={y + 1} width={5} height={1} fill="#ffd34d" />
          <rect x={selo + 2} y={y + 1} width={1} height={1} fill="#fff6cf" />
        </g>
      )}
    </g>
  );
}

/** Largura do balão com texto (o botão clicável por cima usa a mesma conta). */
export function larguraDoBalao(texto: string) {
  return Math.round(texto.length * 3 + 7);
}

/** Balão de fala ao lado da cabeça: "…" (digitando) ou uma frase curtinha. */
export function BalaoFala({ x, y, balao, atraso }: { x: number; y: number; balao: Balao; atraso: number }) {
  const borda = "#2b2f36";
  if (balao.tipo === "digitando") {
    const w = 15;
    const h = 8;
    return (
      <g>
        <Px x={x} y={y} w={w} h={h} f={borda} />
        <Px x={x + 1} y={y + 1} w={w - 2} h={h - 2} k="balao" />
        <Px x={x + 1} y={y + h} w={2} f={borda} />
        <Px x={x} y={y + h + 1} f={borda} />
        {[0, 1, 2].map((i) => (
          <Px key={i} x={x + 3 + i * 3.5} y={y + 4} w={2} h={1.2} f={borda} className="pxe-ponto" atraso={atraso + i * 0.2} />
        ))}
      </g>
    );
  }
  const w = larguraDoBalao(balao.texto);
  const h = 8;
  const corTexto = balao.falaTipo === "alerta" ? "#b3362d" : balao.falaTipo === "plano" ? "#8a6414" : borda;
  return (
    <g>
      <Px x={x} y={y} w={w} h={h} f={borda} />
      <Px x={x + 1} y={y + 1} w={w - 2} h={h - 2} k="balao" />
      <Px x={x + 1} y={y + h} w={2} f={borda} />
      <Px x={x} y={y + h + 1} f={borda} />
      <text x={x + 3.5} y={y + 5.7} fontSize={5} fontWeight={600} fontFamily={FONTE_PIXEL} fill={corTexto}>
        {balao.texto}
      </text>
    </g>
  );
}
