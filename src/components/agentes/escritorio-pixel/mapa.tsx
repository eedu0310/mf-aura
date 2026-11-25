"use client";

/**
 * O ESCRITÓRIO EM PIXEL: a planta (planta.ts) desenhada com os sprites
 * (sprites.tsx), com um botão de verdade em cima de cada agente.
 *
 *   - passar o mouse (ou o foco do teclado) mostra nome, cargo e o que ele
 *     está fazendo; clicar abre a ficha do agente (a mesma gaveta de sempre);
 *   - o desenho acompanha a largura do espaço (viewBox); abaixo de "sm" a
 *     planta vira salas empilhadas, uma embaixo da outra, cada uma do tamanho
 *     da tela — no celular ninguém precisa rolar para o lado;
 *   - os botões são HTML por cima do SVG (posição em %), então o leitor de
 *     tela e o Tab funcionam como em qualquer botão.
 */
import { useId, useMemo, useState, type CSSProperties } from "react";
import { Settings, Sparkles } from "lucide-react";
import type { FalaEscritorio, MesaAgente } from "@/lib/agentes/tipos";
import { ESTADOS, LuzStatus, rotuloSetor } from "../comum";
import { apelido, aparenciaDoAgente, balaoDoAgente, hashTexto } from "./aparencia";
import { CEL_L, TILE, montarPlanta, type Lugar, type SalaPlanta } from "./planta";
import {
  BalaoFala,
  ChaoEParedes,
  Cracha,
  CSS_ESCRITORIO_PIXEL,
  DefsPisos,
  Estacao,
  Moldura,
  Movel,
  NaParede,
  geometriaDaEstacao,
} from "./sprites";

