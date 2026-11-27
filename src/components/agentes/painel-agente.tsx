"use client";

/**
 * PAINEL DO AGENTE: o que abre quando o gestor clica num agente (no
 * escritório em pixel, na lista de mesas, no mural ou na aba Equipe).
 *
 * Pedido do Elton (25/11/2026): "quando eu clicar no agente tem que mostrar o
 * que ele está falando, o que ele fez etc. — não o que aparece hoje; coloca o
 * que aparece hoje em outro lugar". Então o painel abre em três abas:
 *
 *   ATIVIDADE (a primeira) ─ uma linha do tempo como um chat: o que o agente
 *     disse (para quem, com o tipo da fala), o que disseram para ele (de quem)
 *     e cada rodada dele ("Rodou às 14:20 · 12 achados · US$ 0,02 — resumo"),
 *     mais nova em cima e separada por dia ("Hoje", "Ontem", a data).
 *   O QUE ENCONTROU ─ os achados que ele criou: abertos e resolvidos em 30
 *     dias, com prioridade, situação, loja, para quem foi e o botão "Abrir".
 *   FICHA E AJUSTES ─ a ficha de antes, sem mudar nada (missão, agenda,
 *     última rodada, gasto x orçamento e os comandos do gestor mestre).
 *
 * Os dados vêm de GET /api/gestor/agentes/[id] (contrato em
 * src/lib/agentes/painel.ts) e são relidos a cada 20 s enquanto o painel
 * está aberto e a aba do navegador visível. Sem a migração 110 a rota
 * responde 409: Atividade e Achados mostram o motivo, a Ficha segue normal.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  History,
  Inbox,
  ListChecks,
  Loader2,
  Radar,
  SlidersHorizontal,
  UserRound,
  Users,
} from "lucide-react";
import type { MesaAgente, FalaEscritorio } from "@/lib/agentes/tipos";
import {
  agruparPorDia,
  filtrarAchados,
  textoDuracao,
  type AchadoNoPainel,
  type FalaNoPainel,
  type FiltroAchados,
  LIMITE_ATIVIDADE,
  type PainelDoAgente,
  type RodadaNoPainel,
} from "@/lib/agentes/painel";
import { Alerta, BotaoLink, EstadoVazio, Segmentado, Selo, classeBotao, type Tom } from "@/components/ui";
import {
  AvatarAgente,
  ESTADOS,
  Esqueleto,
  Gaveta,
  LuzStatus,
  TIPOS_FALA,
  chamarApi,
  cx,
  dolar,
  haQuanto,
  numero,
  quandoVai,
  rotuloSetor,
} from "./comum";
import { FichaAgente } from "./gaveta-agente";
import { AprendizadoCard } from "@/components/gestor/aprendizado-card";
import { PropostasAgentes } from "./propostas";

const INTERVALO_MS = 20_000;

/* ------------------------------------------------------------ leitura */

/** Resposta parcial não derruba o painel: o que faltar vira vazio. */
function normalizar(d: Partial<PainelDoAgente> | null): PainelDoAgente {
  return {
    atividade: Array.isArray(d?.atividade) ? d.atividade : [],
    achados: {
      abertos: d?.achados?.abertos ?? 0,
      resolvidos30d: d?.achados?.resolvidos30d ?? 0,
      lista: Array.isArray(d?.achados?.lista) ? d.achados.lista : [],
    },
    resumoHoje: {
      rodadas: d?.resumoHoje?.rodadas ?? 0,
      achadosNovos: d?.resumoHoje?.achadosNovos ?? 0,
      custoUsd: d?.resumoHoje?.custoUsd ?? 0,
    },
  };
}

/**
 * Lê o painel do agente `id` e relê a cada 20 s com a aba visível (e na hora
 * em que a pessoa volta para a aba). O resultado fica marcado com o id: ao
 * trocar de agente, o painel do anterior não aparece nem por um instante, e
 * resposta atrasada de um pedido velho é jogada fora.
 */
