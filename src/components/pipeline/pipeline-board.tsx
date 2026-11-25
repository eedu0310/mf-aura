"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layers, TrendingUp, Target, Plus, GripVertical, Columns3, Check, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { diaEmSaoPaulo } from "@/lib/fuso";
import { negocioEmAberto } from "@/lib/kpis";
import { moedaParaNumero } from "@/components/registrar-atividade/activity-date";
import { Botao, StatCard, classeBotao } from "@/components/ui";
import { NewOpportunityModal } from "./new-opportunity-modal";
import { OportunidadeDetailsModal } from "./oportunidade-details-modal";
import { MotivoPeridaModal } from "./motivo-perda-modal";
import type { Etapa, Oportunidade } from "@/lib/types";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import {
  acharEtapa,
  exigeValor,
  colunaDoNegocio,
  contaNoPipeline,
  nomeDaChave,
  corDe,
  ehGanho,
  ehPerda,
  etapasVisiveis,
  type EtapaFunil,
} from "@/lib/funil";

interface PipelineBoardProps {}

/*
 * As colunas e as cores vinham escritas aqui. Agora vêm do funil da loja, que
 * o gestor edita: renomear uma etapa mudava o nome no banco e deixava o card
 * sem coluna nenhuma onde aparecer, porque a tela continuava desenhando as
 * seis colunas antigas.
 */

const PESO_PROBABILIDADE: Record<string, number> = {
  Alta: 0.8,
  Média: 0.5,
  Baixa: 0.2,
};

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

