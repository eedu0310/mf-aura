"use client";

/**
 * O ESCRITÓRIO EM PIXEL: a planta (planta.ts) desenhada com os sprites
 * (sprites.tsx), com um botão de verdade em cima de cada agente.
 *
 *   - passar o mouse (ou o foco do teclado) mostra nome, cargo e o que ele
 *     está fazendo; clicar abre a ficha do agente (a mesma gaveta de sempre);
 *   - a equipe se mexe de verdade (andar.ts): quem está trabalhando fica na
 *     mesa; quem está sem tarefa vai para a copa, a sala de descanso ou faz
 *     outra coisa; quem manda um recado anda até quem vai receber. O crachá,
 *     o balão e o botão vão junto com o boneco;
 *   - o desenho acompanha a largura do espaço (viewBox); abaixo de "sm" a
 *     planta vira salas empilhadas, uma embaixo da outra, cada uma do tamanho
 *     da tela — no celular ninguém precisa rolar para o lado;
 *   - os botões são HTML por cima do SVG (posição em %), então o leitor de
 *     tela e o Tab funcionam como em qualquer botão.
 */
import { useId, useLayoutEffect, useMemo, useState, type CSSProperties } from "react";
import { Footprints, Settings, Sparkles } from "lucide-react";
import type { FalaEscritorio, MesaAgente } from "@/lib/agentes/tipos";
import { ESTADOS, LuzStatus, rotuloSetor } from "../comum";
import { Movimento } from "./andar";
import { BALAO_DO_TIPO, apelido, aparenciaDoAgente, balaoDoAgente, hashTexto, type Balao } from "./aparencia";
import { crachaAcimaDosPes } from "./movimento";
import { TILE, montarPlanta, type AgenteNaPlanta, type Lugar, type SalaPlanta } from "./planta";
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
  PessoaEmPe,
  larguraDoBalao,
} from "./sprites";

