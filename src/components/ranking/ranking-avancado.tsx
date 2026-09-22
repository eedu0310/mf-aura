"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Target, Users, BarChart3 } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { buscarMetaDoMes } from "@/lib/supabase/metas";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export function RankingAvancado() {
  const { vendas, oportunidades, relacionamentos, atividades, nomesPorOwnerId } = useAppData();
  const [metaAtual, setMetaAtual] = useState<number | null>(null);
  const [mesSelecionado, setMesSelecionado] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    void buscarMetaDoMes().then(setMetaAtual);
  }, []);

  const todasVendas = useMemo(() => Array.isArray(vendas) ? vendas : [], [vendas]);
  const todasOportunidades = useMemo(() => Array.isArray(oportunidades) ? oportunidades : [], [oportunidades]);
  const todosRelacionamentos = useMemo(() => Array.isArray(relacionamentos) ? relacionamentos : [], [relacionamentos]);
  const todasAtividades = useMemo(() => Array.isArray(atividades) ? atividades : [], [atividades]);

  // ========== ANÁLISE AVANÇADA POR VENDEDOR ==========
  const analiseAvancada = useMemo(() => {
    const vendedoresMap: Record<string, any> = {};

    // Vendas: competência mensal e somente oportunidades ainda fechadas.
    const oportunidadesPorId = new Map(todasOportunidades.map((o) => [o.id, o]));
    const vendasDoMes = todasVendas.filter((v) => {
      if (!v.data?.startsWith(mesSelecionado)) return false;
      if (v.status === "aguardando_detalhes") return false;
      if (v.oportunidadeId) return oportunidadesPorId.get(v.oportunidadeId)?.etapa === "Fechados";
      return true;
    });
    vendasDoMes.forEach((v) => {
      const id = v.ownerId || "Sem ID";
      if (!vendedoresMap[id]) {
        vendedoresMap[id] = {
          id,
          nome: nomesPorOwnerId[id] || "Vendedor",
          vendas: 0,
          valorVendas: 0,
          oportunidades: 0,
          relacionamentos: 0,
          atividades: 0,
          metaAtingimento: 0,
        };
      }
      vendedoresMap[id].vendas += 1;
      vendedoresMap[id].valorVendas += v.valor || 0;
    });

    // Oportunidades
    todasOportunidades.forEach((o) => {
      const id = o.ownerId || "Sem ID";
      if (!vendedoresMap[id]) {
        vendedoresMap[id] = {
          id,
          nome: nomesPorOwnerId[id] || "Vendedor",
          vendas: 0,
          valorVendas: 0,
          oportunidades: 0,
          relacionamentos: 0,
          atividades: 0,
          metaAtingimento: 0,
        };
      }
      vendedoresMap[id].oportunidades += 1;
    });

    // Relacionamentos
    todosRelacionamentos.forEach((r) => {
      const id = r.ownerId || "Sem ID";
      if (!vendedoresMap[id]) {
        vendedoresMap[id] = {
          id,
          nome: nomesPorOwnerId[id] || "Vendedor",
          vendas: 0,
          valorVendas: 0,
          oportunidades: 0,
          relacionamentos: 0,
          atividades: 0,
          metaAtingimento: 0,
        };
      }
      vendedoresMap[id].relacionamentos += 1;
    });

    // Atividades
    todasAtividades.forEach((a) => {
      const id = a.ownerId || "Sem ID";
      if (!vendedoresMap[id]) {
        vendedoresMap[id] = {
          id,
          nome: nomesPorOwnerId[id] || "Vendedor",
          vendas: 0,
          valorVendas: 0,
          oportunidades: 0,
          relacionamentos: 0,
          atividades: 0,
          metaAtingimento: 0,
        };
      }
      vendedoresMap[id].atividades += 1;
    });

    // O ranking não inventa meta: ela precisa vir do cadastro real de metas.
    const META = metaAtual ?? 0;
    Object.keys(vendedoresMap).forEach((id) => {
      vendedoresMap[id].metaAtingimento = META > 0 ? (vendedoresMap[id].valorVendas / META) * 100 : 0;
    });

    return Object.values(vendedoresMap).sort((a: any, b: any) => b.valorVendas - a.valorVendas);
  }, [todasVendas, todasOportunidades, todosRelacionamentos, todasAtividades, nomesPorOwnerId, metaAtual, mesSelecionado]);

  // ========== DADOS PARA GRÁFICOS ==========
  const dadosGrafico = useMemo(() => {
    return analiseAvancada.map((v: any) => ({
      nome: v.nome.split(" ")[0], // Apenas primeiro nome para não poluir gráfico
      vendas: v.vendas,
      oportunidades: v.oportunidades,
    }));
  }, [analiseAvancada]);

  const dadosValor = useMemo(() => {
    return analiseAvancada.map((v: any) => ({
      nome: v.nome.split(" ")[0],
      valor: v.valorVendas,
    }));
  }, [analiseAvancada]);

  function formatarMoeda(valor: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(valor);
  }

  const totalVendido = analiseAvancada.reduce((sum: number, v: any) => sum + v.valorVendas, 0);
  const totalVendas = analiseAvancada.reduce((sum: number, v: any) => sum + v.vendas, 0);
  const totalOportunidades = analiseAvancada.reduce((sum: number, v: any) => sum + v.oportunidades, 0);
  const totalRelacionamentos = analiseAvancada.reduce((sum: number, v: any) => sum + v.relacionamentos, 0);

  return (
    <div className="space-y-6 pb-24">
      {/* KPIs Comparativos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-aura-mist bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={16} className="text-aura-petrol-600" />
            <p className="text-xs text-aura-graphite-soft">Total Vendido</p>
          </div>
          <p className="font-display text-xl font-bold text-aura-graphite">
            {formatarMoeda(totalVendido)}
          </p>
          <p className="mt-1 text-xs text-aura-graphite-soft">{totalVendas} vendas</p>
        </div>

        <div className="rounded-2xl border border-aura-mist bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-aura-petrol-600" />
            <p className="text-xs text-aura-graphite-soft">Total de Vendas</p>
          </div>
          <p className="font-display text-xl font-bold text-aura-graphite">
            {totalVendas}
          </p>
          <p className="mt-1 text-xs text-aura-graphite-soft">transações</p>
        </div>

        <div className="rounded-2xl border border-aura-mist bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} className="text-aura-petrol-600" />
            <p className="text-xs text-aura-graphite-soft">Oportunidades</p>
          </div>
          <p className="font-display text-xl font-bold text-aura-graphite">
            {totalOportunidades}
          </p>
          <p className="mt-1 text-xs text-aura-graphite-soft">em aberto</p>
        </div>

        <div className="rounded-2xl border border-aura-mist bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-aura-petrol-600" />
            <p className="text-xs text-aura-graphite-soft">Relacionamentos</p>
          </div>
          <p className="font-display text-xl font-bold text-aura-graphite">
            {totalRelacionamentos}
          </p>
          <p className="mt-1 text-xs text-aura-graphite-soft">gerenciados</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-aura-mist bg-white p-4">
        <div>
          <p className="text-sm font-semibold text-aura-graphite">Competência do ranking</p>
          <p className="text-xs text-aura-graphite-soft">Somente vendas fechadas neste mês entram no faturamento.</p>
        </div>
        <input type="month" value={mesSelecionado} onChange={(event) => setMesSelecionado(event.target.value)} className="rounded-xl border border-aura-mist px-3 py-2 text-sm text-aura-graphite" aria-label="Mês do ranking" />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Vendas vs Oportunidades */}
        {dadosGrafico.some((d: any) => d.vendas > 0 || d.oportunidades > 0) && (
          <div className="rounded-2xl border border-aura-mist bg-white p-6">
            <p className="mb-4 font-semibold text-aura-graphite">Vendas vs Oportunidades</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosGrafico}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
                <XAxis dataKey="nome" stroke="#999" />
                <YAxis stroke="#999" />
                <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e8e8e8" }} />
                <Legend />
                <Bar dataKey="vendas" fill="#0F766E" name="Vendas" />
                <Bar dataKey="oportunidades" fill="#14B8A6" name="Oportunidades" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Valor de Vendas */}
        {dadosValor.some((d: any) => d.valor > 0) && (
          <div className="rounded-2xl border border-aura-mist bg-white p-6">
            <p className="mb-4 font-semibold text-aura-graphite">Valor de Vendas por Vendedor</p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dadosValor}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />
                <XAxis dataKey="nome" stroke="#999" />
                <YAxis stroke="#999" />
                <Tooltip
                  formatter={(value) => formatarMoeda(value as number)}
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #e8e8e8" }}
                />
                <Line type="monotone" dataKey="valor" stroke="#0F766E" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Ranking Detalhado */}
      <div className="rounded-2xl border border-aura-mist bg-white p-6">
        <p className="mb-4 text-lg font-semibold text-aura-graphite">Análise Detalhada por Vendedor</p>
        {analiseAvancada.length > 0 ? (
          <div className="space-y-4">
            {analiseAvancada.map((v: any, idx: number) => (
              <div key={v.id} className="rounded-lg border border-aura-mist bg-aura-bg p-4 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-aura-graphite">
                      {idx + 1}. {v.nome}
                    </p>
                    <p className="text-sm text-aura-graphite-soft">
                      {v.vendas} vendas • {v.oportunidades} oportunidades • {v.relacionamentos} relacionamentos • {v.atividades} atividades
                    </p>
                  </div>
                  <p className="font-display text-2xl font-bold text-aura-graphite">
                    {formatarMoeda(v.valorVendas)}
                  </p>
                </div>
                {metaAtual && metaAtual > 0 ? (
                  <>
                    <div className="h-3 w-full overflow-hidden rounded-lg bg-aura-mist">
                      <div
                        className={`h-full transition-all ${
                          v.metaAtingimento >= 100 ? "bg-aura-success" : "bg-aura-warning"
                        }`}
                        style={{ width: `${Math.min(v.metaAtingimento, 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-aura-graphite-soft">
                      {v.metaAtingimento.toFixed(1)}% da meta cadastrada
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-aura-graphite-soft">Meta não cadastrada para este período.</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-aura-graphite-soft py-8">Sem dados de vendas</p>
        )}
      </div>
    </div>
  );
}
