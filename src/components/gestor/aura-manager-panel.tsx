"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Star, Users } from "lucide-react";
import type { Atividade, Oportunidade, Relacionamento, Venda } from "@/lib/types";
import { listarPosVendas, type PosVenda } from "@/lib/supabase/pos-venda";
import { useAppData } from "@/lib/app-data-context";
import { ehFechada } from "@/lib/funil";

function moeda(valor: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(valor); }

export function AuraManagerPanel({ oportunidades, relacionamentos, atividades, vendas }: { oportunidades: Oportunidade[]; relacionamentos: Relacionamento[]; atividades: Atividade[]; vendas: Venda[] }) {
  const { funil } = useAppData();
  const [posVendas, setPosVendas] = useState<PosVenda[]>([]);
  useEffect(() => { void listarPosVendas().then((lista) => setPosVendas(lista ?? [])); }, []);

  const radar = useMemo(() => {
    const hoje = Date.now();
    const itens: Array<{ id: string; titulo: string; descricao: string; href: string; nivel: "alta" | "media" }> = [];
    relacionamentos.filter((r) => r.proximoContatoEm && new Date(r.proximoContatoEm).getTime() < hoje).slice(0, 5).forEach((r) => itens.push({ id: `retorno-${r.id}`, titulo: `Retorno vencido: ${r.nome}`, descricao: `O contato previsto para ${r.proximoContato} ainda precisa de registro ou reagendamento.`, href: `/relacionamentos?buscar=${encodeURIComponent(r.nome)}`, nivel: "alta" }));
    oportunidades.filter((o) => !ehFechada(o.etapa, funil) && (o.diasParado ?? 0) >= 7).sort((a, b) => (b.diasParado ?? 0) - (a.diasParado ?? 0)).slice(0, 5).forEach((o) => itens.push({ id: `parada-${o.id}`, titulo: `Oportunidade parada: ${o.cliente}`, descricao: `${o.diasParado} dias sem avanço em ${o.etapa}; valor ${moeda(o.valor)}.`, href: "/pipeline", nivel: "alta" }));
    relacionamentos.filter((r) => r.temperatura === "frio" || r.temperatura === "esfriando").slice(0, 5).forEach((r) => itens.push({ id: `frio-${r.id}`, titulo: `Relacionamento esfriando: ${r.nome}`, descricao: `Temperatura atual: ${r.temperatura}. Planeje uma ação registrada para recuperar o contato.`, href: `/relacionamentos?buscar=${encodeURIComponent(r.nome)}`, nivel: "media" }));
    return itens.slice(0, 8);
  }, [oportunidades, relacionamentos, funil]);

  const rankingAvaliacoes = useMemo(() => {
    const mapa = new Map<string, { nome: string; notas: number; soma: number; vendas: number }>();
    posVendas.filter((p) => p.avaliouLoja && p.notaAvaliacao).forEach((p) => {
      const atual = mapa.get(p.empresa) ?? { nome: p.empresa, notas: 0, soma: 0, vendas: 0 };
      atual.notas += 1; atual.soma += p.notaAvaliacao ?? 0; atual.vendas += 1; mapa.set(p.empresa, atual);
    });
    return [...mapa.values()].map((item) => ({ ...item, media: item.soma / item.notas })).sort((a, b) => b.media - a.media || b.notas - a.notas);
  }, [posVendas]);
  const vendasComAvaliacao = posVendas.filter((p) => p.avaliouLoja).length;
  const taxaAvaliacao = posVendas.length ? Math.round((vendasComAvaliacao / posVendas.length) * 100) : 0;
  const valorAberto = oportunidades.filter((o) => !ehFechada(o.etapa, funil)).reduce((s, o) => s + o.valor, 0);

  return <section className="space-y-4">
    <div className="flex items-start justify-between gap-3"><div><p className="font-display text-xl font-semibold text-aura-graphite">AURA Manager</p><p className="text-sm text-aura-graphite-soft">Radar derivado dos mesmos dados do CRM, sem uma segunda base de informações.</p></div><span className="rounded-full bg-aura-petrol-700/10 px-3 py-1 text-xs font-semibold text-aura-petrol-700">{atividades.length} atividades carregadas</span></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-2xl border border-aura-mist bg-white p-4"><p className="text-xs text-aura-graphite-soft">Oportunidades abertas</p><p className="mt-1 font-display text-xl font-bold text-aura-graphite">{oportunidades.filter((o) => !ehFechada(o.etapa, funil)).length}</p><p className="text-xs text-aura-graphite-soft">{moeda(valorAberto)}</p></div><div className="rounded-2xl border border-aura-mist bg-white p-4"><p className="text-xs text-aura-graphite-soft">Relacionamentos</p><p className="mt-1 font-display text-xl font-bold text-aura-graphite">{relacionamentos.length}</p></div><div className="rounded-2xl border border-aura-mist bg-white p-4"><p className="text-xs text-aura-graphite-soft">Pós-vendas avaliados</p><p className="mt-1 font-display text-xl font-bold text-aura-graphite">{vendasComAvaliacao}</p><p className="text-xs text-aura-graphite-soft">{taxaAvaliacao}% dos registros</p></div><div className="rounded-2xl border border-aura-mist bg-white p-4"><p className="text-xs text-aura-graphite-soft">Vendas no escopo</p><p className="mt-1 font-display text-xl font-bold text-aura-graphite">{vendas.length}</p></div></div>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-aura-mist bg-white p-5"><div className="flex items-center gap-2"><AlertTriangle size={16} className="text-aura-warning" /><p className="text-sm font-semibold text-aura-graphite">Radar Comercial</p><span className="ml-auto rounded-full bg-aura-warning/10 px-2 py-0.5 text-xs font-semibold text-aura-warning">{radar.length}</span></div>{radar.length === 0 ? <p className="mt-3 flex items-center gap-2 text-xs text-aura-graphite-soft"><CheckCircle2 size={14} className="text-aura-success" /> Nenhuma prioridade crítica identificada.</p> : <div className="mt-3 space-y-2">{radar.map((item) => <Link key={item.id} href={item.href} className="flex items-start gap-2 rounded-xl bg-aura-bg p-3 hover:bg-aura-mist"><AlertTriangle size={14} className={`mt-0.5 shrink-0 ${item.nivel === "alta" ? "text-aura-danger" : "text-aura-warning"}`} /><span className="min-w-0 flex-1"><b className="block text-xs text-aura-graphite">{item.titulo}</b><span className="mt-1 block text-xs text-aura-graphite-soft">{item.descricao}</span></span><ArrowRight size={13} className="mt-1 shrink-0 text-aura-graphite-soft" /></Link>)}</div>}</div>
      <div className="rounded-2xl border border-aura-mist bg-white p-5"><div className="flex items-center gap-2"><Star size={16} className="text-aura-gold" /><p className="text-sm font-semibold text-aura-graphite">Ranking de avaliações</p><span className="ml-auto text-xs text-aura-graphite-soft">por empresa</span></div>{rankingAvaliacoes.length === 0 ? <p className="mt-3 text-xs text-aura-graphite-soft">Ainda não há avaliações registradas no pós-venda.</p> : <div className="mt-3 space-y-2">{rankingAvaliacoes.map((item, index) => <div key={item.nome} className="flex items-center gap-3 rounded-xl bg-aura-bg p-3"><span className="w-5 text-center text-xs font-bold text-aura-graphite-soft">{index + 1}</span><Users size={14} className="text-aura-petrol-600" /><span className="min-w-0 flex-1"><b className="block truncate text-xs text-aura-graphite">{item.nome}</b><span className="text-xs text-aura-graphite-soft">{item.notas} avaliações registradas</span></span><span className="font-data text-sm font-semibold text-aura-gold">{item.media.toFixed(1)} ★</span></div>)}</div>}<Link href="/pos-venda" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-aura-petrol-600 hover:underline">Abrir pós-venda <ArrowRight size={12} /></Link></div>
    </div>
  </section>;
}