/** O pedaço da planta que um quadro mostra (em ladrilhos). */
interface Recorte {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function EscritorioPixel({
  mesas,
  falas,
  diretoraId,
  abertoId,
  aoAbrir,
  zoom = null,
}: {
  mesas: MesaAgente[];
  falas: FalaEscritorio[];
  diretoraId: string | null;
  abertoId: string | null;
  aoAbrir: (id: string) => void;
  /**
   * null = a planta ocupa a largura toda do espaço (ajustar). Um número
   * amplia: cada ladrilho fica com TILE × zoom pixels e a área rola.
   */
  zoom?: number | null;
}) {
  const planta = useMemo(
    () => montarPlanta(mesas.map((m) => ({ id: m.id, setor: m.setor, chefe: m.id === diretoraId }))),
    [mesas, diretoraId],
  );
  const porId = useMemo(() => new Map(mesas.map((m) => [m.id, m])), [mesas]);
  const [foco, setFoco] = useState<string | null>(null);

  const comum = { porId, falas, foco, setFoco, abertoId, aoAbrir };
  const salasComGente = planta.salas.filter((s) => s.lugares.some((l) => l.agenteId));

  return (
    <div className="pxe">
      <style>{CSS_ESCRITORIO_PIXEL}</style>

      {/* Tela média para cima: o prédio inteiro. */}
      <div className="hidden sm:block">
        <div className="overflow-auto rounded-xl border border-aura-mist bg-aura-sunken/40">
          <div
            style={
              zoom
                ? { width: planta.largura * TILE * zoom, maxWidth: "none" }
                : { minWidth: planta.largura * TILE * 1.15 }
            }
          >
            <Quadro
              moldura={{ x: 0, y: 0, w: planta.largura, h: planta.altura }}
              salas={planta.salas}
              predio={{ largura: planta.largura, altura: planta.altura }}
              rotulo="Planta do escritório da equipe de agentes"
              {...comum}
            />
          </div>
        </div>
        <Legenda />
      </div>

      {/* Celular: uma sala embaixo da outra. */}
      <div className="space-y-3 sm:hidden">
        {salasComGente.map((s) => (
          <section key={s.id} aria-label={s.rotulo} className="overflow-hidden rounded-xl border border-aura-mist">
            <header className="flex items-center gap-2 border-b border-aura-mist bg-aura-surface px-3 py-2">
              <h3 className="text-sm font-semibold text-aura-graphite">{s.rotulo}</h3>
              <span className="ml-auto text-xs text-aura-graphite-soft">
                {s.lugares.filter((l) => l.agenteId).length}{" "}
                {s.lugares.filter((l) => l.agenteId).length === 1 ? "agente" : "agentes"}
              </span>
            </header>
            <Quadro moldura={{ x: s.x, y: s.y, w: s.w, h: s.h }} salas={[s]} rotulo={`Sala ${s.rotulo}`} {...comum} />
          </section>
        ))}
        <Legenda />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- quadro */

function Quadro({
  moldura,
  salas,
  predio,
  rotulo,
  porId,
  falas,
  foco,
  setFoco,
  abertoId,
  aoAbrir,
}: {
  moldura: Recorte;
  salas: SalaPlanta[];
  predio?: { largura: number; altura: number };
  rotulo: string;
  porId: Map<string, MesaAgente>;
  falas: FalaEscritorio[];
  foco: string | null;
  setFoco: (id: string | null) => void;
  abertoId: string | null;
  aoAbrir: (id: string) => void;
}) {
  const prefixo = `pxe${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const vb = { x: moldura.x * TILE, y: moldura.y * TILE, w: moldura.w * TILE, h: moldura.h * TILE };

  const lugares = salas.flatMap((s) => s.lugares);
  const ocupados = lugares.filter((l): l is Lugar & { agenteId: string } => Boolean(l.agenteId && porId.has(l.agenteId)));

  // Ordem de pintura: quem está mais embaixo na tela fica na frente.
  const objetos = [
    ...salas.flatMap((s) =>
      s.decor.filter((d) => d.tipo !== "tapete").map((d) => ({ fundo: d.y + d.h, chave: `d-${d.tipo}-${d.x}-${d.y}`, movel: d, lugar: null })),
    ),
    ...lugares.map((l) => ({ fundo: l.y + 3, chave: `l-${l.x}-${l.y}`, movel: null, lugar: l })),
  ].sort((a, b) => a.fundo - b.fundo || (a.movel ? -1 : 1));

  const pct = (v: number, base: number, total: number) => `${((v - base) / total) * 100}%`;
  const atrasoDe = (id: string) => (hashTexto(id) % 3600) / 1000;

  return (
    <div className="relative">
      <svg
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="block h-auto w-full select-none"
        shapeRendering="crispEdges"
        style={{ imageRendering: "pixelated" }}
        aria-hidden
      >
        <defs>
          <DefsPisos prefixo={prefixo} />
        </defs>
        {salas.map((s) => (
          <ChaoEParedes key={s.id} sala={s} prefixo={prefixo} />
        ))}
        {salas.flatMap((s) => s.parede.map((item) => <NaParede key={`p-${item.tipo}-${item.x}`} item={item} y={s.y} />))}
        {salas.flatMap((s) =>
          s.decor.filter((d) => d.tipo === "tapete").map((d) => <Movel key={`t-${d.x}-${d.y}`} d={d} />),
        )}
        {objetos.map((o) => {
          if (o.movel) return <Movel key={o.chave} d={o.movel} />;
          const l = o.lugar!;
          const mesa = l.agenteId ? porId.get(l.agenteId) : undefined;
          return (
            <Estacao
              key={o.chave}
              lugar={l}
              ap={mesa ? aparenciaDoAgente(mesa.id, { chefe: l.chefe }) : null}
              estado={mesa?.estado ?? null}
              destacado={Boolean(mesa && (foco === mesa.id || abertoId === mesa.id))}
              atraso={mesa ? atrasoDe(mesa.id) : 0}
            />
          );
        })}
        {predio && <Moldura largura={predio.largura} altura={predio.altura} />}
        {ocupados.map((l) => {
          const mesa = porId.get(l.agenteId)!;
          const g = geometriaDaEstacao(l);
          return (
            <Cracha
              key={`c-${mesa.id}`}
              cx={g.cx}
              y={g.crachaY}
              texto={apelido(mesa.nome)}
              estado={mesa.estado}
              sistema={mesa.tipo === "sistema"}
              novo={mesa.criadoPor !== "sistema"}
              atraso={atrasoDe(mesa.id)}
            />
          );
        })}
        {ocupados.map((l) => {
          const mesa = porId.get(l.agenteId)!;
          const balao = balaoDoAgente(mesa, falas);
          if (!balao) return null;
          const g = geometriaDaEstacao(l);
          // O balão sai de cima do crachá, com a pontinha apontando para ele.
          return <BalaoFala key={`b-${mesa.id}`} x={g.cx + 2} y={g.balaoY} balao={balao} atraso={atrasoDe(mesa.id)} />;
        })}
      </svg>

      {/* Um botão de verdade em cima de cada agente. */}
      <div className="absolute inset-0">
        {ocupados.map((l) => {
          const mesa = porId.get(l.agenteId)!;
          const g = geometriaDaEstacao(l);
          const estado = ESTADOS[mesa.estado]?.rotulo ?? mesa.estado;
          return (
            <button
              key={mesa.id}
              type="button"
              onClick={() => aoAbrir(mesa.id)}
              onMouseEnter={() => setFoco(mesa.id)}
              onMouseLeave={() => setFoco(null)}
              onFocus={() => setFoco(mesa.id)}
              onBlur={() => setFoco(null)}
              aria-label={`${mesa.nome}, ${mesa.cargo}. ${estado}. ${mesa.fazendoAgora} Abrir ficha.`}
              className="absolute cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-aura-petrol-500"
              style={{
                left: pct(g.ox + 4, vb.x, vb.w),
                top: pct(g.crachaY - 1, vb.y, vb.h),
                width: `${((CEL_L * TILE - 8) / vb.w) * 100}%`,
                height: `${((g.oy + 46 - (g.crachaY - 1)) / vb.h) * 100}%`,
              }}
            />
          );
        })}
        {foco &&
          (() => {
            const l = ocupados.find((o) => o.agenteId === foco);
            const mesa = l ? porId.get(l.agenteId) : undefined;
            if (!l || !mesa) return null;
            const g = geometriaDaEstacao(l);
            const esquerda = (g.cx - vb.x) / vb.w;
            const emCima = (g.oy - vb.y) / vb.h < 0.3;
            const estilo: CSSProperties = {
              left: `${esquerda * 100}%`,
              top: emCima ? pct(g.oy + 48, vb.y, vb.h) : pct(g.crachaY, vb.y, vb.h),
              transform: `translate(${esquerda < 0.22 ? "-12%" : esquerda > 0.78 ? "-88%" : "-50%"}, ${emCima ? "6px" : "calc(-100% - 6px)"})`,
            };
            return <Dica mesa={mesa} estilo={estilo} />;
          })()}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- dica */

function Dica({ mesa, estilo }: { mesa: MesaAgente; estilo: CSSProperties }) {
  const estado = ESTADOS[mesa.estado] ?? ESTADOS.ocioso;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 w-64 max-w-[80vw] rounded-lg border border-aura-mist bg-aura-surface px-3 py-2.5 text-left shadow-lg"
      style={estilo}
    >
      <p className="truncate text-sm font-semibold text-aura-graphite">{mesa.nome}</p>
      <p className="truncate text-xs text-aura-graphite-soft">
        {mesa.cargo} · {rotuloSetor(mesa.setor)}
      </p>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-aura-graphite">
        <LuzStatus estado={mesa.estado} className="!h-2 !w-2" />
        {estado.rotulo}
        {mesa.tipo === "sistema" && <span className="text-aura-graphite-soft">· rotina do sistema</span>}
        {mesa.criadoPor !== "sistema" && <span className="text-aura-gold-700">· criado pela equipe</span>}
      </p>
      {mesa.fazendoAgora && <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-aura-graphite-soft">{mesa.fazendoAgora}</p>}
      <p className="mt-1.5 text-[0.6875rem] text-aura-petrol-600">Clique para abrir a ficha</p>
    </div>
  );
}

/* ------------------------------------------------------------- legenda */

function Legenda() {
  const item = "inline-flex items-center gap-1.5";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[0.6875rem] text-aura-graphite-soft">
      <span className={item}>
        <LuzStatus estado="em_dia" className="!h-2 !w-2" />
        Em dia
      </span>
      <span className={item}>
        <LuzStatus estado="trabalhando" className="!h-2 !w-2" />
        Trabalhando agora
      </span>
      <span className={item}>
        <LuzStatus estado="atrasado" className="!h-2 !w-2" />
        Atrasado
      </span>
      <span className={item}>
        <LuzStatus estado="ocioso" className="!h-2 !w-2" />
        Ainda não rodou
      </span>
      <span className={item}>
        <LuzStatus estado="com_erro" className="!h-2 !w-2" />
        Com erro
      </span>
      <span className={item}>
        <LuzStatus estado="desligado" className="!h-2 !w-2" />
        Desligado ou aguardando
      </span>
      <span className={item}>
        <Settings size={11} aria-hidden />
        Rotina do sistema
      </span>
      <span className={item}>
        <Sparkles size={11} className="text-aura-gold-700" aria-hidden />
        Criado pela equipe
      </span>
      <span className="ml-auto hidden md:inline">Clique em um agente para ver a ficha.</span>
    </div>
  );
}
