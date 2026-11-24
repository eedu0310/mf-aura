"use client";

import { useState, useMemo, useEffect } from "react";
import { Download, TrendingUp, Calendar, BarChart3, FileText } from "lucide-react";
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
import { ehFechada } from "@/lib/funil";
import { Botao, Card, CardHeader, EstadoVazio, Segmentado, Selo, StatCard } from "@/components/ui";

// Eixos e tooltip legíveis nos dois temas: o texto herda a cor do invólucro
// (text-aura-graphite-soft) e o fundo do tooltip acompanha a superfície.
const EIXO = { fill: "currentColor", fontSize: 11 };
const TOOLTIP = {
  background: "var(--aura-surface)",
  border: "1px solid var(--aura-mist)",
  borderRadius: 8,
  color: "var(--aura-graphite)",
  fontSize: 12,
};

interface DadosVenda {
  mes: string;
  vendido: number;
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
  const { vendas, oportunidades, funil } = useAppData();
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
  // Quanto o pipeline aberto tende a virar venda, pesando cada negócio pela
  // probabilidade. Substitui o antigo "Total Previsto", que era sempre R$ 0
  // porque não existe previsão cadastrada em lugar nenhum do sistema.
  const PESO: Record<string, number> = { Alta: 0.8, Média: 0.5, Baixa: 0.2 };
  const pipelinePonderado = (oportunidades ?? [])
    .filter((o) => !ehFechada(o.etapa, funil))
    .reduce((soma, o) => soma + o.valor * (PESO[o.probabilidade] ?? 0.5), 0);
  const negociosAbertos = (oportunidades ?? []).filter(
    (o) => !ehFechada(o.etapa, funil),
  ).length;
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          rotulo="Total Vendido"
          valor={formatarMoeda(totalVendido)}
          tom="marca"
          detalhe={
            <span className="text-aura-success">
              ↑ {comparativoMeses.length > 1 ? comparativoMeses[comparativoMeses.length - 1].percentual.toFixed(1) : 0}% vs mês anterior
            </span>
          }
        />

        <StatCard
          rotulo="Pipeline ponderado"
          valor={formatarMoeda(pipelinePonderado)}
          detalhe={
            negociosAbertos > 0
              ? `${negociosAbertos} negócio${negociosAbertos !== 1 ? "s" : ""} aberto${negociosAbertos !== 1 ? "s" : ""}, pesado pela probabilidade`
              : "Nenhum negócio aberto no pipeline"
          }
        />

        <StatCard
          rotulo="% Meta Atingida"
          valor={`${percentualMeta}%`}
          tom={totalMeta > 0 ? (Number(percentualMeta) >= 100 ? "sucesso" : "perigo") : "neutro"}
          detalhe={
            <span className={Number(percentualMeta) >= 100 ? "text-aura-success" : "text-aura-danger"}>
              {totalMeta > 0 ? (Number(percentualMeta) >= 100 ? "✓ Acima da meta" : "✗ Abaixo da meta") : "Meta não cadastrada"}
            </span>
          }
        />

        <StatCard rotulo="Ticket Médio" valor={formatarMoeda(ticketMedio)} detalhe="Por mês" />
      </div>

      {/* Filtro e Export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmentado
          rotulo="Período"
          opcoes={[
            { valor: "1m", rotulo: "Último mês" },
            { valor: "3m", rotulo: "Últimos 3 meses" },
            { valor: "6m", rotulo: "Últimos 6 meses" },
            { valor: "12m", rotulo: "Últimos 12 meses" },
          ]}
          valor={periodoSelecionado}
          aoMudar={setPeriodoSelecionado}
        />

        <Botao onClick={handleExportarExcel} icone={Download}>
          Exportar Excel
        </Botao>
      </div>

      {/* Gráfico Principal - Evolução de Vendas */}
      <Card>
        <CardHeader titulo="Evolução de Vendas" icone={BarChart3} />
        {dadosVendas.some((d) => d.vendido > 0) ? (
          <div className="text-aura-graphite-soft">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={dadosVendas}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--aura-mist)" />
                <XAxis dataKey="mes" tick={EIXO} stroke="var(--aura-mist)" />
                <YAxis tick={EIXO} stroke="var(--aura-mist)" />
                <Tooltip formatter={(value: any) => formatarMoeda(Number(value))} contentStyle={TOOLTIP} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="vendido"
                  stroke="#138780"
                  name="Vendido"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="meta"
                  stroke="#c99a33"
                  name="Meta"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EstadoVazio titulo="Sem dados de vendas" icone={BarChart3} />
        )}
      </Card>

      {/* Comparativo Mês a Mês */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gráfico Comparativo */}
        <Card>
          <CardHeader titulo="Comparativo Mês a Mês" icone={Calendar} />
          {comparativoMeses.some((d) => d.mesAtual > 0) ? (
            <div className="text-aura-graphite-soft">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparativoMeses}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--aura-mist)" />
                  <XAxis dataKey="mes" tick={EIXO} stroke="var(--aura-mist)" />
                  <YAxis tick={EIXO} stroke="var(--aura-mist)" />
                  <Tooltip
                    formatter={(value: any) => formatarMoeda(Number(value))}
                    contentStyle={TOOLTIP}
                    cursor={{ fill: "var(--aura-sunken)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="mesAnterior" fill="var(--aura-petrol-300)" name="Mês Anterior" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="mesAtual" fill="#138780" name="Mês Atual" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EstadoVazio titulo="Sem dados" icone={Calendar} />
          )}
        </Card>

        {/* Análise de Tendências */}
        <Card>
          <CardHeader titulo="Análise de Tendências" icone={TrendingUp} />
          <div className="space-y-2">
            {comparativoMeses.slice(1).map((item) => (
              <div key={item.mes} className="flex items-center justify-between rounded-lg bg-aura-sunken px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-aura-graphite">{item.mes}</p>
                  <p className="text-xs tabular-nums text-aura-graphite-soft">
                    {formatarMoeda(item.diferenca)}
                  </p>
                </div>
                <Selo tom={item.percentual >= 0 ? "sucesso" : "perigo"} className="tabular-nums">
                  {item.percentual >= 0 ? "↑" : "↓"}
                  {Math.abs(item.percentual).toFixed(1)}%
                </Selo>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Resumo Executivo */}
      <Card>
        <CardHeader titulo="Resumo Executivo" icone={FileText} className="mb-3" />
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
      </Card>
    </div>
  );
}