function usePainel(id: string) {
  const [estado, setEstado] = useState<{ id: string; dados: PainelDoAgente | null; erro: string | null } | null>(null);
  const pedido = useRef(0);

  const recarregar = useCallback(async () => {
    const meu = ++pedido.current;
    try {
      const dados = await chamarApi<PainelDoAgente>(`/api/gestor/agentes/${encodeURIComponent(id)}`);
      if (meu !== pedido.current) return;
      setEstado({ id, dados: normalizar(dados), erro: null });
    } catch (e) {
      if (meu !== pedido.current) return;
      const erro = e instanceof Error ? e.message : "Não consegui carregar o painel deste agente.";
      // Falha momentânea não apaga o que já estava na tela.
      setEstado((antes) => ({ id, dados: antes?.id === id ? antes.dados : null, erro }));
    }
  }, [id]);

  useEffect(() => {
    void recarregar();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void recarregar();
    }, INTERVALO_MS);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void recarregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [recarregar]);

  const atual = estado?.id === id ? estado : null;
  return { dados: atual?.dados ?? null, erro: atual?.erro ?? null, carregando: !atual, recarregar };
}

/* -------------------------------------------------------------- painel */

type Aba = "atividade" | "aprovar" | "achados" | "ficha";

const ABAS: Array<{ id: Aba; rotulo: string; icone: typeof History }> = [
  { id: "atividade", rotulo: "Atividade", icone: History },
  { id: "aprovar", rotulo: "Para aprovar", icone: ListChecks },
  { id: "achados", rotulo: "O que encontrou", icone: Radar },
  { id: "ficha", rotulo: "Ficha e ajustes", icone: SlidersHorizontal },
];

/*
 * PARA APROVAR (pedido do Elton, 27/11/2026: "quando o robô fala que tem um
 * relatório, quero clicar nele e ali ter as aprovações para aprovar direto no
 * agente"). A aba só aparece para quem deixou decisão para o gestor:
 *   - aprendizados: agente com achado aberto que leva para a revisão do
 *     aprendizado (hoje, o Revisor do Aprendizado) — a mesma lista do
 *     Gestor › Aprendizado, com aprovar, recusar e ajustar o texto;
 *   - propostas: a Diretora, quando propôs agente novo e ainda não teve resposta.
 * Clicar no balão do agente no escritório abre o painel direto aqui.
 */
type Aprovacao = "aprendizado" | "propostas";

function aprovacaoDoAgente(mesa: MesaAgente, dados: PainelDoAgente | null, propostasPendentes: number): Aprovacao | null {
  // A Diretora é a única agente da Diretoria.
  if (mesa.setor === "direcao" && propostasPendentes > 0) return "propostas";
  const leva = dados?.achados.lista.some((a) => a.status === "pendente" && a.acaoUrl?.includes("aba=aprendizado"));
  return leva ? "aprendizado" : null;
}

export interface PropsPainelAgente {
  mesa: MesaAgente | null;
  /** Todas as mesas: dão o ícone de quem aparece na linha do tempo. */
  mesas?: MesaAgente[];
  /** Falas do escritório (a ficha mostra as últimas do agente). */
  falas: FalaEscritorio[];
  equipeAtiva: boolean;
  souMestre: boolean;
  aoFechar: () => void;
  aoMudar: () => void | Promise<void>;
  /** Clicar em outro agente na linha do tempo troca o painel para ele. */
  aoAbrirAgente?: (id: string) => void;
  /**
   * "relatorio" = abriu pelo balão de fala no escritório: vai direto para
   * "Para aprovar" quando o agente tem algo esperando decisão.
   */
  abaInicial?: "relatorio";
  /** Propostas de agente novo esperando resposta (aba "Para aprovar" da Diretora). */
  propostasPendentes?: number;
}

export function PainelAgente(props: PropsPainelAgente) {
  if (!props.mesa) return null;
  return <PainelAberto key={props.abaInicial ?? "normal"} {...props} mesa={props.mesa} />;
}

