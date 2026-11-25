"use client";

/**
 * ESCRITÓRIO VIRTUAL da equipe de agentes.
 *
 * Em cima, a faixa da Diretora: o plano do dia que ela escreveu, os números
 * da equipe e o botão "Conversar com a Diretora" (o gestor manda ideias de
 * melhoria direto para ela — conversa-diretora.tsx).
 *
 * No centro, o ESCRITÓRIO EM PIXEL (escritorio-pixel/): um escritoriozinho
 * visto de cima, com uma sala por setor (Diretoria, Sala de Vendas,
 * Pós-venda, Marketing, Gestão, Conhecimento, Dados e a Copa), cada agente
 * sentado na sua mesa com crachá e balão de fala. Clicar abre o painel
 * do agente (painel-agente.tsx): o que ele fez e falou, o que encontrou e a ficha.
 * "Ver como lista" volta para a grade de cartões de antes (nada se perdeu).
 *
 * Ao lado (embaixo no celular), o Mural da equipe: a conversa dos agentes,
 * com as ideias do gestor e as respostas da Diretora.
 *
 * Enquanto a migração 110 não estiver no banco a rota responde ativo=false:
 * a equipe inteira aparece "aguardando ativação", com um aviso claro, e o
 * resto da tela fica vazio sem quebrar.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Crown,
  DatabaseZap,
  LayoutGrid,
  Map as MapaIcone,
  Maximize2,
  MessageCircle,
  Minus,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
  Scan,
  X,
} from "lucide-react";
import type { MesaAgente } from "@/lib/agentes/tipos";
import { Alerta, Botao, Card, EstadoVazio, Selo, StatCard } from "@/components/ui";
import { usarMeuAcesso } from "@/lib/usar-permissoes";
import {
  AvatarAgente,
  BarraOrcamento,
  ESTADOS,
  Esqueleto,
  LuzStatus,
  SETORES,
  acharDiretora,
  cx,
  dolar,
  haQuanto,
  numero,
  useEscritorio,
} from "./comum";
import { ConversaEquipe } from "./conversa";
import { ConversaDiretora } from "./conversa-diretora";
import { EscritorioPixel } from "./escritorio-pixel";
import { Mesa } from "./mesa";
import { PainelAgente } from "./painel-agente";

export function Escritorio() {
  const { estado, erro, carregando, recarregar } = useEscritorio({ vivo: true });
  const acesso = usarMeuAcesso();
  const souMestre = acesso.gestorMestre && acesso.gestorAprovado;
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [vista, setVista] = useState<"planta" | "lista">("planta");
  const [conversaAberta, setConversaAberta] = useState(false);
  const fecharConversa = useCallback(() => setConversaAberta(false), []);

  /*
   * TELA CHEIA (pedido do Elton, 25/11: "ficou ruim de ver, usa mais a tela"):
   * a planta ocupa a tela inteira, com zoom (−, ajustar, +) e o mural como um
   * painel lateral que abre e fecha. Esc fecha. null no zoom = ajustar à largura.
   */
  const [telaCheia, setTelaCheia] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [muralNaTela, setMuralNaTela] = useState(true);
  useEffect(() => {
    if (!telaCheia) return;
    const aoTeclar = (e: KeyboardEvent) => {
      // Com a ficha ou a conversa aberta, o Esc fecha elas primeiro.
      if (e.key === "Escape" && !abertoId && !conversaAberta) setTelaCheia(false);
    };
    document.addEventListener("keydown", aoTeclar);
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAntes;
    };
  }, [telaCheia, abertoId, conversaAberta]);
  const ampliar = (passo: number) =>
    setZoom((z) => Math.min(6, Math.max(1, Math.round(((z ?? 2) + passo) * 2) / 2)));

  const mesas = useMemo(() => estado?.mesas ?? [], [estado]);
  const falas = estado?.falas ?? [];
  const equipeAtiva = Boolean(estado?.ativo);
  const diretora = acharDiretora(mesas);
  const aberta = mesas.find((m) => m.id === abertoId) ?? null;

  const salas = useMemo(
    () =>
      SETORES.map((s) => ({ ...s, mesas: mesas.filter((m) => m.setor === s.id && m.id !== diretora?.id) })).filter(
        (s) => s.mesas.length > 0,
      ),
    [mesas, diretora],
  );
  // Agente com setor que a tela não conhece ainda: não some, vai para "Outros".
  const semSala = mesas.filter((m) => m.id !== diretora?.id && !SETORES.some((s) => s.id === m.setor));

  if (carregando && !estado) return <EsqueletoEscritorio />;

  if (!estado) {
    return (
      <Alerta
        tom="perigo"
        titulo="Não consegui abrir o escritório"
        descricao={erro ?? "Tente de novo em instantes."}
        acao={
          <Botao tamanho="sm" icone={RefreshCw} onClick={() => void recarregar()}>
            Tentar de novo
          </Botao>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {!equipeAtiva && <AvisoAtivacao motivo={estado.motivoInativo} />}
      {erro && (
        <Alerta tom="atencao" titulo="A última atualização falhou" descricao={`${erro} Mostrando o que veio antes.`} />
      )}

      <SalaDaDiretora
        diretora={diretora}
        mesas={mesas}
        plano={estado.planoDoDia}
        custo30d={estado.custo30dUsd}
        aoAbrir={setAbertoId}
        aoConversar={() => setConversaAberta(true)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-aura-graphite">
          {vista === "planta" ? "O escritório agora" : "A equipe por sala"}
        </h2>
        <span className="hidden text-xs text-aura-graphite-soft sm:inline">
          · {vista === "planta" ? "passe o mouse em um agente para ver o que ele está fazendo" : "uma sala por setor, um cartão por agente"}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {vista === "planta" && mesas.length > 0 && (
            <Botao
              tamanho="sm"
              variante="primario"
              icone={Maximize2}
              className="hidden sm:inline-flex"
              onClick={() => {
                setZoom(null);
                setTelaCheia(true);
              }}
            >
              Tela cheia
            </Botao>
          )}
          <Botao
            tamanho="sm"
            variante="fantasma"
            icone={vista === "planta" ? LayoutGrid : MapaIcone}
            onClick={() => setVista((v) => (v === "planta" ? "lista" : "planta"))}
            aria-pressed={vista === "lista"}
          >
            {vista === "planta" ? "Ver como lista" : "Ver o escritório"}
          </Botao>
        </div>
      </div>

      {/*
        A planta ocupa a largura toda; o mural vem logo abaixo. Antes os dois
        dividiam a linha e o escritório ficava pequeno demais para ler.
      */}
      <div className="space-y-6">
        <section aria-label="Planta do escritório" className="min-w-0">
          {mesas.length > 0 && vista === "planta" ? (
            <EscritorioPixel
              mesas={mesas}
              falas={falas}
              diretoraId={diretora?.id ?? null}
              abertoId={abertoId}
              aoAbrir={setAbertoId}
            />
          ) : mesas.length === 0 ? (
            <EstadoVazio
              icone={Bot}
              titulo="Nenhum agente na equipe ainda"
              descricao="Quando o servidor listar os agentes, cada um ganha uma mesa aqui."
            />
          ) : (
            <div className="grid grid-flow-row-dense gap-4 md:grid-cols-2">
              {salas.map((sala) => (
                <Sala
                  key={sala.id}
                  rotulo={sala.rotulo}
                  descricao={sala.descricao}
                  icone={sala.icone}
                  mesas={sala.mesas}
                  aoAbrir={setAbertoId}
                />
              ))}
              {semSala.length > 0 && (
                <Sala rotulo="Outros" descricao="Setor ainda sem sala própria" icone={Bot} mesas={semSala} aoAbrir={setAbertoId} />
              )}
            </div>
          )}
        </section>

        <ConversaEquipe
          falas={falas}
          mesas={mesas}
          carregando={carregando}
          equipeAtiva={equipeAtiva}
          aoAbrirAgente={setAbertoId}
        />
      </div>

      {telaCheia && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Escritório em tela cheia"
          className="fixed inset-0 z-40 flex flex-col bg-aura-bg"
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-aura-mist bg-aura-surface px-4 py-2.5">
            <h2 className="text-sm font-semibold text-aura-graphite">O escritório agora</h2>
            <span className="hidden text-xs text-aura-graphite-soft md:inline">
              · clique num agente para ver a ficha · Esc para sair
            </span>
            <div className="ml-auto flex items-center gap-1">
              <Botao tamanho="sm" variante="secundario" icone={Minus} aria-label="Diminuir" onClick={() => ampliar(-0.5)} disabled={zoom === 1} />
              <Botao tamanho="sm" variante={zoom === null ? "primario" : "secundario"} icone={Scan} onClick={() => setZoom(null)}>
                Ajustar
              </Botao>
              <Botao tamanho="sm" variante="secundario" icone={Plus} aria-label="Aumentar" onClick={() => ampliar(0.5)} disabled={zoom === 6} />
              <span className="mx-1 h-5 w-px bg-aura-mist" aria-hidden />
              <Botao tamanho="sm" variante="secundario" icone={MessageCircle} onClick={() => setConversaAberta(true)}>
                Diretora
              </Botao>
              <Botao
                tamanho="sm"
                variante="secundario"
                icone={muralNaTela ? PanelRightClose : PanelRightOpen}
                onClick={() => setMuralNaTela((v) => !v)}
                aria-pressed={muralNaTela}
              >
                Mural
              </Botao>
              <Botao tamanho="sm" variante="fantasma" icone={X} aria-label="Sair da tela cheia" onClick={() => setTelaCheia(false)} />
            </div>
          </div>
          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1 overflow-auto p-4">
              <EscritorioPixel
                mesas={mesas}
                falas={falas}
                diretoraId={diretora?.id ?? null}
                abertoId={abertoId}
                aoAbrir={setAbertoId}
                zoom={zoom}
              />
            </div>
            {muralNaTela && (
              <aside className="hidden w-[24rem] shrink-0 overflow-y-auto border-l border-aura-mist bg-aura-surface p-4 lg:block">
                <ConversaEquipe
                  falas={falas}
                  mesas={mesas}
                  carregando={carregando}
                  equipeAtiva={equipeAtiva}
                  aoAbrirAgente={setAbertoId}
                />
              </aside>
            )}
          </div>
        </div>
      )}

      {/* Por cima de tudo (z-50), inclusive da tela cheia (z-40). */}
      <PainelAgente
        mesa={aberta}
        mesas={mesas}
        falas={falas}
        equipeAtiva={equipeAtiva}
        souMestre={souMestre}
        aoFechar={() => setAbertoId(null)}
        aoMudar={recarregar}
        aoAbrirAgente={setAbertoId}
      />

      {conversaAberta && (
        <ConversaDiretora
          diretora={diretora}
          equipeAtiva={equipeAtiva}
          aoFechar={fecharConversa}
          aoAbrirAgente={setAbertoId}
          aoMudar={recarregar}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ peças */

function AvisoAtivacao({ motivo }: { motivo?: string }) {
  return (
    <Alerta
      tom="atencao"
      icone={DatabaseZap}
      titulo="A equipe de agentes está montada, mas ainda não foi ativada"
      descricao={
        <>
          Falta um passo no banco de dados (migração 110), que só roda com a autorização do dono do sistema. Até lá
          os agentes ficam “aguardando ativação”: ninguém trabalha, nada é gravado e nenhum custo de IA acontece.
          {motivo ? <span className="mt-1 block">Detalhe do servidor: {motivo}</span> : null}
        </>
      }
    />
  );
}

function SalaDaDiretora({
  diretora,
  mesas,
  plano,
  custo30d,
  aoAbrir,
  aoConversar,
}: {
  diretora: MesaAgente | null;
  mesas: MesaAgente[];
  plano: { texto: string; criadoEm: string } | null;
  custo30d: number;
  aoAbrir: (id: string) => void;
  aoConversar: () => void;
}) {
  const ativos = mesas.filter((m) => m.ativo).length;
  const trabalhando = mesas.filter((m) => m.estado === "trabalhando").length;
  const comErro = mesas.filter((m) => m.estado === "com_erro").length;
  const achados = mesas.reduce((s, m) => s + (m.achadosAbertos || 0), 0);
  const orcamento = mesas.filter((m) => m.ativo).reduce((s, m) => s + (m.orcamentoMensalUsd || 0), 0);
  const estado = diretora ? ESTADOS[diretora.estado] ?? ESTADOS.ocioso : null;

  return (
    <Card className="relative overflow-hidden">
      {/* Um brilho dourado bem leve marca a sala da chefe, sem pintar o cartão. */}
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-aura-gold/10 blur-3xl"
        aria-hidden
      />
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => diretora && aoAbrir(diretora.id)}
              disabled={!diretora}
              className="rounded-xl"
              aria-label={diretora ? `Abrir ficha de ${diretora.nome}` : undefined}
            >
              <AvatarAgente icone={diretora?.icone ?? "Crown"} tamanho="lg" destaque apagado={diretora ? !diretora.ativo : false} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="aura-rotulo flex items-center gap-1.5">
                <Crown size={11} className="text-aura-gold-700" aria-hidden />
                Sala da Diretora
              </p>
              <h2 className="mt-0.5 truncate font-display text-lg font-semibold text-aura-graphite">
                {diretora?.nome ?? "AURA Diretora"}
              </h2>
              {diretora && estado && (
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-aura-graphite-soft">
                  <LuzStatus estado={diretora.estado} className="!h-2 !w-2" />
                  {estado.rotulo}
                  {diretora.ultimaExecucao && <span>· rodou {haQuanto(diretora.ultimaExecucao.fim ?? diretora.ultimaExecucao.inicio)}</span>}
                </p>
              )}
            </div>
          </div>

          <Botao variante="primario" icone={MessageCircle} onClick={aoConversar} className="mt-4 w-full sm:w-auto">
            Conversar com a Diretora
          </Botao>

          <div className="mt-4 rounded-lg border border-aura-mist bg-aura-bg/60 p-3.5">
            <div className="mb-1.5 flex items-center gap-2">
              <p className="aura-rotulo">Plano do dia</p>
              {plano && <span className="ml-auto text-[0.6875rem] text-aura-graphite-soft">{haQuanto(plano.criadoEm)}</span>}
            </div>
            {plano?.texto ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-aura-graphite">{plano.texto}</p>
            ) : (
              <p className="text-sm text-aura-graphite-soft">
                {diretora?.estado === "aguardando_ativacao"
                  ? "A Diretora escreve o plano do dia assim que a equipe for ativada."
                  : "Ainda sem plano hoje. Ela escreve depois de ler o que cada agente relatou."}
              </p>
            )}
            {diretora?.fazendoAgora && diretora.estado === "trabalhando" && (
              <p className="mt-2 text-xs text-aura-graphite-soft">Agora: {diretora.fazendoAgora}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 content-start gap-3">
          <StatCard
            rotulo="Agentes ativos"
            valor={`${numero(ativos)}/${numero(mesas.length)}`}
            tom={ativos > 0 ? "marca" : "neutro"}
            detalhe={comErro > 0 ? `${comErro} com erro` : "ligados na equipe"}
          />
          <StatCard
            rotulo="Trabalhando agora"
            valor={numero(trabalhando)}
            tom={trabalhando > 0 ? "sucesso" : "neutro"}
            detalhe={trabalhando > 0 ? "rodando neste momento" : "todos em pausa"}
          />
          <StatCard
            rotulo="Achados abertos"
            valor={numero(achados)}
            tom={achados > 0 ? "atencao" : "neutro"}
            detalhe="esperando alguém agir"
          />
          <div className="aura-card p-4">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-aura-gold" />
              <p className="aura-rotulo truncate">Custo 30 dias</p>
            </div>
            <p className="mt-2 font-display text-2xl font-semibold tabular-nums text-aura-graphite">{dolar(custo30d)}</p>
            <BarraOrcamento gasto={custo30d} orcamento={orcamento} className="mt-2" />
            <p className="mt-1 text-xs text-aura-graphite-soft">de {dolar(orcamento)} de teto/mês</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Sala({
  rotulo,
  descricao,
  icone: Icone,
  mesas,
  aoAbrir,
}: {
  rotulo: string;
  descricao: string;
  icone: typeof Bot;
  mesas: MesaAgente[];
  aoAbrir: (id: string) => void;
}) {
  const larga = mesas.length >= 3;
  const trabalhando = mesas.filter((m) => m.estado === "trabalhando").length;
  return (
    <section
      className={cx("rounded-xl border border-aura-mist bg-aura-sunken/45 p-3 sm:p-4", larga && "md:col-span-2")}
      aria-label={`Sala ${rotulo}`}
    >
      <header className="mb-3 flex items-center gap-2 px-0.5">
        <Icone size={15} className="text-aura-graphite-soft" aria-hidden />
        <h3 className="text-sm font-semibold text-aura-graphite">{rotulo}</h3>
        <span className="hidden truncate text-xs text-aura-graphite-soft sm:inline">· {descricao}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          {trabalhando > 0 && <Selo tom="sucesso">{trabalhando} trabalhando</Selo>}
          <Selo>
            {mesas.length} {mesas.length === 1 ? "agente" : "agentes"}
          </Selo>
        </span>
      </header>
      <div className={cx("grid gap-3", larga ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
        {mesas.map((m) => (
          <Mesa key={m.id} mesa={m} aoAbrir={aoAbrir} />
        ))}
      </div>
    </section>
  );
}

function EsqueletoEscritorio() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando o escritório">
      <div className="aura-card grid gap-5 p-5 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex gap-3">
            <Esqueleto className="h-11 w-11" />
            <div className="flex-1 space-y-2">
              <Esqueleto className="h-3 w-24" />
              <Esqueleto className="h-5 w-40" />
            </div>
          </div>
          <Esqueleto className="h-24 w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Esqueleto key={i} className="h-24" />
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-3 rounded-xl border border-aura-mist p-4">
              <Esqueleto className="h-4 w-28" />
              <Esqueleto className="h-32 w-full" />
            </div>
          ))}
        </div>
        <Esqueleto className="h-96" />
      </div>
    </div>
  );
}