// Componente do Card Draggable
function OportunidadeCard({
  oportunidade,
  onDetailsClick,
}: {
  oportunidade: Oportunidade;
  onDetailsClick: (opp: Oportunidade) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: oportunidade.id,
    data: { type: "Oportunidade" },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onDetailsClick(oportunidade)}
      className={`group cursor-pointer rounded-xl border border-aura-mist bg-aura-surface p-3 shadow-sm transition hover:-translate-y-px hover:border-aura-petrol-300 hover:shadow ${
        isDragging ? "shadow-lg ring-2 ring-aura-petrol-500" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={15} className="text-aura-graphite-soft/50 transition group-hover:text-aura-graphite-soft" />
        </div>
        <div className="flex-1 min-w-0">
          {/*
            O nome do negócio em duas linhas, não cortado com "...".
            Com `truncate` numa coluna estreita sobrava "Maria Apare..." em
            todo card, e o quadro inteiro virava uma fileira de reticências —
            para saber de quem era o negócio, a pessoa tinha de abrir um por
            um. Duas linhas resolvem a quase totalidade dos nomes.
          */}
          <p className="line-clamp-2 break-words text-sm font-semibold leading-snug text-aura-graphite">
            {oportunidade.cliente}
          </p>
          {oportunidade.produto && (
            <p className="mt-1 line-clamp-1 break-words text-xs text-aura-graphite-soft">
              {oportunidade.produto}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
            {oportunidade.valor ? (
              <span className="font-data text-sm font-semibold text-aura-graphite">
                {formatarMoeda(oportunidade.valor)}
              </span>
            ) : (
              <span className="aura-selo aura-selo-atencao" title="Abra o card e informe o valor estimado">
                sem valor
              </span>
            )}
            <span className="aura-selo aura-selo-marca">
              {oportunidade.probabilidade}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente da Coluna
function EtapaColuna({
  etapa,
  definicao,
  oportunidades,
  onDetailsClick,
}: {
  etapa: Etapa;
  definicao: EtapaFunil;
  oportunidades: Oportunidade[];
  onDetailsClick: (opp: Oportunidade) => void;
}) {
  const { setNodeRef } = useSortable({
    id: etapa,
    data: { type: "Etapa" },
  });

  const valorEtapa = oportunidades.reduce((soma, o) => soma + o.valor, 0);
  const ehPerdidos = definicao.tipo === "perda";

  return (
    <div
      ref={setNodeRef}
      data-coluna-etapa
      style={{ "--cor-etapa": definicao.cor } as React.CSSProperties}
      className={`flex min-w-0 flex-col overflow-hidden rounded-xl bg-aura-sunken ${
        ehPerdidos ? "ring-1 ring-aura-danger/20" : ""
      }`}
    >
      {/* Cabeçalho da coluna: bolinha da cor da etapa, nome, contagem e total
          — o padrão dos funis dos CRMs de alto padrão. */}
      <div className="px-3 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: definicao.cor }} />
          <p className="truncate text-[0.8125rem] font-semibold text-aura-graphite">{etapa}</p>
          <span className="ml-auto rounded-md bg-aura-surface px-1.5 py-px text-[0.7rem] font-medium tabular-nums text-aura-graphite-soft">
            {oportunidades.length}
          </span>
        </div>
        <p className="mt-1 pl-4 text-xs tabular-nums text-aura-graphite-soft">{formatarMoeda(valorEtapa)}</p>
      </div>

      <div className="flex min-h-96 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        {oportunidades.length === 0 ? (
          <div className="rounded-xl border border-dashed border-aura-mist px-3 py-6 text-center">
            <p className="text-xs text-aura-graphite-soft">
              {ehPerdidos ? "Nenhuma perdida" : "Nenhuma oportunidade"}
            </p>
          </div>
        ) : (
          <SortableContext items={oportunidades.map((o) => o.id)}>
            {oportunidades.map((o) => (
              <OportunidadeCard
                key={o.id}
                oportunidade={o}
                onDetailsClick={onDetailsClick}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  );
}

export function PipelineBoard({}: PipelineBoardProps) {
  const appData = useAppData();
  const todasOportunidades = appData.oportunidades || [];
  const { moveOportunidade, updateOportunidade, vendas, funil, nomesPorOwnerId, meuId } = appData;

  /*
   * FILTROS DO QUADRO (loja, vendedor, cliente).
   *
   * O gestor via o quadro da loja inteira (ou das quatro lojas, o mestre)
   * tudo junto, sem como olhar só uma loja ou só um vendedor. O filtro é feito
   * aqui, sobre o que ele já pode ver (as regras do banco continuam valendo),
   * e os quatro números do topo seguem o filtro. Fica guardado neste aparelho.
   * O vendedor só tem os próprios negócios: para ele aparece só a busca.
   */
  const [filtro, setFiltro] = useState<{ loja: string; vendedor: string; busca: string }>({ loja: "", vendedor: "", busca: "" });
  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem("aura:pipeline:filtro");
      if (salvo) setFiltro((f) => ({ ...f, ...(JSON.parse(salvo) as Partial<typeof f>), busca: "" }));
    } catch {
      /* sem filtro guardado */
    }
  }, []);
  function mudarFiltro(parcial: Partial<typeof filtro>) {
    setFiltro((atual) => {
      const novo = { ...atual, ...parcial };
      // Trocar a loja zera o vendedor, a não ser "só os meus".
      if (parcial.loja !== undefined && parcial.loja !== atual.loja && novo.vendedor !== "eu") novo.vendedor = "";
      try {
        window.localStorage.setItem("aura:pipeline:filtro", JSON.stringify({ loja: novo.loja, vendedor: novo.vendedor }));
      } catch {
        /* vale só nesta sessão */
      }
      return novo;
    });
  }
  const lojas = useMemo(
    () => [...new Set(todasOportunidades.map((o) => o.empresa).filter((e): e is string => !!e))].sort(),
    [todasOportunidades],
  );
  const vendedoresDaLoja = useMemo(() => {
    const conta = new Map<string, number>();
    for (const o of todasOportunidades) {
      if (!o.ownerId || (filtro.loja && o.empresa !== filtro.loja)) continue;
      if (!negocioEmAberto(o.etapa, funil)) continue;
      conta.set(o.ownerId, (conta.get(o.ownerId) ?? 0) + 1);
    }
    for (const o of todasOportunidades) {
      if (o.ownerId && !conta.has(o.ownerId) && (!filtro.loja || o.empresa === filtro.loja)) conta.set(o.ownerId, 0);
    }
    return [...conta.entries()]
      .map(([id, n]) => ({ id, nome: nomesPorOwnerId?.[id] ?? todasOportunidades.find((o) => o.ownerId === id)?.ownerNome ?? "Sem nome", n }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [todasOportunidades, filtro.loja, funil, nomesPorOwnerId]);
  const vendedorEscolhido = filtro.vendedor === "eu" ? meuId : filtro.vendedor || null;
  const termo = filtro.busca.trim().toLowerCase();
  const oportunidades = todasOportunidades.filter(
    (o) =>
      (!filtro.loja || o.empresa === filtro.loja) &&
      (!vendedorEscolhido || o.ownerId === vendedorEscolhido || o.parceiroId === vendedorEscolhido) &&
      (!termo || [o.cliente, o.produto, o.descricao].some((t) => (t ?? "").toLowerCase().includes(termo))),
  );
  const variosDonos = vendedoresDaLoja.length > 1 || lojas.length > 1;
  const filtrando = !!(filtro.loja || filtro.vendedor || termo);
  const todasAsColunas = etapasVisiveis(funil);

  /*
   * Colunas escondidas, por pessoa.
   *
   * O funil tem oito etapas e quase ninguém trabalha nas oito no mesmo dia —
   * Pós-venda e Perdidos, por exemplo, só interessam em revisão. Esconder é
   * escolha de quem olha, então fica no navegador da pessoa e não no banco:
   * não é configuração da loja, e o vendedor não deveria mexer no quadro do
   * colega para arrumar o próprio.
   */
  const [escondidas, setEscondidas] = useState<string[]>([]);
  const [menuColunas, setMenuColunas] = useState(false);

  /*
   * ROLAGEM HORIZONTAL SEM IR ATÉ O RODAPÉ.
   *
   * A barra de rolagem lateral fica no pé do quadro, e o quadro cresce com a
   * coluna mais cheia. Quem estava no topo, lendo Prospecção, não tinha como
   * chegar em Negociação sem rolar a página até o fim. As setas ‹ › ao lado
   * de "Colunas" ficam sempre à vista.
   *
   * Tentamos também prender a altura do quadro à janela (cada coluna rolando
   * por dentro); ficou ruim de ler os cards e foi desfeito a pedido em 20/10.
   * As colunas voltam a mostrar todos os cards de uma vez.
   */
  const quadroRef = useRef<HTMLDivElement>(null);
  const [podeEsquerda, setPodeEsquerda] = useState(false);
  const [podeDireita, setPodeDireita] = useState(false);

  const conferirSetas = useCallback(() => {
    const el = quadroRef.current;
    if (!el) return;
    setPodeEsquerda(el.scrollLeft > 4);
    setPodeDireita(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    conferirSetas();
    window.addEventListener("resize", conferirSetas);
    return () => window.removeEventListener("resize", conferirSetas);
  }, [conferirSetas]);

  function rolarColunas(direcao: 1 | -1) {
    const el = quadroRef.current;
    if (!el) return;
    // Uma coluna por clique: largura da primeira coluna + o espaço entre elas.
    const primeira = el.firstElementChild as HTMLElement | null;
    const passo = primeira ? primeira.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: direcao * passo, behavior: "smooth" });
  }

  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem("aura:pipeline:colunas-escondidas");
      if (salvo) setEscondidas(JSON.parse(salvo) as string[]);
    } catch {
      /* navegador sem localStorage, ou JSON estragado: mostra tudo */
    }
  }, []);

  function alternarColuna(nome: string) {
    setEscondidas((atual) => {
      const novo = atual.includes(nome) ? atual.filter((n) => n !== nome) : [...atual, nome];
      try {
        window.localStorage.setItem("aura:pipeline:colunas-escondidas", JSON.stringify(novo));
      } catch {
        /* se não der para guardar, vale só nesta sessão */
      }
      return novo;
    });
  }

  /*
   * Esconder TODAS deixaria o quadro em branco sem explicação, e a pessoa
   * pensaria que perdeu os negócios. Nesse caso mostramos tudo.
   */
  const colunas = todasAsColunas.filter((c) => !escondidas.includes(c.nome));
  const colunasVisiveis = colunas.length > 0 ? colunas : todasAsColunas;
  // Esconder ou mostrar coluna muda a largura do quadro: confere as setas de novo.
  useEffect(() => {
    conferirSetas();
  }, [colunasVisiveis.length, conferirSetas]);

  const [modalAberto, setModalAberto] = useState(false);
  const [oportunidadeSelecionada, setOportunidadeSelecionada] =
    useState<Oportunidade | null>(null);
  const [oportunidadePerdendo, setOportunidadePerdendo] =
    useState<Oportunidade | null>(null);


  const sensors = useSensors(
    useSensor(PointerSensor, {}),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Contagem de "em jogo": é um número de cabeças, não de dinheiro, com a
  // regra única de "negócio em aberto" (src/lib/kpis.ts). Antes contava tudo
  // que não era ganho nem perda — o pós-venda (cliente que já comprou) e a
  // coluna de leads frios entravam como negócio em jogo.
  const oportunidadesAtivas = oportunidades.filter((o) => negocioEmAberto(o.etapa, funil));
  // Dinheiro só conta nas etapas que o gestor marcou como "conta no pipeline":
  // lead no começo do funil é intenção, não negócio na mesa, e somar tudo
  // inflava o total com qualquer contato novo.
  const oportunidadesQueContam = oportunidades.filter((o) =>
    contaNoPipeline(o.etapa, funil),
  );
  const valorTotal = oportunidadesQueContam.reduce((soma, o) => soma + o.valor, 0);
  const previsaoPonderada = oportunidadesQueContam.reduce(
    (soma, o) => soma + o.valor * PESO_PROBABILIDADE[o.probabilidade],
    0,
  );
  // Mês de Brasília: em UTC, das 21h do último dia em diante o card já
  // contava o mês seguinte e mostrava R$ 0.
  const mesAtual = diaEmSaoPaulo().slice(0, 7);
  const fechamentosDoMes = (vendas ?? [])
    .filter((venda) => venda.data?.startsWith(mesAtual))
    .filter((venda) => !filtro.loja || (venda.empresa ?? venda.loja) === filtro.loja)
    .filter(
      (venda) =>
        !vendedorEscolhido ||
        venda.ownerId === vendedorEscolhido ||
        venda.vendedorId === vendedorEscolhido ||
        venda.parceiroId === vendedorEscolhido,
    )
    .reduce((total, venda) => total + (venda.valorFechado ?? venda.valor ?? 0), 0);

  /**
   * Etapas em que o negócio precisa ter valor: a partir de Follow-up o
   * vendedor já mandou orçamento, então sabe quanto é. 190 dos 266 negócios
   * estavam em R$ 0 e a previsão de faturamento do gestor não valia nada.
   */
  // Negociação e Fechamento: obrigatório (o banco também recusa sem valor).
  // Follow-up continua pedindo: é onde o orçamento foi enviado.
  function pedeValor(etapa: Etapa) {
    return exigeValor(etapa, funil) || acharEtapa(etapa, funil)?.chave === "followup";
  }

  /** Um só caminho para mover, seja soltando na coluna ou sobre outro card. */
  async function mover(oportunidadeId: string, novaEtapa: Etapa) {
    const opp = todasOportunidades.find((o) => o.id === oportunidadeId);
    if (!opp || opp.etapa === novaEtapa) return;

    if (ehPerda(novaEtapa, funil)) {
      setOportunidadePerdendo(opp);
      return;
    }

    if (!opp.valor && pedeValor(novaEtapa)) {
      const digitado = window.prompt(
        `Qual o valor estimado do negócio de ${opp.cliente}? (em reais, só números)\nA partir de ${novaEtapa} o valor entra na previsão do mês.`,
        "",
      );
      if (digitado === null) return;
      // "15.000,00" virava 1.500.000: os centavos entravam como reais.
      const valor = Math.round(moedaParaNumero(digitado));
      if (!valor) {
        window.alert("Sem valor o negócio fica onde está. Abra o card e preencha quando souber.");
        return;
      }
      try {
        await updateOportunidade(oportunidadeId, { valor });
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Não consegui gravar o valor.");
        return;
      }
    }

    if (
      ehGanho(novaEtapa, funil) &&
      !window.confirm("Confirmar o fechamento desta oportunidade? Ela será registrada nas vendas do mês.")
    ) return;

    /*
     * Se o banco recusar (RLS, venda igual já existe, erro de verdade), o
     * card volta sozinho para a coluna de origem e a pessoa vê o motivo.
     */
    try {
      await moveOportunidade(oportunidadeId, novaEtapa);
    } catch (e) {
      window.alert(`O card voltou para ${opp.etapa}. Motivo: ${e instanceof Error ? e.message : "erro desconhecido"}`);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const oportunidadeId = active.id as string;
    const overData = over.data.current;

    if (overData?.type === "Etapa") {
      void mover(oportunidadeId, over.id as Etapa);
      return;
    }
    if (overData?.type === "Oportunidade") {
      const oportunidadeOver = oportunidades.find((o) => o.id === over.id);
      if (oportunidadeOver) void mover(oportunidadeId, oportunidadeOver.etapa);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          {variosDonos && lojas.length > 1 && (
            <select
              value={filtro.loja}
              onChange={(e) => mudarFiltro({ loja: e.target.value })}
              className="aura-input !h-9 w-auto"
              aria-label="Filtrar por loja"
            >
              <option value="">Todas as lojas</option>
              {lojas.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}
          {variosDonos && (
            <select
              value={filtro.vendedor}
              onChange={(e) => mudarFiltro({ vendedor: e.target.value })}
              className="aura-input !h-9 w-auto"
              aria-label="Filtrar por vendedor"
            >
              <option value="">Todos os vendedores</option>
              {meuId && <option value="eu">Só os meus</option>}
              {vendedoresDaLoja.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nome} ({v.n} em aberto)
                </option>
              ))}
            </select>
          )}
          <label className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-aura-graphite-soft" />
            <input
              value={filtro.busca}
              onChange={(e) => mudarFiltro({ busca: e.target.value })}
              placeholder="Buscar cliente ou produto"
              className="aura-input !h-9 w-56 !pl-8"
              aria-label="Buscar no quadro"
            />
          </label>
          {filtrando && (
            <button type="button" onClick={() => mudarFiltro({ loja: "", vendedor: "", busca: "" })} className={classeBotao("fantasma", "sm")}>
              <X size={13} /> Limpar filtros
            </button>
          )}
          {filtrando && (
            <span className="text-xs text-aura-graphite-soft">
              Mostrando {oportunidades.length} de {todasOportunidades.length} negócios
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icone={Layers} rotulo="Valor em aberto (Proposta+)" valor={formatarMoeda(valorTotal)} />
          <StatCard icone={TrendingUp} rotulo="Previsão ponderada (Proposta+)" valor={formatarMoeda(previsaoPonderada)} />
          <StatCard icone={Target} rotulo="Oportunidades ativas" valor={oportunidadesAtivas.length} />
          <StatCard icone={Target} tom="sucesso" rotulo="Fechamentos do mês" valor={formatarMoeda(fechamentosDoMes)} />
        </div>

        {/* Barra do quadro: dica, setas de rolagem, escolher colunas e criar.
            Fica logo acima do quadro, porque é onde a pessoa está olhando
            quando percebe que tem coluna demais. */}
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-sm text-aura-graphite-soft">
            Arraste as oportunidades entre as etapas
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => rolarColunas(-1)}
              disabled={!podeEsquerda}
              aria-label="Ver colunas à esquerda"
              title="Colunas à esquerda"
              className={classeBotao("secundario", "sm", "w-[1.875rem] px-0")}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => rolarColunas(1)}
              disabled={!podeDireita}
              aria-label="Ver colunas à direita"
              title="Colunas à direita"
              className={classeBotao("secundario", "sm", "w-[1.875rem] px-0")}
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuColunas((v) => !v)}
              className={classeBotao("secundario", "sm")}
            >
              <Columns3 size={13} />
              Colunas
              {escondidas.length > 0 && (
                <span className="rounded-md bg-aura-sunken px-1.5 py-px text-[10px] tabular-nums text-aura-graphite-soft">
                  {todasAsColunas.length - escondidas.length}/{todasAsColunas.length}
                </span>
              )}
            </button>
            {menuColunas && (
              <div className="absolute right-0 top-9 z-30 w-56 rounded-xl border border-aura-mist bg-aura-surface py-1 shadow-xl">
                {todasAsColunas.map((c) => {
                  const visivel = !escondidas.includes(c.nome);
                  return (
                    <button
                      key={c.nome}
                      type="button"
                      onClick={() => alternarColuna(c.nome)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-aura-graphite hover:bg-aura-sunken"
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-aura-mist">
                        {visivel && <Check size={12} className="text-aura-petrol-600" />}
                      </span>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.cor }} />
                      <span className="truncate">{c.nome}</span>
                    </button>
                  );
                })}
                <p className="border-t border-aura-mist px-3 py-2 text-[11px] text-aura-graphite-soft">
                  Vale só para você, neste aparelho.
                </p>
              </div>
            )}
          </div>
          <Botao variante="primario" tamanho="sm" icone={Plus} onClick={() => setModalAberto(true)}>
            Nova oportunidade
          </Botao>
        </div>

        {/* As colunas são as etapas que o gestor deixou ativas, na ordem dele.
            O número de colunas deixa de ser fixo em seis, senão um funil com
            sete etapas espremeria tudo ou deixaria a última de fora. */}
        {/*
          LARGURA MÍNIMA POR COLUNA, e o quadro rola na horizontal.

          Antes era `minmax(0, 1fr)`, e esse style em linha anulava as classes
          de responsivo ao lado: as oito etapas eram espremidas para caber na
          largura da tela em qualquer aparelho. Num celular de 390px cada
          coluna ficava com 45 pixels, e o overflow-x-auto nunca entrava em
          ação porque o grid sempre "cabia". Com piso de 17rem a coluna para
          de encolher e o quadro passa a rolar, que é como um kanban se
          comporta.
        */}
        <div
          ref={quadroRef}
          data-quadro-pipeline
          onScroll={conferirSetas}
          className="grid gap-4 overflow-x-auto pb-2"
          style={{
            gridTemplateColumns: `repeat(${Math.max(1, colunasVisiveis.length)}, minmax(17rem, 1fr))`,
          }}
        >
          {colunasVisiveis.map((def) => {
            // Pelo nome RESOLVIDO, não pelo texto cru: um negócio gravado
            // como "Proposta" aparece na coluna "Follow-up" depois da
            // renomeação, em vez de sumir do quadro.
            const itens = oportunidades.filter((o) => colunaDoNegocio(o.etapa, funil) === def.nome);
            return (
              <EtapaColuna
                key={def.nome}
                etapa={def.nome}
                definicao={def}
                oportunidades={itens}
                onDetailsClick={setOportunidadeSelecionada}
              />
            );
          })}
        </div>

        {/* MODAIS */}
        {modalAberto && (
          <NewOpportunityModal onClose={() => setModalAberto(false)} />
        )}

        {oportunidadeSelecionada && (
          <OportunidadeDetailsModal
            // A versão atual da lista, não a cópia do clique: depois de salvar
            // a edição o modal mostrava os valores antigos até ser reaberto.
            oportunidade={
              oportunidades.find((o) => o.id === oportunidadeSelecionada.id) ?? oportunidadeSelecionada
            }
            onClose={() => setOportunidadeSelecionada(null)}
            onDelete={() => setOportunidadeSelecionada(null)}
          />
        )}

        {oportunidadePerdendo && (
          <MotivoPeridaModal
            oportunidade={oportunidadePerdendo}
            onClose={() => setOportunidadePerdendo(null)}
            onConfirmar={async (motivo, descricao) => {
              /*
               * Etapa, motivo, descrição e data da perda num update só.
               * Antes o modal gravava o motivo por um caminho que o descartava
               * e o arrasto gravava só a etapa: os 53 perdidos ficaram sem
               * motivo e sem data. Com await: se o banco recusar, o modal
               * mostra o motivo em vez de a promessa falhar calada.
               */
              await moveOportunidade(oportunidadePerdendo.id, nomeDaChave("perda", funil) ?? "Perdidos", {
                motivo,
                descricao,
              });
              setOportunidadePerdendo(null);
            }}
          />
        )}
      </div>
    </DndContext>
  );
}
