"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Filter, RefreshCw, Table2, TrendingUp } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Alerta, EstadoVazio, PageContainer, PageHeader, StatCard, classeBotao } from "@/components/ui";

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
    <PageContainer>
      <PageHeader
        titulo="Planilha de Leads — Controle de Marketing"
        descricao="Acompanhe os indicadores de leads de todos os vendedores."
        icone={Table2}
      />

      <div>
        <div className="aura-card mb-6 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-aura-graphite-soft" />
              <label
                htmlFor="mes-leads"
                className="text-[0.8125rem] font-medium text-aura-graphite"
              >
                Mês:
              </label>
              <select
                id="mes-leads"
                value={mesSelecionado}
                onChange={(event) =>
                  setMesSelecionado(Number(event.target.value))
                }
                className="aura-input h-9 w-auto capitalize"
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
                className="text-[0.8125rem] font-medium text-aura-graphite"
              >
                Ano:
              </label>
              <select
                id="ano-leads"
                value={anoSelecionado}
                onChange={(event) =>
                  setAnoSelecionado(Number(event.target.value))
                }
                className="aura-input h-9 w-auto"
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
                className="text-[0.8125rem] font-medium text-aura-graphite"
              >
                Vendedor:
              </label>
              <input
                id="vendedor-leads"
                type="search"
                value={vendedorFiltro}
                onChange={(event) => setVendedorFiltro(event.target.value)}
                placeholder="Buscar vendedor..."
                className="aura-input h-9 flex-1"
              />
            </div>

            <button
              type="button"
              onClick={() => void carregarDados()}
              disabled={carregando}
              className={classeBotao("secundario")}
            >
              <RefreshCw
                size={15}
                className={carregando ? "animate-spin" : ""}
              />
              Atualizar
            </button>

            <button
              type="button"
              onClick={exportarExcel}
              disabled={vendedores.length === 0}
              className={classeBotao("primario")}
            >
              <Download size={15} />
              Exportar CSV
            </button>
          </div>
        </div>

        {erro && (
          <Alerta tom="perigo" className="mb-6" titulo={<>Não foi possível carregar a planilha: {erro}</>} />
        )}

        {carregando ? (
          <div className="aura-card p-8 text-center">
            <p className="text-sm text-aura-graphite-soft">Carregando dados...</p>
          </div>
        ) : vendedores.length === 0 ? (
          <EstadoVazio icone={TrendingUp} titulo="Nenhum dado disponível para este período ou filtro." />
        ) : (
          <div className="aura-card overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 border-b border-aura-mist bg-aura-sunken">
                <tr>
                  <th className="sticky left-0 min-w-[150px] bg-aura-sunken px-4 py-3 text-left font-semibold text-aura-graphite">
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
                  <th className="sticky left-0 bg-aura-sunken px-4 py-2 text-left text-xs font-semibold text-aura-graphite-soft" />
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
                      <th className="bg-aura-petrol-500/[0.06] px-1.5 py-2 text-center text-xs font-semibold text-aura-petrol-600">
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
                    className="border-b border-aura-mist transition hover:bg-aura-sunken/50"
                  >
                    <td className="sticky left-0 bg-aura-surface px-4 py-3 font-medium text-aura-graphite">
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
                              className={`px-1.5 py-3 text-center tabular-nums text-aura-graphite ${index === 0 ? "border-l border-aura-mist" : ""}`}
                            >
                              {valor}
                            </td>
                          ))}
                          <td className="bg-aura-petrol-500/[0.06] px-1.5 py-3 text-center font-semibold tabular-nums text-aura-petrol-600">
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
          <div className="mt-6">
            <p className="aura-rotulo mb-3">Resumo</p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard rotulo="Total de vendedores" valor={vendedores.length} />
              <StatCard rotulo="Indicadores rastreados" valor={indicadores.length} />
              <StatCard rotulo="Período" valor={<span className="capitalize">{mesFormatado}</span>} />
              <StatCard rotulo="Total de leads" valor={totalGeral} tom="sucesso" />
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
