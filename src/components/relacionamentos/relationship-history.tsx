"use client";

import { useMemo } from "react";
import { History, ShoppingBag, Target } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import type { Atividade } from "@/lib/types";

interface RelationshipHistoryProps { relacionamentoId: string; }
type Evento = { id: string; data: Date; titulo: string; subtitulo: string; detalhe?: string; tipo: "atividade" | "oportunidade" | "venda" };

function obterData(valor?: string) { const data = valor ? new Date(valor) : new Date(0); return Number.isNaN(data.getTime()) ? new Date(0) : data; }
function formatarData(data: Date) { return data.getTime() === 0 ? "Data não informada" : data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
function moeda(valor: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(valor); }

export function RelationshipHistory({ relacionamentoId }: RelationshipHistoryProps) {
  const { atividades, oportunidades, vendas } = useAppData();
  const eventos = useMemo<Evento[]>(() => {
    const itens: Evento[] = atividades.filter((a) => a.relacionamentoId === relacionamentoId).map((atividade: Atividade) => ({
      id: `atividade-${atividade.id}`,
      data: obterData(atividade.ocorridaEm || atividade.quando || atividade.criadoEm),
      titulo: atividade.titulo,
      subtitulo: [atividade.tipo, atividade.subtipo].filter(Boolean).join(" · "),
      detalhe: atividade.anotacoes || atividade.resultado || atividade.proximoPasso,
      tipo: "atividade",
    }));
    oportunidades.filter((o) => o.relacionamentoId === relacionamentoId).forEach((oportunidade) => itens.push({
      id: `oportunidade-${oportunidade.id}`,
      data: obterData(oportunidade.atualizado || oportunidade.criadoEm),
      titulo: oportunidade.cliente,
      subtitulo: `Oportunidade · ${oportunidade.etapa}`,
      detalhe: `${moeda(oportunidade.valor)} · ${oportunidade.probabilidade}`,
      tipo: "oportunidade",
    }));
    vendas.filter((venda) => venda.relacionamentoId === relacionamentoId).forEach((venda) => itens.push({
      id: `venda-${venda.id}`,
      data: obterData(venda.data || venda.criadoEm),
      titulo: venda.cliente,
      subtitulo: `Venda${venda.produto ? ` · ${venda.produto}` : ""}`,
      detalhe: moeda(venda.valorFechado ?? venda.valor),
      tipo: "venda",
    }));
    return itens.sort((a, b) => b.data.getTime() - a.data.getTime());
  }, [atividades, oportunidades, vendas, relacionamentoId]);

  return <div className="rounded-2xl border border-aura-mist bg-white p-4">
    <div className="flex items-center gap-2"><History size={15} className="text-aura-petrol-600" /><p className="text-sm font-medium text-aura-graphite">Linha do tempo comercial</p></div>
    {eventos.length === 0 ? <p className="mt-3 text-xs text-aura-graphite-soft">Nenhuma atividade, oportunidade ou venda vinculada ainda.</p> : <ol className="mt-3 flex flex-col gap-3">{eventos.map((evento) => <li key={evento.id} className="relative flex gap-3 border-l border-aura-mist pl-4 last:border-transparent"><span className={`absolute -left-1.5 top-1 h-3 w-3 rounded-full border-2 border-white ${evento.tipo === "venda" ? "bg-aura-success" : evento.tipo === "oportunidade" ? "bg-aura-gold" : "bg-aura-petrol-600"}`} />{evento.tipo === "venda" ? <ShoppingBag size={14} className="mt-0.5 shrink-0 text-aura-success" /> : evento.tipo === "oportunidade" ? <Target size={14} className="mt-0.5 shrink-0 text-aura-gold" /> : <History size={14} className="mt-0.5 shrink-0 text-aura-petrol-600" />}<div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-2"><p className="text-sm font-medium text-aura-graphite">{evento.titulo}</p><span className="text-xs text-aura-graphite-soft">{formatarData(evento.data)}</span></div><p className="mt-0.5 text-xs text-aura-graphite-soft">{evento.subtitulo}</p>{evento.detalhe && <p className="mt-1 rounded-lg bg-aura-bg px-3 py-2 text-xs leading-relaxed text-aura-graphite">{evento.detalhe}</p>}</div></li>)}</ol>}
  </div>;
}