/** O pedaço da planta que um quadro mostra (em ladrilhos). */
interface Recorte {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Salas que aparecem no celular mesmo sem mesa: é para onde a equipe vai. */
const SALAS_DE_LAZER = new Set(["copa", "descanso"]);

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
  /**
   * Abre a ficha do agente. "relatorio" = clicou no balão de fala: a ficha
   * abre no que ele deixou para aprovar (ou na atividade, se não houver).
   */
  aoAbrir: (id: string, aba?: "relatorio") => void;
  /**
   * null = a planta ocupa a largura toda do espaço (ajustar). Um número
   * amplia: cada ladrilho fica com TILE × zoom pixels e a área rola.
   */
  zoom?: number | null;
}) {
  // A tela relê a cada 20 s e "mesas" vem nova; a planta só muda se a equipe mudar.
  const chavePlanta = JSON.stringify(mesas.map((m): AgenteNaPlanta => ({ id: m.id, setor: m.setor, chefe: m.id === diretoraId })));
  const planta = useMemo(() => montarPlanta(JSON.parse(chavePlanta) as AgenteNaPlanta[]), [chavePlanta]);
  const porId = useMemo(() => new Map(mesas.map((m) => [m.id, m])), [mesas]);
  const [foco, setFoco] = useState<string | null>(null);

  // O motor do movimento: avisa o React só quando alguém senta, levanta ou conversa.
  const [, setVersao] = useState(0);
  const [motor] = useState(() => new Movimento(() => setVersao((v) => v + 1)));
  useLayoutEffect(() => {
    motor.sincronizar(planta, mesas, falas);
  }, [motor, planta, mesas, falas]);
  useLayoutEffect(() => {
    motor.iniciar();
    return () => motor.parar();
  }, [motor]);

  const comum = { porId, falas, foco, setFoco, abertoId, aoAbrir, motor };
  const salasDoCelular = planta.salas.filter((s) => s.lugares.some((l) => l.agenteId) || SALAS_DE_LAZER.has(s.id));

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
              todas={planta.salas}
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
        {salasDoCelular.map((s) => {
          const n = s.lugares.filter((l) => l.agenteId).length;
          return (
            <section key={s.id} aria-label={s.rotulo} className="overflow-hidden rounded-xl border border-aura-mist">
              <header className="flex items-center gap-2 border-b border-aura-mist bg-aura-surface px-3 py-2">
                <h3 className="text-sm font-semibold text-aura-graphite">{s.rotulo}</h3>
                {n > 0 && (
                  <span className="ml-auto text-xs text-aura-graphite-soft">
                    {n} {n === 1 ? "agente" : "agentes"}
                  </span>
                )}
              </header>
              <Quadro
                moldura={{ x: s.x, y: s.y, w: s.w, h: s.h }}
                salas={[s]}
                todas={planta.salas}
                rotulo={`Sala ${s.rotulo}`}
                {...comum}
              />
            </section>
          );
        })}
        <Legenda />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- quadro */

function Quadro({
  moldura,
  salas,
  todas,
  predio,
  rotulo,
  porId,
  falas,
  foco,
  setFoco,
  abertoId,
  aoAbrir,
  motor,
}: {
  moldura: Recorte;
  /** As salas que este quadro desenha. */
  salas: SalaPlanta[];
  /** Todas as salas: os bonecos de qualquer sala podem passar por aqui. */
  todas: SalaPlanta[];
  predio?: { largura: number; altura: number };
  rotulo: string;
  porId: Map<string, MesaAgente>;
  falas: FalaEscritorio[];
  foco: string | null;
  setFoco: (id: string | null) => void;
  abertoId: string | null;
  aoAbrir: (id: string, aba?: "relatorio") => void;
  motor: Movimento;
}) {
  const prefixo = `pxe${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const vb = { x: moldura.x * TILE, y: moldura.y * TILE, w: moldura.w * TILE, h: moldura.h * TILE };

  const lugares = salas.flatMap((s) => s.lugares);
  // Gente de todas as salas (no celular, quem anda até a Copa aparece nela).
  const equipe = todas
    .flatMap((s) => s.lugares)
    .filter((l): l is Lugar & { agenteId: string } => Boolean(l.agenteId && porId.has(l.agenteId)));

  // Ordem de pintura: quem está mais embaixo na tela fica na frente.
  const objetos = [
    ...salas.flatMap((s) =>
      s.decor.filter((d) => d.tipo !== "tapete").map((d) => ({ fundo: d.y + d.h, chave: `d-${d.tipo}-${d.x}-${d.y}`, movel: d, lugar: null })),
    ),
    ...lugares.map((l) => ({ fundo: l.y + 3, chave: `l-${l.x}-${l.y}`, movel: null, lugar: l })),
  ].sort((a, b) => a.fundo - b.fundo || (a.movel ? -1 : 1));

  const pct = (v: number, base: number, total: number) => `${((v - base) / total) * 100}%`;
  const atrasoDe = (id: string) => (hashTexto(id) % 3600) / 1000;
  const nomeDe = (id: string) => porId.get(id)?.nome ?? id;
  const balaoDe = (mesa: MesaAgente): Balao | null => {
    const recado = motor.recadoEmConversa(mesa.id);
    return recado
      ? { tipo: "fala", texto: BALAO_DO_TIPO[recado.tipo] ?? "Um recado", falaTipo: recado.tipo }
      : balaoDoAgente(mesa, falas);
  };

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
          // Fora da mesa (na copa, andando…): a cadeira fica vazia.
          const sentado = Boolean(mesa && motor.naMesa(mesa.id));
          return (
            <Estacao
              key={o.chave}
              lugar={l}
              ap={mesa && sentado ? aparenciaDoAgente(mesa.id, { chefe: l.chefe }) : null}
              estado={mesa?.estado ?? null}
              destacado={Boolean(mesa && sentado && (foco === mesa.id || abertoId === mesa.id))}
              atraso={mesa ? atrasoDe(mesa.id) : 0}
            />
          );
        })}
        {predio && <Moldura largura={predio.largura} altura={predio.altura} />}

        {/* A equipe: cada um é um <g> que o motor move (posição escrita fora do React). */}
        {equipe.map((l) => {
          const mesa = porId.get(l.agenteId)!;
          const ap = aparenciaDoAgente(mesa.id, { chefe: l.chefe });
          const balao = balaoDe(mesa);
          const alto = crachaAcimaDosPes(l.chefe);
          const destaque = foco === mesa.id || abertoId === mesa.id;
          return (
            <g key={`a-${mesa.id}`} ref={(el) => motor.registrarBoneco(mesa.id, el)}>
              <g className="pxe-corpo">
                {destaque && <rect x={-9} y={-alto + 6} width={18} height={alto - 4} rx={3} className="k-destaque" />}
                <g className="pxe-vira">
                  <PessoaEmPe ap={ap} />
                </g>
              </g>
              <Cracha
                cx={0}
                y={-alto}
                texto={apelido(mesa.nome)}
                estado={mesa.estado}
                sistema={mesa.tipo === "sistema"}
                novo={mesa.criadoPor !== "sistema"}
                atraso={atrasoDe(mesa.id)}
              />
              {balao && <BalaoFala x={2} y={-alto - 11} balao={balao} atraso={atrasoDe(mesa.id)} />}
            </g>
          );
        })}
      </svg>

      {/* Um botão de verdade em cima de cada agente (o motor põe a posição). */}
      <div className="absolute inset-0">
        {equipe.map((l) => {
          const mesa = porId.get(l.agenteId)!;
          const estado = ESTADOS[mesa.estado]?.rotulo ?? mesa.estado;
          const fora = motor.atividade(mesa.id, nomeDe);
          return (
            <button
              key={mesa.id}
              ref={(el) => motor.registrarBotao(mesa.id, el, vb)}
              type="button"
              onClick={() => aoAbrir(mesa.id)}
              onMouseEnter={() => setFoco(mesa.id)}
              onMouseLeave={() => setFoco(null)}
              onFocus={() => setFoco(mesa.id)}
              onBlur={() => setFoco(null)}
              aria-label={`${mesa.nome}, ${mesa.cargo}. ${estado}. ${fora ? `${fora}. ` : ""}${mesa.fazendoAgora} Abrir ficha.`}
              className="absolute cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-aura-petrol-500"
            />
          );
        })}
        {/* O balão de fala também é botão: abre o relatório e o que ele deixou para aprovar. */}
        {equipe.map((l) => {
          const mesa = porId.get(l.agenteId)!;
          const balao = balaoDe(mesa);
          if (!balao || balao.tipo !== "fala") return null;
          return (
            <button
              key={`b-${mesa.id}`}
              ref={(el) => motor.registrarBalao(mesa.id, el, vb, larguraDoBalao(balao.texto))}
              type="button"
              onClick={() => aoAbrir(mesa.id, "relatorio")}
              title={`${balao.texto} — ver o que ${mesa.nome} trouxe`}
              aria-label={`${mesa.nome}: ${balao.texto}. Ver o relatório e o que espera sua aprovação.`}
              className="absolute cursor-pointer rounded-sm hover:outline hover:outline-2 hover:outline-aura-petrol-500 focus-visible:outline-2 focus-visible:outline-aura-petrol-500"
            />
          );
        })}
        {foco &&
          (() => {
            const mesa = porId.get(foco);
            const v = motor.vista(foco);
            if (!mesa || !v) return null;
            const topoCracha = v.y - crachaAcimaDosPes(v.chefe);
            const esquerda = (v.x - vb.x) / vb.w;
            if (esquerda < -0.02 || esquerda > 1.02) return null;
            const emCima = (topoCracha - vb.y) / vb.h < 0.3;
            const estilo: CSSProperties = {
              left: `${esquerda * 100}%`,
              top: emCima ? pct(v.y + (v.pose === "mesa" ? 14 : 4), vb.y, vb.h) : pct(topoCracha, vb.y, vb.h),
              transform: `translate(${esquerda < 0.22 ? "-12%" : esquerda > 0.78 ? "-88%" : "-50%"}, ${emCima ? "6px" : "calc(-100% - 6px)"})`,
            };
            return <Dica mesa={mesa} estilo={estilo} fora={motor.atividade(foco, nomeDe)} />;
          })()}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- dica */

function Dica({ mesa, estilo, fora }: { mesa: MesaAgente; estilo: CSSProperties; fora: string | null }) {
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
      {fora && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-aura-petrol-600">
          <Footprints size={11} aria-hidden />
          {fora}
        </p>
      )}
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
      <span className={item}>
        <Footprints size={11} aria-hidden />
        Sem tarefa: copa, descanso ou outra coisa · com recado: vai até o colega
      </span>
      <span className="ml-auto hidden md:inline">Clique em um agente para ver a ficha.</span>
    </div>
  );
}
