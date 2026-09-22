"use client";

import { useState, useMemo, useEffect } from "react";
import { Download, TrendingUp, Calendar, BarChart3 } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useAppData } from "@/lib/app-data-context";
import { exportarExcel } from "@/lib/export-excel";
import { parseDataLocal } from "@/lib/date-local";
import { buscarMetaDoMes } from "@/lib/supabase/metas";

interface DadosVenda {
  mes: string;
  vendido: number;
  previsto: number;
  meta: number;
}

interface ComparativoMeses {
  mes: string;
  mesAnterior: number;
  mesAtual: number;
  diferenca: number;
  percentual: number;
}

export function RelatóriosAvançados() {
  const { vendas } = useAppData();
  const [periodoSelecionado, setPeriodoSelecionado] = useState("6m");
  const [metaAtual, setMetaAtual] = useState<number | null>(null);

  const todasVendas = Array.isArray(vendas) ? vendas : [];

  useEffect(() => {
    void buscarMetaDoMes().then(setMetaAtual);
  }, []);

  // ========== PROCESSAR DADOS REAIS ==========
  const dadosVendas = useMemo((): DadosVenda[] => {
    const meses = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const agora = new Date();
    const mesesProcessados: DadosVenda[] = [];

    const quantidadeMeses = periodoSelecionado === "1m" ? 1 : periodoSelecionado === "3m" ? 3 : periodoSelecionado === "6m" ? 6 : 12;
    for (let i = quantidadeMeses - 1; i >= 0; i--) {
      const dataFim = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const dataInicio = new Date(dataFim.getFullYear(), dataFim.getMonth(), 1);
      const proximoMes = new Date(dataFim.getFullYear(), dataFim.getMonth() + 1, 1);

      const mesNome = meses[dataInicio.getMonth()];
      
      const vendidoMes = todasVendas
        .filter((v) => {
          const dataVenda = parseDataLocal(v.data);
          return dataVenda >= dataInicio && dataVenda < proximoMes;
        })
        .reduce((sum, v) => sum + (v.valor || 0), 0);

      mesesProcessados.push({
        mes: mesNome,
        vendido: vendidoMes,
        previsto: 0,
        meta: i === 0 ? (metaAtual ?? 0) : 0,
      });
    }

    return mesesProcessados;
  }, [todasVendas, periodoSelecionado, metaAtual]);

  const comparativoMeses = useMemo((): ComparativoMeses[] => {
    return dadosVendas.map((atual, idx) => {
      const mesAnterior = idx > 0 ? dadosVendas[idx - 1].vendido : 0;
      const diferenca = atual.vendido - mesAnterior;
      const percentual = mesAnterior > 0 ? ((diferenca / mesAnterior) * 100) : 0;

      return {
        mes: atual.mes,
        mesAnterior,
        mesAtual: atual.vendido,
        diferenca,
        percentual,
      };
    });
  }, [dadosVendas]);

  function handleExportarExcel() {
    const planilhas = [
      {
        nomePlanilha: "Vendas",
        dados: dadosVendas.map((d) => ({
          "Mês": d.mes,
          "Vendido (R$)": d.vendido,
          "Previsto (R$)": d.previsto,
          "Meta (R$)": d.meta,
          "% Meta": d.meta > 0 ? ((d.vendido / d.meta) * 100).toFixed(1) : "Não cadastrada",
        })),
      },
      {
        nomePlanilha: "Comparativo",
        dados: comparativoMeses.map((c) => ({
          "Mês": c.mes,
          "Mês Anterior (R$)": c.mesAnterior,
          "Mês Atual (R$)": c.mesAtual,
          "Diferença (R$)": c.diferenca,
          "Variação %": c.percentual.toFixed(1),
        })),
      },
    ];

    exportarExcel(planilhas, "relatorio-vendas");
  }

  const totalVendido = dadosVendas.reduce((s, d) => s + d.vendido, 0);
  const totalPrevisto = dadosVendas.reduce((s, d) => s + d.previsto, 0);
  const totalMeta = dadosVendas.reduce((s, d) => s + d.meta, 0);
  const percentualMeta = totalMeta > 0 ? ((totalVendido / totalMeta) * 100).toFixed(1) : "0";
  const ticketMedio = dadosVendas.length > 0 ? (totalVendido / dadosVendas.length) : 0;

  function formatarMoeda(valor: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(valor);
  }

  return (
    <div className="space-y-6">
      {/* Header com KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <p className="text-sm text-aura-graphite-soft">Total Vendido</p>
          <p className="mt-2 font-display text-2xl font-bold text-aura-graphite">
            {formatarMoeda(totalVendido)}
          </p>
          <p className="mt-1 text-xs text-green-600">
            ↑ {comparativoMeses.length > 1 ? comparativoMeses[comparativoMeses.length - 1].percentual.toFixed(1) : 0}% vs mês anterior
          </p>
        </div>

        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <p className="text-sm text-aura-graphite-soft">Total Previsto</p>
          <p className="mt-2 font-display text-2xl font-bold text-aura-graphite">
            {formatarMoeda(totalPrevisto)}
          </p>
          <p className="mt-1 text-xs text-blue-600">
            {totalPrevisto > 0 ? `${((totalVendido / totalPrevisto) * 100).toFixed(0)}% do previsto` : "Sem previsão cadastrada"}
          </p>
        </div>

        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <p className="text-sm text-aura-graphite-soft">% Meta Atingida</p>
          <p className="mt-2 font-display text-2xl font-bold text-aura-graphite">
            {percentualMeta}%
          </p>
          <p className={`mt-1 text-xs ${Number(percentualMeta) >= 100 ? "text-green-600" : "text-red-600"}`}>
            {totalMeta > 0 ? (Number(percentualMeta) >= 100 ? "✓ Acima da meta" : "✗ Abaixo da meta") : "Meta não cadastrada"}
          </p>
        </div>

        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <p className="text-sm text-aura-graphite-soft">Ticket Médio</p>
          <p className="mt-2 font-display text-2xl font-bold text-aura-graphite">
            {formatarMoeda(ticketMedio)}
          </p>
          <p className="mt-1 text-xs text-aura-graphite-soft">Por mês</p>
        </div>
      </div>

      {/* Filtro e Export */}
      <div className="flex items-center justify-between rounded-2xl border border-aura-mist bg-white p-4">
        <div className="flex gap-2">
          {["1m", "3m", "6m", "12m"].map((periodo) => (
            <button
              key={periodo}
              onClick={() => setPeriodoSelecionado(periodo)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                periodoSelecionado === periodo
                  ? "bg-aura-petrol-600 text-white"
                  : "border border-aura-mist text-aura-graphite hover:border-aura-petrol-300"
              }`}
            >
              {periodo === "1m" && "Último mês"}
              {periodo === "3m" && "Últimos 3 meses"}
              {periodo === "6m" && "Últimos 6 meses"}
              {periodo === "12m" && "Últimos 12 meses"}
            </button>
          ))}
        </div>

        <button
          onClick={handleExportarExcel}
          className="flex items-center gap-2 rounded-lg bg-aura-petrol-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-aura-petrol-700"
        >
          <Download size={16} />
          Exportar Excel
        </button>
      </div>

      {/* Gráfico Principal - Evolução de Vendas */}
      <div className="rounded-2xl border border-aura-mist bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 size={18} className="text-aura-petrol-600" />
          <p className="font-medium text-aura-graphite">Evolução de Vendas</p>
        </div>
        {dadosVendas.some((d) => d.vendido > 0) ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={dadosVendas}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip formatter={(value: any) => formatarMoeda(Number(value))} />
              <Legend />
              <Line
                type="monotone"
                dataKey="vendido"
                stroke="#0F766E"
                name="Vendido"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="previsto"
                stroke="#14B8A6"
                name="Previsto"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="meta"
                stroke="#F59E0B"
                name="Meta"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-sm text-aura-graphite-soft py-8">Sem dados de vendas</p>
        )}
      </div>

      {/* Comparativo Mês a Mês */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gráfico Comparativo */}
        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Calendar size={18} className="text-aura-petrol-600" />
            <p className="font-medium text-aura-graphite">Comparativo Mês a Mês</p>
          </div>
          {comparativoMeses.some((d) => d.mesAtual > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparativoMeses}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatarMoeda(Number(value))} />
                <Legend />
                <Bar dataKey="mesAnterior" fill="#14B8A6" name="Mês Anterior" />
                <Bar dataKey="mesAtual" fill="#0F766E" name="Mês Atual" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-sm text-aura-graphite-soft py-8">Sem dados</p>
          )}
        </div>

        {/* Análise de Tendências */}
        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-aura-petrol-600" />
            <p className="font-medium text-aura-graphite">Análise de Tendências</p>
          </div>
          <div className="space-y-3">
            {comparativoMeses.slice(1).map((item) => (
              <div key={item.mes} className="flex items-center justify-between rounded-lg bg-aura-bg p-3">
                <div>
                  <p className="text-sm font-medium text-aura-graphite">{item.mes}</p>
                  <p className="text-xs text-aura-graphite-soft">
                    {formatarMoeda(item.diferenca)}
                  </p>
                </div>
                <div
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                    item.percentual >= 0
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {item.percentual >= 0 ? "↑" : "↓"}
                  {Math.abs(item.percentual).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resumo Executivo */}
      <div className="rounded-2xl border border-aura-mist bg-aura-bg p-5">
        <p className="mb-3 font-medium text-aura-graphite">Resumo Executivo</p>
        <div className="space-y-2 text-sm text-aura-graphite">
          <p>
            <span className="font-medium">Desempenho:</span> Você vendeu {formatarMoeda(totalVendido)} no período, atingindo {percentualMeta}% da meta.
          </p>
          <p>
            <span className="font-medium">Tendência:</span> {
              comparativoMeses.length > 1
                ? (comparativoMeses[comparativoMeses.length - 1].percentual > 0
                    ? "Crescimento consistente"
                    : "Redução nas vendas")
                : "Dados insuficientes"
            }
          </p>
          <p>
            <span className="font-medium">Previsão:</span> {
              Number(percentualMeta) >= 100
                ? "Mantendo o ritmo, as metas dos próximos meses devem ser atingidas."
                : "É necessário aumentar os esforços para atingir as metas."
            }
          </p>
        </div>
      </div>
    </div>
  );
}
