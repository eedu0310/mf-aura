"use client";

import { useState } from "react";
import { Layers, TrendingUp, AlertCircle, Plus, Download, Pencil, Trash2 } from "lucide-react";
import { AuraInsightCard } from "@/components/aura/aura-insight-card";
import { useAppData } from "@/lib/app-data-context";
import { EditVendaModal } from "./edit-venda-modal";
import { useUserProfile } from "@/lib/user-profile-context";
import type { Venda, Oportunidade } from "@/lib/types";

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatarData(data: string) {
  if (!data) return "-";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function VendasView() {
  const { vendas, oportunidades , deleteVenda } = useAppData();
  const { profile } = useUserProfile();
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("todas");
  const [abaSelecionada, setAbaSelecionada] = useState<"realizadas" | "fechadas" | "resumo">("realizadas");

  // ============================================
  // VERIFICAR CARGO DO USUÁRIO
  // ============================================

  const isGestor = profile.cargo === "Gestor";
  const empresaUsuario = profile.empresa;

  // ============================================
  // FILTRAR DADOS BASEADO NO CARGO
  // ============================================

  let vendasVisiveis: Venda[] = [];
  let oportunidadesVisíveis: Oportunidade[] = [];

  if (isGestor) {
    // Gestor vê TUDO
    vendasVisiveis = vendas;
    oportunidadesVisíveis = oportunidades.filter((o) => o.etapa === "Fechados");
  } else {
    // Vendedor vê apenas sua empresa
    vendasVisiveis = vendas.filter((v) => (v.empresa || "Sem empresa") === empresaUsuario);
    oportunidadesVisíveis = oportunidades.filter(
      (o) => o.etapa === "Fechados" && (o.empresa || "Sem empresa") === empresaUsuario
    );
  }

  // ============================================
  // EMPRESAS DISPONÍVEIS PARA FILTRO
  // ============================================

  const empresasDisponiveis = Array.from(
    new Set([
      ...vendasVisiveis.map((v) => v.empresa || "Sem empresa"),
      ...oportunidadesVisíveis.map((o) => o.empresa || "Sem empresa"),
    ])
  ).sort();

  // ============================================
  // APLICAR FILTRO DE EMPRESA
  // ============================================

  const vendasFiltradas =
    filtroEmpresa === "todas"
      ? vendasVisiveis
      : vendasVisiveis.filter((v) => (v.empresa || "Sem empresa") === filtroEmpresa);

  const oportunidadeFechadosFiltradas =
    filtroEmpresa === "todas"
      ? oportunidadesVisíveis
      : oportunidadesVisíveis.filter(
          (o) => (o.empresa || "Sem empresa") === filtroEmpresa
        );

  // ============================================
  // CÁLCULOS
  // ============================================

  const totalVendido = vendasFiltradas.reduce((sum, v) => sum + v.valor, 0);
  const totalFechado = oportunidadeFechadosFiltradas.reduce((sum, o) => sum + o.valor, 0);

  // Todo negócio movido para "Fechados" já vira uma venda automaticamente.
  // Por isso o total geral soma as vendas e, das oportunidades fechadas, só
  // as que ainda não viraram venda — senão o mesmo dinheiro contava duas vezes.
  const oportunidadesComVenda = new Set(
    vendasFiltradas.map((v) => v.oportunidadeId).filter(Boolean) as string[],
  );
  const fechadasSemVenda = oportunidadeFechadosFiltradas.filter(
    (o) => !oportunidadesComVenda.has(o.id),
  );
  const totalGeral = totalVendido + fechadasSemVenda.reduce((sum, o) => sum + o.valor, 0);

  const quantidadeVendas = vendasFiltradas.length;
  const quantidadeFechadas = oportunidadeFechadosFiltradas.length;
  const quantidadeGeral = quantidadeVendas + fechadasSemVenda.length;

  const ticketMedio = quantidadeVendas > 0 ? totalVendido / quantidadeVendas : 0;
  const ticketMedioFechado =
    quantidadeFechadas > 0 ? totalFechado / quantidadeFechadas : 0;

  const [vendaEditando, setVendaEditando] = useState<(typeof vendasFiltradas)[number] | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  /** Corrige um lançamento errado: só o dono da venda ou o gestor conseguem. */
  async function excluirVenda(venda: (typeof vendasFiltradas)[number]) {
    if (!window.confirm(`Excluir a venda de ${venda.cliente}? Ela sai dos totais e do ranking.`)) return;
    setExcluindo(venda.id);
    try {
      await deleteVenda(venda.id);
    } catch (erro: any) {
      window.alert(erro?.message ?? "Não consegui excluir a venda.");
    } finally {
      setExcluindo(null);
    }
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-aura-navy-950 px-6 pb-10 pt-8 sm:px-8">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-aura-gold/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-aura-petrol-500/10 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl">
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Vendas</h1>
          <p className="mt-1 text-sm text-white/50">
            {isGestor
              ? "Acompanhe todas as vendas realizadas e oportunidades fechadas."
              : `Suas vendas e oportunidades de ${empresaUsuario}`}
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-6 sm:px-8">
        <AuraInsightCard pagina="vendas" />
      </div>

      {/* Filtro por Empresa (apenas se gestor ou múltiplas empresas) */}
      {(isGestor || empresasDisponiveis.length > 1) && (
        <div className="mx-auto w-full max-w-7xl px-6 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <label className="block text-sm font-medium text-aura-graphite mb-2">
                Filtrar por empresa:
              </label>
              <select
                value={filtroEmpresa}
                onChange={(e) => setFiltroEmpresa(e.target.value)}
                className="w-full sm:w-64 rounded-lg border border-aura-mist bg-white px-4 py-2 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
              >
                {isGestor && <option value="todas">Todas as empresas</option>}
                {empresasDisponiveis.map((empresa) => (
                  <option key={empresa} value={empresa}>
                    {empresa}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Cards de Resumo */}
      <div className="mx-auto w-full max-w-7xl px-6 sm:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-aura-mist bg-white p-5">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-aura-success" />
              <p className="text-sm text-aura-graphite-soft">Vendido (Realizado)</p>
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-aura-graphite">
              {formatarMoeda(totalVendido)}
            </p>
            <p className="mt-1 text-xs text-aura-graphite-soft">
              {quantidadeVendas} venda{quantidadeVendas !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="rounded-2xl border border-aura-mist bg-white p-5">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-aura-warning" />
              <p className="text-sm text-aura-graphite-soft">Fechado (Pipeline)</p>
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-aura-graphite">
              {formatarMoeda(totalFechado)}
            </p>
            <p className="mt-1 text-xs text-aura-graphite-soft">
              {quantidadeFechadas} oportunidade{quantidadeFechadas !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="rounded-2xl border border-aura-mist bg-white p-5">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-aura-petrol-600" />
              <p className="text-sm text-aura-graphite-soft">Total Geral</p>
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-aura-graphite">
              {formatarMoeda(totalGeral)}
            </p>
            <p className="mt-1 text-xs text-aura-graphite-soft">
              {quantidadeGeral} negócio{quantidadeGeral !== 1 ? "s" : ""}
            </p>
          </div>

          <div className="rounded-2xl border border-aura-mist bg-white p-5">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-aura-petrol-600" />
              <p className="text-sm text-aura-graphite-soft">Ticket Médio</p>
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-aura-graphite">
              {formatarMoeda(ticketMedio || 0)}
            </p>
            <p className="mt-1 text-xs text-aura-graphite-soft">
              Realizado: {formatarMoeda(ticketMedioFechado || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="mx-auto w-full max-w-7xl px-6 sm:px-8">
        <div className="flex gap-4 border-b border-aura-mist">
          <button
            onClick={() => setAbaSelecionada("realizadas")}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              abaSelecionada === "realizadas"
                ? "border-b-2 border-aura-petrol-700 text-aura-petrol-700"
                : "text-aura-graphite-soft hover:text-aura-graphite"
            }`}
          >
            Vendas Realizadas ({quantidadeVendas})
          </button>
          <button
            onClick={() => setAbaSelecionada("fechadas")}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              abaSelecionada === "fechadas"
                ? "border-b-2 border-aura-petrol-700 text-aura-petrol-700"
                : "text-aura-graphite-soft hover:text-aura-graphite"
            }`}
          >
            Oportunidades Fechadas ({quantidadeFechadas})
          </button>
          <button
            onClick={() => setAbaSelecionada("resumo")}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              abaSelecionada === "resumo"
                ? "border-b-2 border-aura-petrol-700 text-aura-petrol-700"
                : "text-aura-graphite-soft hover:text-aura-graphite"
            }`}
          >
            Resumo
          </button>
        </div>
      </div>

      {/* Conteúdo das Abas */}
      <div className="mx-auto w-full max-w-7xl px-6 pb-24 sm:px-8">
        {/* Aba: Vendas Realizadas */}
        {abaSelecionada === "realizadas" && (
          <div>
            {vendasFiltradas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-aura-mist bg-aura-bg px-6 py-12 text-center">
                <p className="text-sm text-aura-graphite-soft">
                  Nenhuma venda realizada encontrada.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-aura-mist">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-aura-mist bg-aura-bg">
                      <th className="px-4 py-3 text-left text-sm font-medium text-aura-graphite">
                        Cliente
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-aura-graphite">
                        Produto
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-aura-graphite">
                        Valor
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-aura-graphite">
                        Data
                      </th>
                      {isGestor && (
                        <th className="px-4 py-3 text-left text-sm font-medium text-aura-graphite">
                          Empresa
                        </th>
                      )}
                      <th className="px-4 py-3 text-left text-sm font-medium text-aura-graphite">
                        Loja
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-aura-graphite">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aura-mist">
                    {vendasFiltradas.map((venda) => (
                      <tr key={venda.id} className="hover:bg-aura-bg/50">
                        <td className="px-4 py-3 text-sm text-aura-graphite">
                          {venda.cliente}
                        </td>
                        <td className="px-4 py-3 text-sm text-aura-graphite-soft">
                          {venda.produto || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-aura-graphite">
                          {formatarMoeda(venda.valor)}
                        </td>
                        <td className="px-4 py-3 text-sm text-aura-graphite-soft">
                          {formatarData(venda.data)}
                        </td>
                        {isGestor && (
                          <td className="px-4 py-3 text-sm text-aura-graphite-soft">
                            {venda.empresa || "Sem empresa"}
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm text-aura-graphite-soft">
                          {venda.loja || "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setVendaEditando(venda)}
                              title="Corrigir esta venda"
                              aria-label={`Corrigir a venda de ${venda.cliente}`}
                              className="rounded-lg p-2 text-aura-graphite-soft hover:bg-aura-bg hover:text-aura-graphite"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void excluirVenda(venda)}
                              disabled={excluindo === venda.id}
                              title="Excluir esta venda"
                              aria-label={`Excluir a venda de ${venda.cliente}`}
                              className="rounded-lg p-2 text-aura-danger hover:bg-red-50 disabled:opacity-40"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Aba: Oportunidades Fechadas */}
        {abaSelecionada === "fechadas" && (
          <div>
            {oportunidadeFechadosFiltradas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-aura-mist bg-aura-bg px-6 py-12 text-center">
                <p className="text-sm text-aura-graphite-soft">
                  Nenhuma oportunidade fechada encontrada.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-aura-mist">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-aura-mist bg-aura-bg">
                      <th className="px-4 py-3 text-left text-sm font-medium text-aura-graphite">
                        Cliente
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-aura-graphite">
                        Produto
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-aura-graphite">
                        Valor
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-aura-graphite">
                        Probabilidade
                      </th>
                      {isGestor && (
                        <th className="px-4 py-3 text-left text-sm font-medium text-aura-graphite">
                          Empresa
                        </th>
                      )}
                      <th className="px-4 py-3 text-left text-sm font-medium text-aura-graphite">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aura-mist">
                    {oportunidadeFechadosFiltradas.map((opp) => (
                      <tr key={opp.id} className="hover:bg-aura-bg/50">
                        <td className="px-4 py-3 text-sm text-aura-graphite">
                          {opp.cliente}
                        </td>
                        <td className="px-4 py-3 text-sm text-aura-graphite-soft">
                          {opp.produto || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-aura-graphite">
                          {formatarMoeda(opp.valor)}
                        </td>
                        <td className="px-4 py-3 text-sm text-aura-graphite-soft">
                          {opp.probabilidade}
                        </td>
                        {isGestor && (
                          <td className="px-4 py-3 text-sm text-aura-graphite-soft">
                            {opp.empresa || "Sem empresa"}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <span className="inline-block rounded-full bg-aura-success/10 px-3 py-1 text-xs font-medium text-aura-success">
                            {opp.etapa}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Aba: Resumo */}
        {abaSelecionada === "resumo" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-aura-mist bg-white p-6">
                <h3 className="text-sm font-medium text-aura-graphite mb-4">
                  Resumo de Vendas Realizadas
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-aura-graphite-soft">Total Vendido:</span>
                    <span className="font-semibold text-aura-graphite">
                      {formatarMoeda(totalVendido)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-aura-graphite-soft">Quantidade:</span>
                    <span className="font-semibold text-aura-graphite">
                      {quantidadeVendas}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-aura-graphite-soft">Ticket Médio:</span>
                    <span className="font-semibold text-aura-graphite">
                      {formatarMoeda(ticketMedio)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-aura-mist bg-white p-6">
                <h3 className="text-sm font-medium text-aura-graphite mb-4">
                  Resumo de Oportunidades Fechadas
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-aura-graphite-soft">Total Fechado:</span>
                    <span className="font-semibold text-aura-graphite">
                      {formatarMoeda(totalFechado)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-aura-graphite-soft">Quantidade:</span>
                    <span className="font-semibold text-aura-graphite">
                      {quantidadeFechadas}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-aura-graphite-soft">Ticket Médio:</span>
                    <span className="font-semibold text-aura-graphite">
                      {formatarMoeda(ticketMedioFechado)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-aura-mist bg-white p-6">
              <h3 className="text-sm font-medium text-aura-graphite mb-4">
                Resumo Geral
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-aura-graphite-soft">Total Geral:</span>
                  <span className="font-display text-xl font-bold text-aura-graphite">
                    {formatarMoeda(totalGeral)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-aura-graphite-soft">Taxa de Realização:</span>
                  <span className="font-semibold text-aura-graphite">
                    {totalGeral > 0
                      ? `${((totalVendido / totalGeral) * 100).toFixed(1)}%`
                      : "0%"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {vendaEditando && (
        <EditVendaModal
          venda={{
            id: vendaEditando.id,
            cliente: vendaEditando.cliente,
            produto: vendaEditando.produto,
            valor: vendaEditando.valor,
          }}
          onClose={() => setVendaEditando(null)}
        />
      )}
    </div>
  );
}
