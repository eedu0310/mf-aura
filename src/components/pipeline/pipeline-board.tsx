"use client";

import { useState } from "react";
import { Layers, TrendingUp, Target, Plus, GripVertical } from "lucide-react";
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

interface PipelineBoardProps {}

const ETAPAS: Etapa[] = [
  "Prospecção",
  "Apresentação",
  "Proposta",
  "Negociação",
  "Fechados",
  "Perdidos",
];

const COR_ETAPA: Record<Etapa, string> = {
  Prospecção: "bg-aura-petrol-700",
  Apresentação: "bg-aura-petrol-500",
  Proposta: "bg-aura-gold",
  Negociação: "bg-aura-warning",
  Fechados: "bg-aura-success",
  Perdidos: "bg-aura-danger",
};

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
          <p className="text-sm font-medium text-aura-graphite truncate">
            {oportunidade.cliente}
          </p>
          <p className="mt-1 text-xs text-aura-graphite-soft">
            {formatarMoeda(oportunidade.valor)}
          </p>
          {oportunidade.produto && (
            <p className="mt-1 text-xs text-aura-graphite-soft truncate">
              {oportunidade.produto}
            </p>
          )}
          <div className="mt-2 flex items-center justify-between">
            <span className="inline-block rounded-full bg-aura-petrol-100 px-2 py-1 text-xs font-medium text-aura-petrol-700">
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
  oportunidades,
  onDetailsClick,
}: {
  etapa: Etapa;
  oportunidades: Oportunidade[];
  onDetailsClick: (opp: Oportunidade) => void;
}) {
  const { setNodeRef } = useSortable({
    id: etapa,
    data: { type: "Etapa" },
  });

  const valorEtapa = oportunidades.reduce((soma, o) => soma + o.valor, 0);
  const ehPerdidos = etapa === "Perdidos";

  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-aura-bg ${
        ehPerdidos ? "border-aura-danger/20" : "border-aura-mist"
      }`}
    >
      <div className={`h-1 w-full ${COR_ETAPA[etapa]}`} />

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
  const { moveOportunidade, vendas } = appData;

  const [modalAberto, setModalAberto] = useState(false);
  const [oportunidadeSelecionada, setOportunidadeSelecionada] =
    useState<Oportunidade | null>(null);
  const [oportunidadePerdendo, setOportunidadePerdendo] =
    useState<Oportunidade | null>(null);

  console.log("🔍 oportunidadePerdendo state:", oportunidadePerdendo);

  const sensors = useSensors(
    useSensor(PointerSensor, {}),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const oportunidadesAtivas = oportunidades.filter(
    (o) => o.etapa !== "Perdidos" && o.etapa !== "Fechados",
  );
  const valorTotal = oportunidadesAtivas.reduce((soma, o) => soma + o.valor, 0);
  const previsaoPonderada = oportunidadesAtivas.reduce(
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
      console.log("❌ Over é null");
      return;
    }

    const oportunidadeId = active.id as string;
    const overData = over.data.current;

    console.log("🔍 Over data:", overData);
    console.log("🔍 Over id:", over.id);
    console.log("🔍 Active id:", active.id);

    // Se está sobre uma ETAPA (coluna)
    if (overData?.type === "Etapa") {
      const novaEtapa = over.id as Etapa;
      console.log(`📦 Movendo ${oportunidadeId} para ETAPA: ${novaEtapa}`);

      // ⭐ SE FOR "PERDIDOS", ABRE MODAL
      if (novaEtapa === "Perdidos") {
        console.log("🔴 Etapa é PERDIDOS! Procurando oportunidade...");
        const opp = oportunidades.find((o) => o.id === oportunidadeId);
        console.log("🔴 Oportunidade encontrada:", opp);
        if (opp) {
          console.log("🔴 ABRINDO MODAL DE PERDA!");
          setOportunidadePerdendo(opp);
        }
        return;
      }

      if (
        novaEtapa === "Fechados" &&
        !window.confirm("Confirmar o fechamento desta oportunidade? Ela será registrada nas vendas do mês.")
      ) return;
      moveOportunidade(oportunidadeId, novaEtapa);
      return;
    }

    // Se está sobre uma OPORTUNIDADE, pega a etapa dessa oportunidade
    if (overData?.type === "Oportunidade") {
      const oportunidadeOver = oportunidades.find((o) => o.id === over.id);
      if (oportunidadeOver) {
        console.log(
          `📦 Movendo ${oportunidadeId} para ETAPA (via oportunidade): ${oportunidadeOver.etapa}`,
        );

        // ⭐ SE FOR "PERDIDOS", ABRE MODAL
        if (oportunidadeOver.etapa === "Perdidos") {
          console.log("🔴 Etapa é PERDIDOS! Procurando oportunidade...");
          const opp = oportunidades.find((o) => o.id === oportunidadeId);
          console.log("🔴 Oportunidade encontrada:", opp);
          if (opp) {
            console.log("🔴 ABRINDO MODAL DE PERDA!");
            setOportunidadePerdendo(opp);
          }
          return;
        }

        if (
          oportunidadeOver.etapa === "Fechados" &&
          !window.confirm("Confirmar o fechamento desta oportunidade? Ela será registrada nas vendas do mês.")
        ) return;
        moveOportunidade(oportunidadeId, oportunidadeOver.etapa);
        return;
      }
    }

    console.log("❌ Tipo de drop inválido:", overData?.type);
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
                Valor total em aberto
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
                Previsão ponderada
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

        <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-6">
          {ETAPAS.map((etapa) => {
            const itens = oportunidades.filter((o) => o.etapa === etapa);
            return (
              <EtapaColuna
                key={etapa}
                etapa={etapa}
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
              console.log("✅ Confirmando perda...");
              moveOportunidade(oportunidadePerdendo.id, "Perdidos");
              setOportunidadePerdendo(null);
            }}
          />
        )}
      </div>
    </DndContext>
  );
}
