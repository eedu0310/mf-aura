"use client";

import { useEffect, useState } from "react";
import { Layers, TrendingUp, Target, Plus, GripVertical, Columns3, Check } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
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
      className={`rounded-lg border border-aura-mist bg-white p-3 cursor-pointer transition hover:shadow-md hover:border-aura-petrol-300 ${
        isDragging ? "shadow-lg ring-2 ring-aura-petrol-500" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={16} className="text-aura-graphite-soft" />
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
            <span className="font-data text-sm font-semibold text-aura-graphite">
              {formatarMoeda(oportunidade.valor)}
            </span>
            <span className="inline-block rounded-full bg-aura-petrol-100 px-2 py-0.5 text-[11px] font-medium text-aura-petrol-700">
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
      className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-aura-bg ${
        ehPerdidos ? "border-aura-danger/20" : "border-aura-mist"
      }`}
    >
      <div className="h-1 w-full" style={{ backgroundColor: definicao.cor }} />

      <div className="border-b border-aura-mist bg-white px-3 py-2.5">
        <p className="text-sm font-medium text-aura-graphite">{etapa}</p>
        <p className="text-xs text-aura-graphite-soft">
          {oportunidades.length} · {formatarMoeda(valorEtapa)}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3 min-h-96 overflow-y-auto">
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
  const oportunidades = appData.oportunidades || [];
  const { moveOportunidade, vendas, funil } = appData;
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

  // Contagem de "em jogo": segue tudo que não foi fechado nem perdido, porque
  // é um número de cabeças, não de dinheiro.
  const oportunidadesAtivas = oportunidades.filter(
    (o) => !ehPerda(o.etapa, funil) && !ehGanho(o.etapa, funil),
  );
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
  const mesAtual = new Date().toISOString().slice(0, 7);
  const fechamentosDoMes = (vendas ?? [])
    .filter((venda) => venda.data?.startsWith(mesAtual))
    .reduce((total, venda) => total + (venda.valorFechado ?? venda.valor ?? 0), 0);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) {
      return;
    }

    const oportunidadeId = active.id as string;
    const overData = over.data.current;


    // Se está sobre uma ETAPA (coluna)
    if (overData?.type === "Etapa") {
      const novaEtapa = over.id as Etapa;

      // ⭐ SE FOR "PERDIDOS", ABRE MODAL
      if (ehPerda(novaEtapa, funil)) {
        const opp = oportunidades.find((o) => o.id === oportunidadeId);
        if (opp) {
          setOportunidadePerdendo(opp);
        }
        return;
      }

      if (
        ehGanho(novaEtapa, funil) &&
        !window.confirm("Confirmar o fechamento desta oportunidade? Ela será registrada nas vendas do mês.")
      ) return;
      /*
       * Com .catch: mover para Fechamento grava uma venda, e se o banco
       * recusar (venda igual já existe, ou erro de verdade) a pessoa precisa
       * ver o motivo. Sem isto a promessa estourava no console e a tela
       * ficava como se tivesse dado certo.
       */
      moveOportunidade(oportunidadeId, novaEtapa).catch((e) => {
        window.alert(
          `O card foi movido, mas a venda não foi gravada. Motivo: ${
            e instanceof Error ? e.message : "erro desconhecido"
          }`,
        );
      });
      return;
    }

    // Se está sobre uma OPORTUNIDADE, pega a etapa dessa oportunidade
    if (overData?.type === "Oportunidade") {
      const oportunidadeOver = oportunidades.find((o) => o.id === over.id);
      if (oportunidadeOver) {

        // ⭐ SE FOR "PERDIDOS", ABRE MODAL
        if (ehPerda(oportunidadeOver.etapa, funil)) {
          const opp = oportunidades.find((o) => o.id === oportunidadeId);
          if (opp) {
            setOportunidadePerdendo(opp);
          }
          return;
        }

        if (
          ehGanho(oportunidadeOver.etapa, funil) &&
          !window.confirm("Confirmar o fechamento desta oportunidade? Ela será registrada nas vendas do mês.")
        ) return;
        moveOportunidade(oportunidadeId, oportunidadeOver.etapa);
        return;
      }
    }

  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-6 pb-24">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-display text-xl font-semibold text-aura-graphite">
              Pipeline
            </p>
            <p className="text-sm text-aura-graphite-soft">
              Arraste as oportunidades entre as etapas
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="hidden shrink-0 items-center gap-1.5 rounded-full bg-aura-petrol-700 px-4 py-2 text-sm font-medium text-white hover:bg-aura-petrol-600 sm:flex"
          >
            <Plus size={15} />
            Nova oportunidade
          </button>
        </div>

        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="flex items-center justify-center gap-1.5 rounded-full bg-aura-petrol-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-aura-petrol-600 sm:hidden"
        >
          <Plus size={15} />
          Nova oportunidade
        </button>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-aura-mist bg-white p-5">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-aura-petrol-600" />
              <p className="text-sm text-aura-graphite-soft">
                Valor em aberto (Proposta+)
              </p>
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-aura-graphite">
              {formatarMoeda(valorTotal)}
            </p>
          </div>
          <div className="rounded-2xl border border-aura-mist bg-white p-5">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-aura-petrol-600" />
              <p className="text-sm text-aura-graphite-soft">
                Previsão ponderada (Proposta+)
              </p>
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-aura-graphite">
              {formatarMoeda(previsaoPonderada)}
            </p>
          </div>
          <div className="rounded-2xl border border-aura-mist bg-white p-5">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-aura-petrol-600" />
              <p className="text-sm text-aura-graphite-soft">
                Oportunidades ativas
              </p>
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-aura-graphite">
              {oportunidadesAtivas.length}
            </p>
          </div>
          <div className="rounded-2xl border border-aura-mist bg-white p-5">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-aura-success" />
              <p className="text-sm text-aura-graphite-soft">Fechamentos do mês</p>
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-aura-graphite">
              {formatarMoeda(fechamentosDoMes)}
            </p>
          </div>
        </div>

        {/* Escolher quais etapas aparecem. Fica logo acima do quadro, porque é
            onde a pessoa está olhando quando percebe que tem coluna demais. */}
        <div className="relative flex justify-end">
          <button
            type="button"
            onClick={() => setMenuColunas((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-aura-mist bg-white px-3 py-1.5 text-xs font-medium text-aura-graphite hover:bg-aura-bg"
          >
            <Columns3 size={14} />
            Colunas
            {escondidas.length > 0 && (
              <span className="rounded-full bg-aura-petrol-700 px-1.5 text-[10px] text-white">
                {todasAsColunas.length - escondidas.length}/{todasAsColunas.length}
              </span>
            )}
          </button>
          {menuColunas && (
            <div className="absolute right-0 top-9 z-30 w-56 rounded-xl border border-aura-mist bg-white py-1 shadow-xl">
              {todasAsColunas.map((c) => {
                const visivel = !escondidas.includes(c.nome);
                return (
                  <button
                    key={c.nome}
                    type="button"
                    onClick={() => alternarColuna(c.nome)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-aura-graphite hover:bg-aura-bg"
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-aura-mist">
                      {visivel && <Check size={12} className="text-aura-petrol-700" />}
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
            oportunidade={oportunidadeSelecionada}
            onClose={() => setOportunidadeSelecionada(null)}
            onDelete={() => setOportunidadeSelecionada(null)}
          />
        )}

        {oportunidadePerdendo && (
          <MotivoPeridaModal
            oportunidade={oportunidadePerdendo}
            onClose={() => setOportunidadePerdendo(null)}
            onConfirm={async () => {
              moveOportunidade(oportunidadePerdendo.id, nomeDaChave("perda", funil) ?? "Perdidos");
              setOportunidadePerdendo(null);
            }}
          />
        )}
      </div>
    </DndContext>
  );
}
