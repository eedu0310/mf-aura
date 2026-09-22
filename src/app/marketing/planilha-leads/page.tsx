"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Filter, RefreshCw, TrendingUp } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface DadosVendedor {
  usuario_nome: string;
  usuario_id: string;
  indicador: string;
  semana1: number;
  semana2: number;
  semana3: number;
  semana4: number;
  tipo: string;
  mes?: number;
  ano?: number;
}

function numeroSeguro(valor: unknown): number {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function escaparCsv(valor: unknown): string {
  return `"${String(valor ?? "").replace(/"/g, '""')}"`;
}

function nomeMes(mes: number): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(
    new Date(2024, mes - 1, 1),
  );
}

export default function PlanilhaLeadsPage() {
  const [dados, setDados] = useState<DadosVendedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mesSelecionado, setMesSelecionado] = useState(
    new Date().getMonth() + 1,
  );
  const [anoSelecionado, setAnoSelecionado] = useState(
    new Date().getFullYear(),
  );
  const [vendedorFiltro, setVendedorFiltro] = useState("");

  const carregarDados = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setDados([]);
      setErro("Supabase não está configurado neste ambiente.");
      setCarregando(false);
      return;
    }

    setCarregando(true);
    setErro(null);

    try {
      const { data, error } = await supabase
        .from("planilha_leads_indicadores")
        .select("*")
        .eq("mes", mesSelecionado)
        .eq("ano", anoSelecionado)
        .order("usuario_nome", { ascending: true });

      if (error) throw error;

      const dadosNormalizados = ((data ?? []) as Record<string, unknown>[]).map(
        (item) => ({
          usuario_nome: String(item.usuario_nome ?? "Sem vendedor"),
          usuario_id: String(item.usuario_id ?? ""),
          indicador: String(item.indicador ?? "Sem indicador"),
          semana1: numeroSeguro(item.semana1),
          semana2: numeroSeguro(item.semana2),
          semana3: numeroSeguro(item.semana3),
          semana4: numeroSeguro(item.semana4),
          tipo: String(item.tipo ?? ""),
          mes: numeroSeguro(item.mes),
          ano: numeroSeguro(item.ano),
        }),
      );

      setDados(dadosNormalizados);
    } catch (error) {
      console.error("Erro ao carregar dados da planilha de leads:", error);
      setDados([]);
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os dados.",
      );
    } finally {
      setCarregando(false);
    }
  }, [anoSelecionado, mesSelecionado]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  const dadosFiltrados = useMemo(() => {
    const filtro = vendedorFiltro.trim().toLocaleLowerCase("pt-BR");
    if (!filtro) return dados;
    return dados.filter((item) =>
      item.usuario_nome.toLocaleLowerCase("pt-BR").includes(filtro),
    );
  }, [dados, vendedorFiltro]);

  const agrupado = useMemo(
    () =>
      dadosFiltrados.reduce<Record<string, Record<string, DadosVendedor>>>(
        (acc, item) => {
          if (!acc[item.usuario_nome]) acc[item.usuario_nome] = {};
          acc[item.usuario_nome][item.indicador] = item;
          return acc;
        },
        {},
      ),
    [dadosFiltrados],
  );

  const indicadores = useMemo(
    () =>
      Array.from(new Set(dadosFiltrados.map((item) => item.indicador))).sort(),
    [dadosFiltrados],
  );

  const totalGeral = useMemo(
    () =>
      dadosFiltrados.reduce(
        (total, item) =>
          total + item.semana1 + item.semana2 + item.semana3 + item.semana4,
        0,
      ),
    [dadosFiltrados],
  );

  function exportarExcel() {
    const linhas: string[] = [];
    const cabecalho = ["Vendedor"];

    indicadores.forEach((indicador) => {
      cabecalho.push(
        `${indicador} (S1)`,
        `${indicador} (S2)`,
        `${indicador} (S3)`,
        `${indicador} (S4)`,
        `${indicador} (Total)`,
      );
    });
    linhas.push(cabecalho.map(escaparCsv).join(";"));

    Object.entries(agrupado).forEach(([vendedor, items]) => {
      const linha: unknown[] = [vendedor];
      indicadores.forEach((indicador) => {
        const item = items[indicador];
        const semanas = item
          ? [item.semana1, item.semana2, item.semana3, item.semana4]
          : [0, 0, 0, 0];
        linha.push(
          ...semanas,
          semanas.reduce((total, valor) => total + valor, 0),
        );
      });
      linhas.push(linha.map(escaparCsv).join(";"));
    });

    const csv = `\uFEFF${linhas.join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `planilha-leads-${anoSelecionado}-${String(mesSelecionado).padStart(2, "0")}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const vendedores = Object.entries(agrupado);
  const mesFormatado = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  }).format(new Date(anoSelecionado, mesSelecionado - 1, 1));

  return (
    <div className="space-y-6 pb-24">
      <div className="relative overflow-hidden bg-gradient-to-r from-aura-petrol-700 to-aura-petrol-500 px-6 pb-10 pt-8 sm:px-8">
        <div className="relative mx-auto max-w-7xl">
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
            Planilha de Leads — Controle de Marketing
          </h1>
          <p className="mt-1 text-sm text-white/70">
            Acompanhe os indicadores de leads de todos os vendedores.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-6 sm:px-8">
        <div className="mb-6 rounded-xl border border-aura-mist bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-aura-petrol-500" />
              <label
                htmlFor="mes-leads"
                className="text-sm font-medium text-aura-graphite"
              >
                Mês:
              </label>
              <select
                id="mes-leads"
                value={mesSelecionado}
                onChange={(event) =>
                  setMesSelecionado(Number(event.target.value))
                }
                className="rounded border border-aura-mist px-3 py-1.5 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-aura-petrol-500"
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map(
                  (mes) => (
                    <option key={mes} value={mes}>
                      {nomeMes(mes)}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="ano-leads"
                className="text-sm font-medium text-aura-graphite"
              >
                Ano:
              </label>
              <select
                id="ano-leads"
                value={anoSelecionado}
                onChange={(event) =>
                  setAnoSelecionado(Number(event.target.value))
                }
                className="rounded border border-aura-mist px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-aura-petrol-500"
              >
                {Array.from(
                  { length: 5 },
                  (_, index) => new Date().getFullYear() - 2 + index,
                ).map((ano) => (
                  <option key={ano} value={ano}>
                    {ano}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-[220px] flex-1 items-center gap-2">
              <label
                htmlFor="vendedor-leads"
                className="text-sm font-medium text-aura-graphite"
              >
                Vendedor:
              </label>
              <input
                id="vendedor-leads"
                type="search"
                value={vendedorFiltro}
                onChange={(event) => setVendedorFiltro(event.target.value)}
                placeholder="Buscar vendedor..."
                className="flex-1 rounded border border-aura-mist px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-aura-petrol-500"
              />
            </div>

            <button
              type="button"
              onClick={() => void carregarDados()}
              disabled={carregando}
              className="flex items-center gap-2 rounded-lg border border-aura-mist px-4 py-2 text-sm font-medium text-aura-graphite hover:bg-aura-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={carregando ? "animate-spin" : ""}
              />
              Actualizar
            </button>

            <button
              type="button"
              onClick={exportarExcel}
              disabled={vendedores.length === 0}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={16} />
              Exportar CSV
            </button>
          </div>
        </div>

        {erro && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Não foi possível carregar a planilha: {erro}
          </div>
        )}

        {carregando ? (
          <div className="rounded-lg border border-aura-mist bg-white p-8 text-center">
            <p className="text-aura-graphite-soft">Carregando dados...</p>
          </div>
        ) : vendedores.length === 0 ? (
          <div className="rounded-lg border border-aura-mist bg-white p-8 text-center">
            <TrendingUp
              size={32}
              className="mx-auto mb-3 text-aura-graphite-soft"
            />
            <p className="text-aura-graphite-soft">
              Nenhum dado disponível para este período ou filtro.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-aura-mist bg-white shadow-sm">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 border-b border-aura-mist bg-aura-bg">
                <tr>
                  <th className="sticky left-0 min-w-[150px] bg-aura-bg px-4 py-3 text-left font-semibold text-aura-graphite">
                    Vendedor
                  </th>
                  {indicadores.map((indicador) => (
                    <th
                      key={indicador}
                      colSpan={5}
                      className="border-l border-aura-mist px-2 py-3 text-center font-semibold text-aura-graphite"
                    >
                      {indicador}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="sticky left-0 bg-aura-bg px-4 py-2 text-left text-xs font-semibold text-aura-graphite-soft" />
                  {indicadores.map((indicador) => (
                    <React.Fragment key={indicador}>
                      {(["S1", "S2", "S3", "S4"] as const).map(
                        (semana, index) => (
                          <th
                            key={semana}
                            className={`px-1.5 py-2 text-center text-xs font-semibold text-aura-graphite-soft ${index === 0 ? "border-l border-aura-mist" : ""}`}
                          >
                            {semana}
                          </th>
                        ),
                      )}
                      <th className="bg-aura-petrol-50 px-1.5 py-2 text-center text-xs font-semibold text-aura-petrol-600">
                        ∑
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendedores.map(([vendedor, items]) => (
                  <tr
                    key={vendedor}
                    className="border-b border-aura-mist transition hover:bg-aura-bg/50"
                  >
                    <td className="sticky left-0 bg-white px-4 py-3 font-medium text-aura-graphite">
                      {vendedor}
                    </td>
                    {indicadores.map((indicador) => {
                      const item = items[indicador];
                      const valores = item
                        ? [
                            item.semana1,
                            item.semana2,
                            item.semana3,
                            item.semana4,
                          ]
                        : [0, 0, 0, 0];
                      const total = valores.reduce(
                        (sum, value) => sum + value,
                        0,
                      );
                      return (
                        <React.Fragment key={indicador}>
                          {valores.map((valor, index) => (
                            <td
                              key={`${indicador}-${index}`}
                              className={`px-1.5 py-3 text-center text-aura-graphite ${index === 0 ? "border-l border-aura-mist" : ""}`}
                            >
                              {valor}
                            </td>
                          ))}
                          <td className="bg-aura-petrol-50 px-1.5 py-3 text-center font-bold text-aura-petrol-600">
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

        {vendedores.length > 0 && (
          <div className="mt-6 rounded-lg border border-aura-mist bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-aura-graphite">
              Resumo
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg bg-aura-bg p-3">
                <p className="text-xs text-aura-graphite-soft">
                  Total de vendedores
                </p>
                <p className="text-lg font-bold text-aura-graphite">
                  {vendedores.length}
                </p>
              </div>
              <div className="rounded-lg bg-aura-bg p-3">
                <p className="text-xs text-aura-graphite-soft">
                  Indicadores rastreados
                </p>
                <p className="text-lg font-bold text-aura-graphite">
                  {indicadores.length}
                </p>
              </div>
              <div className="rounded-lg bg-aura-bg p-3">
                <p className="text-xs text-aura-graphite-soft">Período</p>
                <p className="text-lg font-bold capitalize text-aura-graphite">
                  {mesFormatado}
                </p>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-xs text-green-700">Total de leads</p>
                <p className="text-lg font-bold text-green-600">{totalGeral}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
