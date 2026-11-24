"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Star, Users } from "lucide-react";
import type { Atividade, Oportunidade, Relacionamento, Venda } from "@/lib/types";
import { listarPosVendas, type PosVenda } from "@/lib/supabase/pos-venda";
import { useAppData } from "@/lib/app-data-context";
import { ehFechada } from "@/lib/funil";
import { Card, CardHeader, Selo, StatCard } from "@/components/ui";

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

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-aura-graphite">AURA Manager</h2>
          <p className="mt-0.5 text-xs text-aura-graphite-soft">Radar derivado dos mesmos dados do CRM, sem uma segunda base de informações.</p>
        </div>
        <Selo tom="marca">{atividades.length} atividades carregadas</Selo>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard rotulo="Oportunidades abertas" valor={oportunidades.filter((o) => !ehFechada(o.etapa, funil)).length} detalhe={moeda(valorAberto)} />
        <StatCard rotulo="Relacionamentos" valor={relacionamentos.length} />
        <StatCard rotulo="Pós-vendas avaliados" valor={vendasComAvaliacao} detalhe={`${taxaAvaliacao}% dos registros`} />
        <StatCard rotulo="Vendas no escopo" valor={vendas.length} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader titulo="Radar Comercial" icone={AlertTriangle} corIcone="text-aura-warning" acoes={<Selo tom="atencao">{radar.length}</Selo>} />
          {radar.length === 0 ? (
            <p className="flex items-center gap-2 text-xs text-aura-graphite-soft"><CheckCircle2 size={14} className="text-aura-success" /> Nenhuma prioridade crítica identificada.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {radar.map((item) => (
                <Link key={item.id} href={item.href} className="flex items-start gap-2.5 rounded-lg border border-aura-mist p-3 transition hover:bg-aura-sunken">
                  <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${item.nivel === "alta" ? "text-aura-danger" : "text-aura-warning"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-aura-graphite">{item.titulo}</span>
                    <span className="mt-1 block text-xs text-aura-graphite-soft">{item.descricao}</span>
                  </span>
                  <ArrowRight size={13} className="mt-1 shrink-0 text-aura-graphite-soft" />
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardHeader titulo="Ranking de avaliações" icone={Star} corIcone="text-aura-gold" acoes={<span className="text-xs text-aura-graphite-soft">por empresa</span>} />
          {rankingAvaliacoes.length === 0 ? (
            <p className="text-xs text-aura-graphite-soft">Ainda não há avaliações registradas no pós-venda.</p>
          ) : (
            <div className="flex flex-col divide-y divide-aura-mist">
              {rankingAvaliacoes.map((item, index) => (
                <div key={item.nome} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="w-5 text-center text-xs font-semibold tabular-nums text-aura-graphite-soft">{index + 1}</span>
                  <Users size={14} className="text-aura-petrol-600" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-aura-graphite">{item.nome}</span>
                    <span className="text-xs text-aura-graphite-soft">{item.notas} avaliações registradas</span>
                  </span>
                  <span className="font-data text-sm font-semibold text-aura-gold-700">{item.media.toFixed(1)} ★</span>
                </div>
              ))}
            </div>
          )}
          <Link href="/pos-venda" className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-aura-petrol-600 hover:underline">Abrir pós-venda <ArrowRight size={12} /></Link>
        </Card>
      </div>
    </section>
  );
}
