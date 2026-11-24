"use client";


import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Download, Filter, TrendingUp } from "lucide-react";
import React from "react";
import { EstadoVazio, StatCard, classeBotao } from "@/components/ui";

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
    <div className="flex flex-col gap-6">
      {/* Filtros e Ações */}
      <div className="aura-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label className="aura-label flex items-center gap-1.5">
              <Filter size={13} className="text-aura-graphite-soft" />
              Mês:
            </label>
            <select
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(Number(e.target.value))}
              className="aura-input w-40 capitalize"
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

          <div className="flex flex-col">
            <label className="aura-label">Ano:</label>
            <select
              value={anoSelecionado}
              onChange={(e) => setAnoSelecionado(Number(e.target.value))}
              className="aura-input w-28"
            >
              {[2023, 2024, 2025, 2026].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-w-[200px] flex-1 flex-col">
            <label className="aura-label">Vendedor:</label>
            <input
              type="text"
              value={vendedorFiltro}
              onChange={(e) => setVendedorFiltro(e.target.value)}
              placeholder="Buscar vendedor..."
              className="aura-input"
            />
          </div>

          <button onClick={exportarExcel} className={classeBotao("secundario", "md", "ml-auto")}>
            <Download size={15} className="text-aura-success" />
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Tabela Principal */}
      {carregando ? (
        <div className="aura-card p-8 text-center">
          <p className="text-sm text-aura-graphite-soft">Carregando dados...</p>
        </div>
      ) : Object.keys(agrupado).length === 0 ? (
        <EstadoVazio icone={TrendingUp} titulo="Nenhum dado disponível para este período" />
      ) : (
        <div className="aura-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              {/* Header */}
              <thead className="sticky top-0 border-b border-aura-mist bg-aura-sunken">
                <tr>
                  <th className="sticky left-0 min-w-[150px] bg-aura-sunken px-4 py-3 text-left font-semibold text-aura-graphite">
                    Vendedor
                  </th>
                  {indicadores.map((ind) => (
                    <th
                      key={ind}
                      colSpan={5}
                      className="border-l border-aura-mist px-2 py-3 text-center font-semibold text-aura-graphite"
                    >
                      {ind}
                    </th>
                  ))}
                </tr>
                <tr className="border-t border-aura-mist">
                  <th className="sticky left-0 bg-aura-sunken px-4 py-2 text-left text-xs font-medium text-aura-graphite-soft"></th>
                  {indicadores.map((ind) => (
                    <React.Fragment key={ind}>
                      <th className="border-l border-aura-mist px-1.5 py-2 text-center text-xs font-medium text-aura-graphite-soft">
                        S1
                      </th>
                      <th className="px-1.5 py-2 text-center text-xs font-medium text-aura-graphite-soft">
                        S2
                      </th>
                      <th className="px-1.5 py-2 text-center text-xs font-medium text-aura-graphite-soft">
                        S3
                      </th>
                      <th className="px-1.5 py-2 text-center text-xs font-medium text-aura-graphite-soft">
                        S4
                      </th>
                      <th className="bg-aura-petrol-500/10 px-1.5 py-2 text-center text-xs font-semibold text-aura-petrol-600">
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
                    className="group border-b border-aura-mist transition last:border-0 hover:bg-aura-sunken/60"
                  >
                    <td className="sticky left-0 bg-aura-surface px-4 py-3 font-medium text-aura-graphite group-hover:bg-aura-sunken">
                      {vendedor}
                    </td>

                    {indicadores.map((ind) => {
                      const item = items[ind];
                      const total = item
                        ? item.semana1 + item.semana2 + item.semana3 + item.semana4
                        : 0;

                      return (
                        <React.Fragment key={ind}>
                          <td className="border-l border-aura-mist px-1.5 py-3 text-center tabular-nums text-aura-graphite">
                            {item?.semana1 || 0}
                          </td>
                          <td className="px-1.5 py-3 text-center tabular-nums text-aura-graphite">
                            {item?.semana2 || 0}
                          </td>
                          <td className="px-1.5 py-3 text-center tabular-nums text-aura-graphite">
                            {item?.semana3 || 0}
                          </td>
                          <td className="px-1.5 py-3 text-center tabular-nums text-aura-graphite">
                            {item?.semana4 || 0}
                          </td>
                          <td className="bg-aura-petrol-500/10 px-1.5 py-3 text-center font-semibold tabular-nums text-aura-petrol-600">
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
        </div>
      )}

      {/* Resumo */}
      {Object.keys(agrupado).length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="aura-rotulo">Resumo</p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard rotulo="Total de Vendedores" valor={Object.keys(agrupado).length} />
            <StatCard rotulo="Indicadores Rastreados" valor={indicadores.length} />
            <StatCard
              rotulo="Período"
              valor={
                <span className="capitalize">
                  {new Date(anoSelecionado, mesSelecionado - 1).toLocaleDateString("pt-BR", {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              }
            />
            <StatCard rotulo="Última atualização" valor="Hoje" tom="sucesso" />
          </div>
        </div>
      )}
    </div>
  );
}
