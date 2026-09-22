"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Download,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  Users,
  DollarSign,
} from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { useUserProfile } from "@/lib/user-profile-context";
import { exportarExcel } from "@/lib/export-excel";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as PieChartComponent,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface FiltroRelatorio {
  dataInicio: string;
  dataFim: string;
  empresa?: string;
}

type AbaRelatorio =
  | "vendas"
  | "prospeccao"
  | "conversao"
  | "atividades"
  | "metricas"
  | "ranking"
  | "crescimento"
  | "projecao";

const CORES = ["#0F766E", "#C81E2C", "#C98500", "#111111", "#14B8A6"];

export function RelatorioComercial() {
  const { oportunidades, vendas, relacionamentos } = useAppData();
  const { profile } = useUserProfile();

  const [aba, setAba] = useState<AbaRelatorio>("vendas");
  const [filtro, setFiltro] = useState<FiltroRelatorio>({
    dataInicio: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    dataFim: new Date().toISOString().split("T")[0],
  });
  const [carregando, setCarregando] = useState(false);
  const [paginaVendas, setPaginaVendas] = useState(0);
  const itensPorPagina = 10;

  const dados = useMemo(() => {
    const vendasFiltradas = vendas.filter((v) => {
      const datavenda = new Date(v.data);
      const inicio = new Date(filtro.dataInicio);
      const fim = new Date(filtro.dataFim);
      const passouData = datavenda >= inicio && datavenda <= fim;
      return passouData;
    });

    const valorTotalVendido = vendasFiltradas.reduce((s, v) => s + v.valor, 0);
    const valorTotalPipeline = oportunidades.reduce((s, o) => s + o.valor, 0);
    const taxaConversao =
      oportunidades.length > 0
        ? (vendasFiltradas.length / oportunidades.length) * 100
        : 0;
    const ticketMedio =
      vendasFiltradas.length > 0
        ? valorTotalVendido / vendasFiltradas.length
        : 0;

    // Agrupar por cliente (vendedor)
    const vendedoresSet = new Set(vendasFiltradas.map((v) => v.cliente));
    const vendedores = Array.from(vendedoresSet);

    const dadosPorVendedor: Record<string, any> = {};
    vendedores.forEach((vendedor) => {
      const vendidas = vendasFiltradas.filter((v) => v.cliente === vendedor);
      const oportunidadesVendedor = oportunidades.filter(
        (o) => o.cliente === vendedor,
      );

      dadosPorVendedor[vendedor] = {
        nome: vendedor,
        vendas: vendidas.reduce((s, v) => s + v.valor, 0),
        quantidade: vendidas.length,
        oportunidades: oportunidadesVendedor.length,
        taxaConversao:
          oportunidadesVendedor.length > 0
            ? (vendidas.length / oportunidadesVendedor.length) * 100
            : 0,
        ticketMedio:
          vendidas.length > 0
            ? vendidas.reduce((s, v) => s + v.valor, 0) / vendidas.length
            : 0,
      };
    });

    return {
      vendasFiltradas,
      valorTotalVendido,
      valorTotalPipeline,
      taxaConversao,
      ticketMedio,
      dadosPorVendedor,
      vendedores,
    };
  }, [filtro, vendas, oportunidades]);

  const handleExportarExcel = async () => {
    setCarregando(true);
    try {
      const planilhas = [
        {
          nomePlanilha: "Vendas",
          dados: dados.vendasFiltradas.map((v) => ({
            Cliente: v.cliente,
            "Valor (R$)": v.valor,
            Data: new Date(v.data).toLocaleDateString("pt-BR"),
            Produto: v.produto || "N/A",
          })),
        },
        {
          nomePlanilha: "Resumo",
          dados: [
            { Métrica: "Faturamento Total", Valor: dados.valorTotalVendido },
            { Métrica: "Pipeline Total", Valor: dados.valorTotalPipeline },
            {
              Métrica: "Taxa de Conversão (%)",
              Valor: dados.taxaConversao.toFixed(1),
            },
            { Métrica: "Ticket Médio", Valor: dados.ticketMedio },
          ],
        },
        {
          nomePlanilha: "Vendedores",
          dados: Object.values(dados.dadosPorVendedor).map((v: any) => ({
            Vendedor: v.nome,
            "Faturamento (R$)": v.vendas,
            Quantidade: v.quantidade,
            "Ticket Médio (R$)": v.ticketMedio,
            "Taxa de Conversão (%)": v.taxaConversao.toFixed(1),
          })),
        },
      ];

      exportarExcel(planilhas, "relatorio-comercial");
    } finally {
      setCarregando(false);
    }
  };

  const abas: {
    id: AbaRelatorio;
    label: string;
    icon: React.ComponentType<{ size: number }>;
  }[] = [
    { id: "vendas", label: "Vendas", icon: TrendingUp },
    { id: "prospeccao", label: "Prospecção", icon: Users },
    { id: "conversao", label: "Conversão", icon: BarChart3 },
    { id: "atividades", label: "Atividades", icon: Activity },
    { id: "metricas", label: "Métricas", icon: DollarSign },
    { id: "ranking", label: "Ranking", icon: TrendingUp },
    { id: "crescimento", label: "Crescimento", icon: BarChart3 },
    { id: "projecao", label: "Projeção", icon: PieChart },
  ];

  // Dados para gráficos
  const chartVendasPorVendedor = {
    labels: dados.vendedores,
    datasets: [
      {
        label: "Faturamento",
        data: dados.vendedores.map((v) => dados.dadosPorVendedor[v].vendas),
        backgroundColor: CORES,
      },
    ],
  };

  const chartConversao = dados.vendedores.map((v) => ({
    nome: v,
    taxa: parseFloat(dados.dadosPorVendedor[v].taxaConversao.toFixed(1)),
  }));

  const chartDistribuicao = dados.vendedores.map((v) => ({
    name: v,
    value: parseFloat(
      (
        (dados.dadosPorVendedor[v].vendas / dados.valorTotalVendido) *
        100
      ).toFixed(1),
    ),
  }));

  // Paginação
  const vendasPaginadas = dados.vendasFiltradas.slice(
    paginaVendas * itensPorPagina,
    (paginaVendas + 1) * itensPorPagina,
  );
  const totalPaginas = Math.ceil(dados.vendasFiltradas.length / itensPorPagina);

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-display text-lg font-semibold text-aura-graphite">
            Relatórios Comerciais
          </p>
          <p className="text-sm text-aura-graphite-soft">
            Análise completa com 8 abas e gráficos interativos
          </p>
        </div>
        <button
          onClick={handleExportarExcel}
          disabled={carregando}
          className="flex items-center gap-2 rounded-lg bg-aura-petrol-700 px-4 py-2 text-sm font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-50"
        >
          <Download size={16} />
          Exportar Excel
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-6 grid grid-cols-1 gap-3 rounded-lg bg-aura-bg p-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-aura-graphite-soft">
            Data Início
          </label>
          <input
            type="date"
            value={filtro.dataInicio}
            onChange={(e) =>
              setFiltro({ ...filtro, dataInicio: e.target.value })
            }
            className="mt-1 w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-aura-graphite-soft">
            Data Fim
          </label>
          <input
            type="date"
            value={filtro.dataFim}
            onChange={(e) => setFiltro({ ...filtro, dataFim: e.target.value })}
            className="mt-1 w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Métricas */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-aura-mist bg-aura-bg p-4">
          <p className="text-xs text-aura-graphite-soft">Faturamento</p>
          <p className="mt-2 font-display text-xl font-bold text-aura-graphite">
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
              maximumFractionDigits: 0,
            }).format(dados.valorTotalVendido)}
          </p>
        </div>
        <div className="rounded-lg border border-aura-mist bg-aura-bg p-4">
          <p className="text-xs text-aura-graphite-soft">Pipeline</p>
          <p className="mt-2 font-display text-xl font-bold text-aura-graphite">
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
              maximumFractionDigits: 0,
            }).format(dados.valorTotalPipeline)}
          </p>
        </div>
        <div className="rounded-lg border border-aura-mist bg-aura-bg p-4">
          <p className="text-xs text-aura-graphite-soft">Conversão</p>
          <p className="mt-2 font-display text-xl font-bold text-aura-graphite">
            {dados.taxaConversao.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-lg border border-aura-mist bg-aura-bg p-4">
          <p className="text-xs text-aura-graphite-soft">Ticket Médio</p>
          <p className="mt-2 font-display text-xl font-bold text-aura-graphite">
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
              maximumFractionDigits: 0,
            }).format(dados.ticketMedio)}
          </p>
        </div>
      </div>

      {/* Abas */}
      <div className="mb-6 overflow-x-auto flex gap-2 border-b border-aura-mist">
        {abas.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => {
              setAba(id);
              setPaginaVendas(0);
            }}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition whitespace-nowrap ${
              aba === id
                ? "border-aura-petrol-600 text-aura-petrol-600"
                : "border-transparent text-aura-graphite-soft hover:text-aura-graphite"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div>
        {aba === "vendas" && (
          <div className="space-y-4">
            <p className="text-sm text-aura-graphite">
              Total: {dados.vendasFiltradas.length} vendas |
              <strong>
                {" "}
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(dados.valorTotalVendido)}
              </strong>
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-aura-mist">
                    <th className="px-4 py-2 text-left font-semibold text-aura-graphite">
                      Cliente
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-aura-graphite">
                      Valor
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-aura-graphite">
                      Data
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vendasPaginadas.map((venda, i) => (
                    <tr
                      key={i}
                      className="border-b border-aura-mist hover:bg-aura-bg"
                    >
                      <td className="px-4 py-2">{venda.cliente}</td>
                      <td className="px-4 py-2 text-right">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(venda.valor)}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-aura-graphite-soft">
                        {new Date(venda.data).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPaginas > 1 && (
              <div className="flex gap-2 justify-center mt-4">
                <button
                  onClick={() => setPaginaVendas(Math.max(0, paginaVendas - 1))}
                  disabled={paginaVendas === 0}
                  className="px-3 py-1 rounded border border-aura-mist disabled:opacity-50"
                >
                  ←
                </button>
                <span className="px-3 py-1">
                  {paginaVendas + 1} de {totalPaginas}
                </span>
                <button
                  onClick={() =>
                    setPaginaVendas(
                      Math.min(totalPaginas - 1, paginaVendas + 1),
                    )
                  }
                  disabled={paginaVendas === totalPaginas - 1}
                  className="px-3 py-1 rounded border border-aura-mist disabled:opacity-50"
                >
                  →
                </button>
              </div>
            )}
          </div>
        )}

        {aba === "prospeccao" && (
          <div className="space-y-4">
            <p className="text-sm text-aura-graphite">
              Total: <strong>{relacionamentos.length}</strong> relacionamentos
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-aura-mist">
                    <th className="px-4 py-2 text-left font-semibold text-aura-graphite">
                      Relacionamento
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-aura-graphite">
                      Categoria
                    </th>
                    <th className="px-4 py-2 text-left font-semibold text-aura-graphite">
                      Temperatura
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-aura-graphite">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {relacionamentos.slice(0, 20).map((rel, i) => (
                    <tr
                      key={i}
                      className="border-b border-aura-mist hover:bg-aura-bg"
                    >
                      <td className="px-4 py-2 font-medium">{rel.nome}</td>
                      <td className="px-4 py-2 text-xs">{rel.categoria}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                            rel.temperatura === "quente"
                              ? "bg-green-100 text-green-700"
                              : rel.temperatura === "ativo"
                                ? "bg-blue-100 text-blue-700"
                                : rel.temperatura === "esfriando"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : rel.temperatura === "frio"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {rel.temperatura}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(rel.valorGerado || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {aba === "conversao" && (
          <div className="space-y-6">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartConversao}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" />
                <YAxis />
                <Tooltip
                  formatter={(value: any) => `${Number(value).toFixed(1)}%`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="taxa"
                  stroke="#0F766E"
                  name="Taxa (%)"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {aba === "atividades" && (
          <div className="space-y-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={dados.vendedores.map((v) => ({
                  nome: v,
                  faturamento: dados.dadosPorVendedor[v].vendas,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" />
                <YAxis />
                <Tooltip
                  formatter={(value: any) =>
                    `R$ ${Number(value).toLocaleString("pt-BR")}`
                  }
                />
                <Bar dataKey="faturamento" fill="#0F766E" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {aba === "metricas" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {dados.vendedores.map((vendedor) => (
              <div
                key={vendedor}
                className="rounded-lg border border-aura-mist p-4"
              >
                <p className="font-semibold text-aura-graphite">{vendedor}</p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-aura-graphite-soft">
                      Faturamento:
                    </span>
                    <span className="font-medium">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                        maximumFractionDigits: 0,
                      }).format(dados.dadosPorVendedor[vendedor].vendas)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-aura-graphite-soft">Quantidade:</span>
                    <span className="font-medium">
                      {dados.dadosPorVendedor[vendedor].quantidade}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-aura-graphite-soft">
                      Ticket Médio:
                    </span>
                    <span className="font-medium">
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                        maximumFractionDigits: 0,
                      }).format(dados.dadosPorVendedor[vendedor].ticketMedio)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-aura-graphite-soft">Conversão:</span>
                    <span className="font-medium">
                      {dados.dadosPorVendedor[vendedor].taxaConversao.toFixed(
                        1,
                      )}
                      %
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {aba === "ranking" && (
          <div className="space-y-6">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={Object.values(dados.dadosPorVendedor)
                  .sort((a: any, b: any) => b.vendas - a.vendas)
                  .map((v: any) => ({
                    nome: v.nome,
                    faturamento: v.vendas,
                  }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" />
                <YAxis />
                <Tooltip
                  formatter={(value: any) =>
                    `R$ ${Number(value).toLocaleString("pt-BR")}`
                  }
                />
                <Bar dataKey="faturamento" fill="#0F766E" />
              </BarChart>
            </ResponsiveContainer>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-aura-mist">
                  <th className="px-4 py-2 text-left font-semibold text-aura-graphite">
                    Ranking
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-aura-graphite">
                    Vendedor
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-aura-graphite">
                    Faturamento
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-aura-graphite">
                    % Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.values(dados.dadosPorVendedor)
                  .sort((a: any, b: any) => b.vendas - a.vendas)
                  .map((vendedor: any, i) => (
                    <tr
                      key={i}
                      className="border-b border-aura-mist hover:bg-aura-bg"
                    >
                      <td className="px-4 py-2 font-bold text-aura-petrol-600">
                        #{i + 1}
                      </td>
                      <td className="px-4 py-2">{vendedor.nome}</td>
                      <td className="px-4 py-2 text-right">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                          maximumFractionDigits: 0,
                        }).format(vendedor.vendas)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {(
                          (vendedor.vendas / dados.valorTotalVendido) *
                          100
                        ).toFixed(1)}
                        %
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {aba === "crescimento" && (
          <div className="space-y-6">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartConversao}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" />
                <YAxis />
                <Tooltip
                  formatter={(value: any) => `${Number(value).toFixed(1)}%`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="taxa"
                  stroke="#0F766E"
                  name="Taxa (%)"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {aba === "projecao" && (
          <div className="space-y-6">
            <ResponsiveContainer width="100%" height={300}>
              <PieChartComponent>
                <Pie
                  data={chartDistribuicao}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartDistribuicao.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CORES[index % CORES.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) => `${Number(value).toFixed(1)}%`}
                />
              </PieChartComponent>
            </ResponsiveContainer>
            <div className="rounded-lg bg-aura-bg p-4">
              <p className="text-xs text-aura-graphite-soft">Projeção Anual</p>
              <p className="mt-2 font-display text-2xl font-bold text-aura-graphite">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  maximumFractionDigits: 0,
                }).format(
                  (dados.valorTotalVendido / (new Date().getMonth() + 1)) * 12,
                )}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
