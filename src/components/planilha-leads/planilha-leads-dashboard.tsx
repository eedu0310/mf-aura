"use client";


import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Download, Filter, TrendingUp } from "lucide-react";
import React from "react";

interface DadosVendedor {
  usuario_nome: string;
  usuario_id: string;
  indicador: string;
  semana1: number;
  semana2: number;
  semana3: number;
  semana4: number;
  tipo: string;
}

export function PlanilhaLeadsDashboard() {
  const [dados, setDados] = useState<DadosVendedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [vendedorFiltro, setVendedorFiltro] = useState("");

  const supabase = getSupabaseBrowserClient();

  // Carregar dados
  useEffect(() => {
    carregarDados();
  }, [mesSelecionado, anoSelecionado]);

  async function carregarDados() {
    if (!supabase) return;

    setCarregando(true);
    try {
      const [{ data, error }, { data: pessoas }] = await Promise.all([
        supabase
          .from("planilha_leads_indicadores")
          .select("*")
          .eq("mes", mesSelecionado)
          .eq("ano", anoSelecionado)
          .order("usuario_nome", { ascending: true }),
        supabase.from("profiles").select("id").eq("ativo", true),
      ]);

      if (error) throw error;

      // Conta desativada nao entra na planilha: as contas de teste ficavam
      // na tabela ao lado da equipe de verdade, e o "Total de Vendedores"
      // do resumo contava elas junto.
      const ativos = new Set(((pessoas ?? []) as { id: string }[]).map((p) => p.id));
      setDados((data || []).filter((d: DadosVendedor) => ativos.has(d.usuario_id)));
    } catch (erro) {
      console.error("Erro ao carregar dados:", erro);
    } finally {
      setCarregando(false);
    }
  }

  // Filtrar dados
  const dadosFiltrados = vendedorFiltro
    ? dados.filter((d) => d.usuario_nome.toLowerCase().includes(vendedorFiltro.toLowerCase()))
    : dados;

  // Agrupar por vendedor e indicador
  const agrupado = dadosFiltrados.reduce(
    (acc: Record<string, Record<string, DadosVendedor>>, item) => {
      if (!acc[item.usuario_nome]) {
        acc[item.usuario_nome] = {};
      }
      acc[item.usuario_nome][item.indicador] = item;
      return acc;
    },
    {}
  );

  // Lista única de indicadores
  const indicadores = Array.from(
    new Set(dadosFiltrados.map((d) => d.indicador))
  ).sort();

  // Exportar para Excel
  async function exportarExcel() {
    let csv = "Vendedor,";

    indicadores.forEach((ind) => {
      csv += `"${ind} (S1)","${ind} (S2)","${ind} (S3)","${ind} (S4)","${ind} (Total)",`;
    });

    csv = csv.slice(0, -1) + "\n";

    Object.entries(agrupado).forEach(([vendedor, items]) => {
      csv += `"${vendedor}",`;

      indicadores.forEach((ind) => {
        const item = items[ind];
        if (item) {
          const total = item.semana1 + item.semana2 + item.semana3 + item.semana4;
          csv += `${item.semana1},${item.semana2},${item.semana3},${item.semana4},${total},`;
        } else {
          csv += "0,0,0,0,0,";
        }
      });

      csv = csv.slice(0, -1) + "\n";
    });

    // Copiar para clipboard
    await navigator.clipboard.writeText(csv);
    alert("✅ Dados copiados para clipboard! Cole no Excel.");
  }

  return (
    <div className="space-y-6">
      
      {/* Filtros e Ações */}
      <div className="rounded-xl border border-aura-mist bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-aura-petrol-500" />
            <label className="text-sm font-medium text-aura-graphite">Mês:</label>
            <select
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(Number(e.target.value))}
              className="rounded border border-aura-mist px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-aura-petrol-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <option key={m} value={m}>
                  {new Date(2024, m - 1).toLocaleDateString("pt-BR", {
                    month: "long",
                  })}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-aura-graphite">Ano:</label>
            <select
              value={anoSelecionado}
              onChange={(e) => setAnoSelecionado(Number(e.target.value))}
              className="rounded border border-aura-mist px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-aura-petrol-500"
            >
              {[2023, 2024, 2025, 2026].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-aura-graphite">Vendedor:</label>
            <input
              type="text"
              value={vendedorFiltro}
              onChange={(e) => setVendedorFiltro(e.target.value)}
              placeholder="Buscar vendedor..."
              className="flex-1 rounded border border-aura-mist px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-aura-petrol-500"
            />
          </div>

          <button
            onClick={exportarExcel}
            className="ml-auto flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition"
          >
            <Download size={16} />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Tabela Principal */}
      {carregando ? (
        <div className="rounded-lg border border-aura-mist bg-white p-8 text-center">
          <p className="text-aura-graphite-soft">Carregando dados...</p>
        </div>
      ) : Object.keys(agrupado).length === 0 ? (
        <div className="rounded-lg border border-aura-mist bg-white p-8 text-center">
          <TrendingUp size={32} className="mx-auto mb-3 text-aura-graphite-soft" />
          <p className="text-aura-graphite-soft">
            Nenhum dado disponível para este período
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-aura-mist bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-xs">
            {/* Header */}
            <thead className="bg-aura-bg border-b border-aura-mist sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-aura-graphite min-w-[150px]">
                  Vendedor
                </th>
                {indicadores.map((ind) => (
                  <th
                    key={ind}
                    colSpan={5}
                    className="px-2 py-3 text-center font-semibold text-aura-graphite border-l border-aura-mist"
                  >
                    {ind}
                  </th>
                ))}
              </tr>
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-aura-graphite-soft text-xs"></th>
                {indicadores.map((ind) => (
                  <React.Fragment key={ind}>
                    <th className="px-1.5 py-2 text-center font-semibold text-aura-graphite-soft text-xs border-l border-aura-mist">
                      S1
                    </th>
                    <th className="px-1.5 py-2 text-center font-semibold text-aura-graphite-soft text-xs">
                      S2
                    </th>
                    <th className="px-1.5 py-2 text-center font-semibold text-aura-graphite-soft text-xs">
                      S3
                    </th>
                    <th className="px-1.5 py-2 text-center font-semibold text-aura-graphite-soft text-xs">
                      S4
                    </th>
                    <th className="px-1.5 py-2 text-center font-semibold text-aura-petrol-600 text-xs bg-aura-petrol-50">
                      ∑
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {Object.entries(agrupado).map(([vendedor, items]) => (
                <tr
                  key={vendedor}
                  className="border-b border-aura-mist hover:bg-aura-bg/50 transition"
                >
                  <td className="px-4 py-3 font-medium text-aura-graphite sticky left-0 bg-white hover:bg-aura-bg/50">
                    {vendedor}
                  </td>

                  {indicadores.map((ind) => {
                    const item = items[ind];
                    const total = item
                      ? item.semana1 + item.semana2 + item.semana3 + item.semana4
                      : 0;

                    return (
                      <React.Fragment key={ind}>
                        <td className="px-1.5 py-3 text-center text-aura-graphite border-l border-aura-mist">
                          {item?.semana1 || 0}
                        </td>
                        <td className="px-1.5 py-3 text-center text-aura-graphite">
                          {item?.semana2 || 0}
                        </td>
                        <td className="px-1.5 py-3 text-center text-aura-graphite">
                          {item?.semana3 || 0}
                        </td>
                        <td className="px-1.5 py-3 text-center text-aura-graphite">
                          {item?.semana4 || 0}
                        </td>
                        <td className="px-1.5 py-3 text-center font-bold text-aura-petrol-600 bg-aura-petrol-50">
                          {total}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Resumo */}
      {Object.keys(agrupado).length > 0 && (
        <div className="rounded-lg border border-aura-mist bg-white p-4">
          <p className="text-sm font-semibold text-aura-graphite mb-3">
            📈 Resumo
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg bg-aura-bg p-3">
              <p className="text-xs text-aura-graphite-soft">Total de Vendedores</p>
              <p className="text-lg font-bold text-aura-graphite">
                {Object.keys(agrupado).length}
              </p>
            </div>
            <div className="rounded-lg bg-aura-bg p-3">
              <p className="text-xs text-aura-graphite-soft">Indicadores Rastreados</p>
              <p className="text-lg font-bold text-aura-graphite">
                {indicadores.length}
              </p>
            </div>
            <div className="rounded-lg bg-aura-bg p-3">
              <p className="text-xs text-aura-graphite-soft">Período</p>
              <p className="text-lg font-bold text-aura-graphite">
                {new Date(anoSelecionado, mesSelecionado - 1).toLocaleDateString(
                  "pt-BR",
                  { month: "short", year: "numeric" }
                )}
              </p>
            </div>
            <div className="rounded-lg bg-green-50 p-3 border border-green-200">
              <p className="text-xs text-green-700">Última atualização</p>
              <p className="text-lg font-bold text-green-600">Hoje</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}