function PainelAberto({
  mesa,
  mesas,
  falas,
  equipeAtiva,
  souMestre,
  aoFechar,
  aoMudar,
  aoAbrirAgente,
  abaInicial,
  propostasPendentes = 0,
}: PropsPainelAgente & { mesa: MesaAgente }) {
  const [abaEscolhida, setAba] = useState<Aba>("atividade");
  const { dados, erro, carregando, recarregar } = usePainel(mesa.id);
  const estado = ESTADOS[mesa.estado] ?? ESTADOS.ocioso;
  const botoes = useRef<Array<HTMLButtonElement | null>>([]);

  const aprovacao = aprovacaoDoAgente(mesa, dados, propostasPendentes);
  const abas = aprovacao ? ABAS : ABAS.filter((a) => a.id !== "aprovar");
  // Aprovou tudo e a aba sumiu: volta para a Atividade.
  const aba: Aba = abaEscolhida === "aprovar" && !aprovacao && dados ? "atividade" : abaEscolhida;

  // Aberto pelo balão: assim que se sabe se há o que aprovar, vai para lá (uma vez por agente).
  const jaLevou = useRef<string | null>(null);
  useEffect(() => {
    if (abaInicial !== "relatorio" || jaLevou.current === mesa.id) return;
    if (aprovacao) {
      jaLevou.current = mesa.id;
      setAba("aprovar");
    } else if (dados) {
      jaLevou.current = mesa.id;
      setAba("atividade");
    }
  }, [abaInicial, aprovacao, dados, mesa.id]);

  // Ligou, desligou ou mandou rodar: relê o escritório E o painel.
  const mudar = useCallback(async () => {
    await aoMudar();
    void recarregar();
  }, [aoMudar, recarregar]);

  const iconePorId = useMemo(() => new Map((mesas ?? []).map((m) => [m.id, m.icone])), [mesas]);

  // Setas trocam de aba (padrão de abas acessíveis).
  const aoTeclarAba = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const proximo = (i + (e.key === "ArrowRight" ? 1 : abas.length - 1)) % abas.length;
    setAba(abas[proximo].id);
    botoes.current[proximo]?.focus();
  };

  const faixa = (
    <div>
      {mesa.fazendoAgora && (
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-aura-sunken px-3 py-2 text-[0.8125rem] leading-relaxed text-aura-graphite">
          <LuzStatus estado={mesa.estado} className="mt-1.5 !h-2 !w-2" />
          <span className="min-w-0">
            <span className="font-medium">{estado.rotulo}</span>
            <span className="text-aura-graphite-soft"> · </span>
            {mesa.fazendoAgora}
          </span>
        </p>
      )}
      <div role="tablist" aria-label="Seções do painel do agente" className="-mb-px flex gap-5 overflow-x-auto">
        {abas.map((a, i) => {
          const ativa = aba === a.id;
          const Icone = a.icone;
          return (
            <button
              key={a.id}
              ref={(el) => {
                botoes.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`aba-agente-${a.id}`}
              aria-selected={ativa}
              aria-controls={`painel-agente-${a.id}`}
              tabIndex={ativa ? 0 : -1}
              onClick={() => setAba(a.id)}
              onKeyDown={(e) => aoTeclarAba(e, i)}
              className={cx(
                "flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 pt-0.5 text-[0.8125rem] font-medium transition",
                ativa
                  ? "border-aura-petrol-500 text-aura-graphite"
                  : "border-transparent text-aura-graphite-soft hover:text-aura-graphite",
              )}
            >
              <Icone size={13} aria-hidden />
              {a.rotulo}
              {a.id === "aprovar" && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-aura-gold-700" />}
              {a.id === "achados" && dados && dados.achados.abertos > 0 && (
                <span className="rounded-full bg-aura-sunken px-1.5 text-[0.6875rem] tabular-nums text-aura-graphite-soft">
                  {numero(dados.achados.abertos)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <Gaveta
      aberto
      larga
      aoFechar={aoFechar}
      rotulo={`Painel do agente ${mesa.nome}`}
      titulo={mesa.nome}
      subtitulo={`${mesa.cargo} · ${rotuloSetor(mesa.setor)}`}
      icone={<AvatarAgente icone={mesa.icone} tamanho="lg" destaque={mesa.setor === "direcao"} apagado={!mesa.ativo} />}
      faixa={faixa}
    >
      <div role="tabpanel" id={`painel-agente-${aba}`} aria-labelledby={`aba-agente-${aba}`}>
        {aba === "atividade" && (
          <AbaAtividade
            mesa={mesa}
            dados={dados}
            erro={erro}
            carregando={carregando}
            iconePorId={iconePorId}
            aoAbrirAgente={aoAbrirAgente}
          />
        )}
        {aba === "aprovar" && aprovacao && (
          <div className="space-y-3">
            <p className="text-[0.8125rem] leading-relaxed text-aura-graphite-soft">
              {aprovacao === "propostas"
                ? "A Diretora propôs agentes novos e espera a sua resposta."
                : `O que ${mesa.nome} não teve certeza e deixou para você decidir. Aprovar, recusar ou ajustar aqui vale na hora.`}
            </p>
            {aprovacao === "propostas" ? <PropostasAgentes /> : <AprendizadoCard />}
          </div>
        )}
        {aba === "achados" && (
          <AbaAchados
            dados={dados}
            erro={erro}
            carregando={carregando}
            aoAprovarAqui={aprovacao === "aprendizado" ? () => setAba("aprovar") : undefined}
          />
        )}
        {aba === "ficha" && (
          <FichaAgente
            mesa={mesa}
            falas={falas}
            equipeAtiva={equipeAtiva}
            souMestre={souMestre}
            aoMudar={mudar}
            semFazendoAgora
          />
        )}
      </div>
    </Gaveta>
  );
}

/* ----------------------------------------------------------- formatos */

/** "14:20" no horário de Brasília (o agrupamento por dia também é de lá). */
function horaSP(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

const plural = (n: number, um: string, varios: string) => `${numero(n)} ${n === 1 ? um : varios}`;

/** Sem dados por causa de erro (409 da migração, queda): explica e segue. */
function AvisoSemDados({ erro }: { erro: string }) {
  return <Alerta tom="atencao" titulo="Não deu para mostrar agora" descricao={erro} />;
}

function EsqueletoLista() {
  return (
    <div className="space-y-4" aria-busy="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-2.5">
          <Esqueleto className="h-7 w-7 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Esqueleto className="h-3 w-1/2" />
            <Esqueleto className="h-10 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ atividade */

function AbaAtividade({
  mesa,
  dados,
  erro,
  carregando,
  iconePorId,
  aoAbrirAgente,
}: {
  mesa: MesaAgente;
  dados: PainelDoAgente | null;
  erro: string | null;
  carregando: boolean;
  iconePorId: Map<string, string>;
  aoAbrirAgente?: (id: string) => void;
}) {
  const dias = useMemo(() => agruparPorDia(dados?.atividade ?? []), [dados]);

  if (!dados) return carregando ? <EsqueletoLista /> : <AvisoSemDados erro={erro ?? "Tente de novo em instantes."} />;

  const hoje = dados.resumoHoje;
  return (
    <div className="space-y-5">
      {erro && <p className="text-xs text-aura-graphite-soft">Não consegui atualizar agora; mostrando a última leitura.</p>}

      <dl className="grid grid-cols-3 gap-2" aria-label="Resumo de hoje">
        {[
          { rotulo: "Rodadas hoje", valor: numero(hoje.rodadas) },
          { rotulo: "Achados novos", valor: numero(hoje.achadosNovos) },
          { rotulo: "Gasto de IA hoje", valor: dolar(hoje.custoUsd) },
        ].map((c) => (
          <div key={c.rotulo} className="rounded-lg border border-aura-mist px-3 py-2">
            <dt className="text-[0.6875rem] text-aura-graphite-soft">{c.rotulo}</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-aura-graphite">{c.valor}</dd>
          </div>
        ))}
      </dl>

      {dias.length === 0 ? (
        <EstadoVazio
          icone={History}
          titulo="Nada por aqui ainda"
          descricao={
            !mesa.ativo
              ? "Este agente está desligado. Quando for ligado, o que ele fizer e falar aparece aqui."
              : `Roda ${mesa.agendaTexto ? mesa.agendaTexto.charAt(0).toLowerCase() + mesa.agendaTexto.slice(1) : "pela agenda dele"}. Próxima rodada: ${quandoVai(mesa.proximaExecucao)}. O que ele fizer e falar aparece aqui.`
          }
          className="py-8"
        />
      ) : (
        <div className="space-y-5">
          {dias.map((d) => (
            <section key={d.dia} aria-label={d.rotulo}>
              <h4 className="aura-rotulo mb-2 flex items-center gap-2">
                {d.rotulo}
                <span className="h-px flex-1 bg-aura-mist" aria-hidden />
              </h4>
              <ol className="space-y-1">
                {d.itens.map((item) =>
                  item.tipo === "rodada" ? (
                    <Rodada key={`r:${item.id}`} rodada={item} />
                  ) : (
                    <Fala
                      key={`f:${item.id}`}
                      fala={item}
                      agenteDoPainel={mesa.id}
                      iconePorId={iconePorId}
                      aoAbrirAgente={aoAbrirAgente}
                    />
                  ),
                )}
              </ol>
            </section>
          ))}
          {dados.atividade.length >= LIMITE_ATIVIDADE && (
            <p className="text-center text-xs text-aura-graphite-soft">Mostrando as {LIMITE_ATIVIDADE} atividades mais recentes.</p>
          )}
        </div>
      )}
    </div>
  );
}

function Fala({
  fala,
  agenteDoPainel,
  iconePorId,
  aoAbrirAgente,
}: {
  fala: FalaNoPainel;
  agenteDoPainel: string;
  iconePorId: Map<string, string>;
  aoAbrirAgente?: (id: string) => void;
}) {
  const t = TIPOS_FALA[fala.tipoFala] ?? TIPOS_FALA.relato;
  const recebeu = fala.direcao === "recebeu";
  const podeAbrir = fala.de.quem === "agente" && fala.de.id !== agenteDoPainel && aoAbrirAgente;
  const avatar =
    fala.de.quem === "pessoa" ? (
      // Uma pessoa (o gestor), não um agente: não tem painel para abrir.
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-aura-petrol-500/25 bg-aura-petrol-500/10 text-aura-petrol-600"
        title="Gestor"
        aria-hidden
      >
        <UserRound size={14} />
      </span>
    ) : (
      <AvatarAgente icone={iconePorId.get(fala.de.id)} tamanho="sm" destaque={fala.tipoFala === "plano"} />
    );

  return (
    <li className={cx("flex gap-2.5 rounded-lg px-1.5 py-2", recebeu && "bg-aura-sunken/50")}>
      {podeAbrir ? (
        <button type="button" onClick={() => aoAbrirAgente?.(fala.de.id)} className="shrink-0 self-start rounded-md" aria-label={`Abrir ${fala.de.nome}`}>
          {avatar}
        </button>
      ) : (
        <span className="shrink-0 self-start">{avatar}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
          <span className="font-medium text-aura-graphite">{fala.de.nome}</span>
          <ArrowRight size={11} className="text-aura-graphite-soft" aria-label="para" />
          <Destino parte={fala.para} agenteDoPainel={agenteDoPainel} aoAbrirAgente={aoAbrirAgente} />
          <Selo tom={t.tom} className="!px-1.5 !py-0 text-[0.625rem]">
            {t.rotulo}
          </Selo>
          {recebeu && <span className="text-[0.6875rem] text-aura-graphite-soft">recebida</span>}
          <time className="ml-auto shrink-0 text-[0.6875rem] tabular-nums text-aura-graphite-soft" dateTime={fala.em}>
            {horaSP(fala.em)}
          </time>
        </div>
        <p className="mt-0.5 whitespace-pre-line break-words text-[0.8125rem] leading-relaxed text-aura-graphite">{fala.texto}</p>
        {fala.empresa && <p className="mt-1 text-[0.6875rem] text-aura-graphite-soft">{fala.empresa}</p>}
      </div>
    </li>
  );
}

function Destino({
  parte,
  agenteDoPainel,
  aoAbrirAgente,
}: {
  parte: FalaNoPainel["para"];
  agenteDoPainel: string;
  aoAbrirAgente?: (id: string) => void;
}) {
  if (parte.quem === "mural") {
    return (
      <span className="inline-flex items-center gap-1 text-aura-graphite-soft">
        <Users size={11} aria-hidden />
        Mural
      </span>
    );
  }
  if (parte.quem === "agente" && parte.id !== agenteDoPainel && aoAbrirAgente) {
    return (
      <button type="button" onClick={() => aoAbrirAgente(parte.id)} className="text-aura-graphite-soft underline-offset-2 hover:text-aura-graphite hover:underline">
        {parte.nome}
      </button>
    );
  }
  return <span className="text-aura-graphite-soft">{parte.nome}</span>;
}

function Rodada({ rodada }: { rodada: RodadaNoPainel }) {
  const hora = horaSP(rodada.em);
  const titulo =
    rodada.status === "rodando" ? `Rodando desde ${hora}` : rodada.status === "erro" ? `Falhou às ${hora}` : `Rodou às ${hora}`;
  const partes = [
    titulo,
    rodada.status !== "rodando" ? plural(rodada.achados, "achado", "achados") : null,
    rodada.custoUsd > 0 ? dolar(rodada.custoUsd) : null,
    textoDuracao(rodada.duracaoMs) ? `levou ${textoDuracao(rodada.duracaoMs)}` : null,
  ].filter(Boolean);
  // O erro já aparece embaixo, em vermelho: o resumo "Falhou: …" repetiria.
  const resumo = rodada.resumo && !(rodada.erro && rodada.resumo.includes(rodada.erro)) ? rodada.resumo : "";

  return (
    <li className="flex gap-2.5 rounded-lg px-1.5 py-2">
      <span
        className={cx(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
          rodada.status === "erro"
            ? "border-aura-danger/25 bg-aura-danger/10 text-aura-danger"
            : rodada.status === "rodando"
              ? "border-aura-success/25 bg-aura-success/10 text-aura-success"
              : "border-aura-mist bg-aura-sunken text-aura-graphite-soft",
        )}
        aria-hidden
      >
        {rodada.status === "rodando" ? (
          <Loader2 size={13} className="motion-safe:animate-spin" />
        ) : rodada.status === "erro" ? (
          <CircleAlert size={13} />
        ) : (
          <CheckCircle2 size={13} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-aura-graphite-soft">
          <span className="font-medium text-aura-graphite">{partes[0]}</span>
          {partes.slice(1).map((p) => (
            <span key={p as string}> · {p}</span>
          ))}
        </p>
        {resumo && <p className="mt-0.5 break-words text-[0.8125rem] leading-relaxed text-aura-graphite">{resumo}</p>}
        {rodada.erro && <p className="mt-0.5 break-words text-xs text-aura-danger">{rodada.erro}</p>}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------- achados */

const PRIORIDADE: Record<string, { rotulo: string; tom: Tom }> = {
  urgente: { rotulo: "Urgente", tom: "perigo" },
  alta: { rotulo: "Alta", tom: "atencao" },
  media: { rotulo: "Média", tom: "marca" },
  baixa: { rotulo: "Baixa", tom: "neutro" },
};

const SITUACAO: Record<string, { rotulo: string; tom: Tom }> = {
  pendente: { rotulo: "Aberto", tom: "atencao" },
  concluida: { rotulo: "Resolvido", tom: "sucesso" },
  resolvida_sozinha: { rotulo: "Resolveu sozinho", tom: "sucesso" },
  dispensada: { rotulo: "Dispensado", tom: "neutro" },
  expirada: { rotulo: "Expirou", tom: "neutro" },
};

function AbaAchados({
  dados,
  erro,
  carregando,
  aoAprovarAqui,
}: {
  dados: PainelDoAgente | null;
  erro: string | null;
  carregando: boolean;
  /** Há aprovação de aprendizado neste painel: o achado ganha "Aprovar aqui". */
  aoAprovarAqui?: () => void;
}) {
  const [filtro, setFiltro] = useState<FiltroAchados>("abertos");
  const visiveis = useMemo(() => filtrarAchados(dados?.achados.lista ?? [], filtro), [dados, filtro]);

  if (!dados) return carregando ? <EsqueletoLista /> : <AvisoSemDados erro={erro ?? "Tente de novo em instantes."} />;

  const { abertos, resolvidos30d, lista } = dados.achados;
  const abertosNaLista = filtrarAchados(lista, "abertos").length;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-aura-mist px-3 py-2.5">
          <dt className="text-xs text-aura-graphite-soft">Abertos agora</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-aura-graphite">{numero(abertos)}</dd>
        </div>
        <div className="rounded-lg border border-aura-mist px-3 py-2.5">
          <dt className="text-xs text-aura-graphite-soft">Resolvidos em 30 dias</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-aura-success">{numero(resolvidos30d)}</dd>
        </div>
      </dl>

      <Segmentado
        opcoes={[
          { valor: "abertos", rotulo: "Abertos" },
          { valor: "resolvidos", rotulo: "Resolvidos" },
          { valor: "todos", rotulo: "Todos" },
        ]}
        valor={filtro}
        aoMudar={setFiltro}
        rotulo="Filtrar achados"
        className="w-full"
      />

      {visiveis.length === 0 ? (
        <EstadoVazio
          icone={Inbox}
          titulo={
            lista.length === 0
              ? "Ainda não encontrou nada"
              : filtro === "abertos"
                ? "Nada aberto"
                : filtro === "resolvidos"
                  ? "Nada resolvido por aqui"
                  : "Nada por aqui"
          }
          descricao={
            lista.length === 0
              ? "Quando este agente achar algo que precisa de alguém, vira um item aqui e na lista da pessoa."
              : "Troque o filtro para ver os outros."
          }
          className="py-8"
        />
      ) : (
        <ul className="space-y-2.5">
          {visiveis.map((a) => (
            <Achado key={a.id} achado={a} aoAprovarAqui={aoAprovarAqui} />
          ))}
        </ul>
      )}

      {filtro === "abertos" && abertos > abertosNaLista && abertosNaLista > 0 && (
        <p className="text-center text-xs text-aura-graphite-soft">
          Mostrando os {numero(abertosNaLista)} mais recentes de {numero(abertos)} abertos.
        </p>
      )}
    </div>
  );
}

function Achado({ achado, aoAprovarAqui }: { achado: AchadoNoPainel; aoAprovarAqui?: () => void }) {
  const p = PRIORIDADE[achado.prioridade] ?? PRIORIDADE.media;
  const s = SITUACAO[achado.status] ?? { rotulo: achado.status, tom: "neutro" as Tom };
  const aberto = achado.status === "pendente";
  const aprovaAqui = Boolean(aoAprovarAqui && aberto && achado.acaoUrl?.includes("aba=aprendizado"));
  return (
    <li className="rounded-lg border border-aura-mist p-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs text-aura-graphite-soft">
        <Selo tom={p.tom} className="!px-1.5 !py-0 text-[0.625rem]">
          {p.rotulo}
        </Selo>
        <Selo tom={s.tom} className="!px-1.5 !py-0 text-[0.625rem]">
          {s.rotulo}
        </Selo>
        {achado.empresa && <span>{achado.empresa}</span>}
        <time className="ml-auto shrink-0" dateTime={achado.criadoEm} title={`Criado ${haQuanto(achado.criadoEm)}`}>
          {aberto || !achado.atualizadoEm ? haQuanto(achado.criadoEm) : haQuanto(achado.atualizadoEm)}
        </time>
      </div>
      <p className="text-sm font-medium leading-snug text-aura-graphite">{achado.titulo}</p>
      {achado.descricao && <p className="mt-1 break-words text-xs leading-relaxed text-aura-graphite-soft">{achado.descricao}</p>}
      {(achado.destinatarioNome || achado.acaoUrl) && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-aura-graphite-soft">
            {achado.destinatarioNome ? (
              <>
                para <span className="font-medium text-aura-graphite">{achado.destinatarioNome}</span>
              </>
            ) : null}
          </span>
          {aprovaAqui ? (
            <button type="button" onClick={aoAprovarAqui} className={classeBotao("primario", "sm")}>
              <ListChecks size={13} aria-hidden />
              Aprovar aqui
            </button>
          ) : (
            achado.acaoUrl && (
              <BotaoLink href={achado.acaoUrl} tamanho="sm" variante="secundario" icone={ArrowUpRight}>
                Abrir
              </BotaoLink>
            )
          )}
        </div>
      )}
    </li>
  );
}
