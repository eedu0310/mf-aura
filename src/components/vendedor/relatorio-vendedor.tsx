"use client";

import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface VendaData {
  mes: string;
  individual: number;
  compartilhada: number;
  total: number;
}

interface AtividadeData {
  tipo: string;
  quantidade: number;
}

export function RelatorioVendedor() {
  const { vendas, oportunidades, atividades } = useAppData();
  const [carregando, setCarregando] = useState(false);

  const todasVendas = Array.isArray(vendas) ? vendas : [];
  const todasOportunidades = Array.isArray(oportunidades) ? oportunidades : [];
  const todasAtividades = Array.isArray(atividades) ? atividades : [];

  // ========== PROCESSAR VENDAS POR MÊS ==========
  const vendasPorMes = useMemo((): VendaData[] => {
    const meses = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];

    const agora = new Date();
    const dadosMeses: VendaData[] = [];

    for (let i = 3; i >= 0; i--) {
      const dataFim = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const dataInicio = new Date(dataFim.getFullYear(), dataFim.getMonth(), 1);
      const proximoMes = new Date(
        dataFim.getFullYear(),
        dataFim.getMonth() + 1,
        1,
      );

      const mesNome = meses[dataInicio.getMonth()];

      // Simular individual vs compartilhada (80% individual, 20% compartilhada)
      const vendidoMes = todasVendas
        .filter((v) => {
          const dataVenda = new Date(v.data);
          return dataVenda >= dataInicio && dataVenda < proximoMes;
        })
        .reduce((sum, v) => sum + (v.valor || 0), 0);

      const individual = Math.floor(vendidoMes * 0.8);
      const compartilhada = Math.floor(vendidoMes * 0.2);

      dadosMeses.push({
        mes: mesNome,
        individual,
        compartilhada,
        total: vendidoMes,
      });
    }

    return dadosMeses;
  }, [todasVendas]);

  // ========== CONTAR ATIVIDADES POR TIPO ==========
  const atividadesPorTipo = useMemo((): AtividadeData[] => {
    const tiposContagem: Record<string, number> = {};

    todasAtividades.forEach((a) => {
      const tipo = a.tipo || "Outro";
      tiposContagem[tipo] = (tiposContagem[tipo] || 0) + 1;
    });

    return Object.entries(tiposContagem)
      .map(([tipo, quantidade]) => ({ tipo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);
  }, [todasAtividades]);

  // ========== MÉTRICAS ==========
  const totalVendido = todasVendas.reduce((sum, v) => sum + (v.valor || 0), 0);
  const metaAnual = 0;
  const percentualMeta = metaAnual > 0 ? (totalVendido / metaAnual) * 100 : 0;
  const totalIndividual = vendasPorMes.reduce(
    (sum, v) => sum + v.individual,
    0,
  );
  const totalCompartilhada = vendasPorMes.reduce(
    (sum, v) => sum + v.compartilhada,
    0,
  );
  const ticketMedio =
    todasVendas.length > 0 ? totalVendido / todasVendas.length : 0;
  const oportunidadesAbertas = todasOportunidades.filter(
    (o) => o.etapa !== "Fechados" && o.etapa !== "Perdidos",
  ).length;

  const exportarPDF = async () => {
    setCarregando(true);
    const elemento = document.getElementById("relatorio-pdf");

    if (!elemento) {
      console.error("Elemento não encontrado");
      setCarregando(false);
      return;
    }

    const options = {
      margin: 10,
      filename: "relatorio-vendedor.pdf",
      image: { type: "png" as const, quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: {
        orientation: "portrait" as const,
        unit: "mm" as const,
        format: "a4",
      },
    };

    try {
      const html2pdfModule = await import("html2pdf.js");
      const html2pdf = html2pdfModule.default;
      await html2pdf().set(options).from(elemento).save();
    } catch (erro) {
      console.error("Erro ao gerar PDF:", erro);
    } finally {
      setCarregando(false);
    }
  };

  function formatarMoeda(valor: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(valor);
  }

  return (
    <div className="space-y-6 pb-24">
      <button
        onClick={exportarPDF}
        disabled={carregando}
        className="flex items-center gap-2 rounded-lg bg-aura-petrol-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-aura-petrol-700 disabled:opacity-50"
      >
        {carregando ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Download size={18} />
        )}
        {carregando ? "Gerando PDF..." : "Exportar PDF"}
      </button>

      <div
        id="relatorio-pdf"
        className="space-y-6 rounded-2xl border border-aura-mist bg-white p-6"
      >
        {/* Header */}
        <div className="border-b border-aura-mist pb-6">
          <h1 className="font-display text-2xl font-bold text-aura-graphite">
            Relatório do Vendedor
          </h1>
          <p className="text-sm text-aura-graphite-soft">
            {new Date().toLocaleString("pt-BR", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-aura-mist bg-aura-bg p-4">
            <p className="text-xs text-aura-graphite-soft">Total Vendido</p>
            <p className="mt-1 font-display text-xl font-bold text-aura-graphite">
              {formatarMoeda(totalVendido)}
            </p>
            <p className="mt-1 text-xs text-aura-graphite-soft">
              {todasVendas.length} vendas
            </p>
          </div>
          <div className="rounded-lg border border-aura-mist bg-aura-bg p-4">
            <p className="text-xs text-aura-graphite-soft">Meta Anual</p>
            <p className="mt-1 font-display text-xl font-bold text-aura-graphite">
              {formatarMoeda(metaAnual)}
            </p>
            <p className="mt-1 text-xs text-aura-graphite-soft">
              Alvo para 2024
            </p>
          </div>
          <div className="rounded-lg border border-aura-mist bg-aura-bg p-4">
            <p className="text-xs text-aura-graphite-soft">% Meta</p>
            <p
              className={`mt-1 font-display text-xl font-bold ${
                percentualMeta >= 100
                  ? "text-aura-success"
                  : "text-aura-warning"
              }`}
            >
              {percentualMeta.toFixed(1)}%
            </p>
            <p className="mt-1 text-xs text-aura-graphite-soft">
              {percentualMeta >= 100 ? "✓ Acima" : "⊘ Abaixo"}
            </p>
          </div>
        </div>

        {/* Métricas adicionais */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-aura-mist bg-aura-bg p-4">
            <p className="text-xs text-aura-graphite-soft">Ticket Médio</p>
            <p className="mt-1 font-display text-lg font-bold text-aura-graphite">
              {formatarMoeda(ticketMedio)}
            </p>
          </div>
          <div className="rounded-lg border border-aura-mist bg-aura-bg p-4">
            <p className="text-xs text-aura-graphite-soft">
              Oportunidades Abertas
            </p>
            <p className="mt-1 font-display text-lg font-bold text-aura-graphite">
              {oportunidadesAbertas}
            </p>
          </div>
          <div className="rounded-lg border border-aura-mist bg-aura-bg p-4">
            <p className="text-xs text-aura-graphite-soft">
              Total de Atividades
            </p>
            <p className="mt-1 font-display text-lg font-bold text-aura-graphite">
              {todasAtividades.length}
            </p>
          </div>
        </div>

        {/* Gráfico de Evolução */}
        <div className="space-y-2">
          <p className="font-medium text-aura-graphite">Evolução de Vendas</p>
          {vendasPorMes.some((v) => v.total > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={vendasPorMes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip formatter={(value) => formatarMoeda(Number(value))} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="individual"
                  stroke="#0F766E"
                  name="Individual"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="compartilhada"
                  stroke="#14B8A6"
                  name="Compartilhada"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-sm text-aura-graphite-soft py-8">
              Sem dados de vendas
            </p>
          )}
        </div>

        {/* Gráfico de Progresso */}
        <div className="space-y-2">
          <p className="font-medium text-aura-graphite">Faturamento vs Meta</p>
          <div className="w-full bg-aura-mist rounded-lg h-3 overflow-hidden">
            <div
              className={`h-full transition-all ${
                percentualMeta >= 100 ? "bg-aura-success" : "bg-aura-warning"
              }`}
              style={{ width: `${Math.min(percentualMeta, 100)}%` }}
            />
          </div>
          <p className="text-xs text-aura-graphite-soft">
            {formatarMoeda(totalVendido)} de {formatarMoeda(metaAnual)}
          </p>
        </div>

        {/* Gráfico de Pizza */}
        {(totalIndividual > 0 || totalCompartilhada > 0) && (
          <div className="space-y-2">
            <p className="font-medium text-aura-graphite">
              Distribuição (Individual vs Compartilhada)
            </p>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Individual", value: totalIndividual },
                    { name: "Compartilhada", value: totalCompartilhada },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) =>
                    `${name}: ${formatarMoeda(value)}`
                  }
                  outerRadius={80}
                  fill="#0F766E"
                  dataKey="value"
                >
                  <Cell fill="#0F766E" />
                  <Cell fill="#14B8A6" />
                </Pie>
                <Tooltip formatter={(value) => formatarMoeda(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Gráfico de Atividades */}
        {atividadesPorTipo.length > 0 && (
          <div className="space-y-2">
            <p className="font-medium text-aura-graphite">
              Atividades Realizadas
            </p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={atividadesPorTipo}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tipo" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantidade" fill="#0F766E" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Resumo Executivo */}
        <div className="space-y-3 rounded-lg bg-aura-bg p-4">
          <p className="font-medium text-aura-graphite">Resumo Executivo</p>
          <ul className="space-y-2 text-sm text-aura-graphite-soft">
            <li>✓ Total de vendas: {formatarMoeda(totalVendido)}</li>
            <li>
              ✓ Atingimento de meta: {percentualMeta.toFixed(1)}%{" "}
              {percentualMeta >= 100 ? "✓" : "⊘"}
            </li>
            <li>✓ Total de atividades: {todasAtividades.length}</li>
            <li>✓ Ticket médio: {formatarMoeda(ticketMedio)}</li>
            <li>✓ Oportunidades em aberto: {oportunidadesAbertas}</li>
            <li>✓ Vendas individuais: {formatarMoeda(totalIndividual)}</li>
            <li>
              ✓ Vendas compartilhadas: {formatarMoeda(totalCompartilhada)}
            </li>
          </ul>
        </div>

        {/* Rodapé */}
        <div className="border-t border-aura-mist pt-6 text-center text-xs text-aura-graphite-soft">
          <p>Relatório gerado em {new Date().toLocaleString("pt-BR")}</p>
          <p>AURA Sales OS - Alta performance não acontece por acaso.</p>
        </div>
      </div>
    </div>
  );
}
