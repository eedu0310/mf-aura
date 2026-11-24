"use client";

import { useState } from "react";
import { Layers, TrendingUp, AlertCircle, Plus, Download, Pencil, Trash2 } from "lucide-react";
import { AuraInsightCard } from "@/components/aura/aura-insight-card";
import { useAppData } from "@/lib/app-data-context";
import { EditVendaModal } from "./edit-venda-modal";
import { useUserProfile } from "@/lib/user-profile-context";
import type { Venda, Oportunidade } from "@/lib/types";
import { ehGanho } from "@/lib/funil";
import { NOMES_EMPRESAS } from "@/lib/companies";
import { EstadoVazio, PageContainer, PageHeader, Segmentado, StatCard, classeBotao } from "@/components/ui";

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
  const { vendas, oportunidades, deleteVenda, funil } = useAppData();
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
    oportunidadesVisíveis = oportunidades.filter((o) => ehGanho(o.etapa, funil));
  } else {
    // Vendedor vê apenas sua empresa
    vendasVisiveis = vendas.filter((v) => (v.empresa || "Sem empresa") === empresaUsuario);
    oportunidadesVisíveis = oportunidades.filter(
      (o) => ehGanho(o.etapa, funil) && (o.empresa || "Sem empresa") === empresaUsuario
    );
  }

  // ============================================
  // EMPRESAS DISPONÍVEIS PARA FILTRO
  // ============================================

  /**
   * As lojas do seletor são AS LOJAS DO GRUPO, não as lojas que por acaso
   * têm venda.
   *
   * A lista era montada a partir dos próprios dados: `new Set` das empresas
   * que aparecem nas vendas e nos negócios ganhos. Com uma venda registrada e
   * os negócios fechados concentrados em duas lojas, o seletor do gestor
   * mostrava SÓ ESSAS DUAS — a LF Lareiras e a Sole sumiam da tela, como se
   * não existissem. O gestor não conseguia nem selecionar a loja para
   * confirmar que ela está zerada, que é exatamente a informação que ele
   * precisa ver.
   *
   * Pior: some em silêncio. Nada na tela diz "esta loja não aparece porque
   * ainda não vendeu"; a loja simplesmente não está lá.
   *
   * O "Sem empresa" continua entrando quando existir registro sem loja — é
   * dado torto, e o gestor precisa enxergar para consertar.
   */
  const lojasComDadoTorto = Array.from(
    new Set([
      ...vendasVisiveis.map((v) => v.empresa || "Sem empresa"),
      ...oportunidadesVisíveis.map((o) => o.empresa || "Sem empresa"),
    ])
  ).filter((nome) => !NOMES_EMPRESAS.includes(nome));

  const empresasDisponiveis = (
    isGestor ? [...NOMES_EMPRESAS, ...lojasComDadoTorto] : [empresaUsuario]
  ).filter(Boolean);

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
    <PageContainer>
      <PageHeader
        titulo="Vendas"
        icone={TrendingUp}
        descricao={
          isGestor
            ? "Acompanhe todas as vendas realizadas e oportunidades fechadas."
            : `Suas vendas e oportunidades de ${empresaUsuario}`
        }
        acoes={
          /* Filtro por Empresa (apenas se gestor ou múltiplas empresas) */
          (isGestor || empresasDisponiveis.length > 1) && (
            <label className="flex items-center gap-2 text-sm text-aura-graphite-soft">
              <span className="whitespace-nowrap">Filtrar por empresa:</span>
              <select
                value={filtroEmpresa}
                onChange={(e) => setFiltroEmpresa(e.target.value)}
                className="aura-input w-full sm:w-56"
              >
                {isGestor && <option value="todas">Todas as empresas</option>}
                {empresasDisponiveis.map((empresa) => (
                  <option key={empresa} value={empresa}>
                    {empresa}
                  </option>
                ))}
              </select>
            </label>
          )
        }
      />

      <div className="space-y-6">
      <AuraInsightCard pagina="vendas" />

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icone={TrendingUp}
          tom="sucesso"
          rotulo="Vendido (Realizado)"
          valor={formatarMoeda(totalVendido)}
          detalhe={`${quantidadeVendas} venda${quantidadeVendas !== 1 ? "s" : ""}`}
        />
        <StatCard
          icone={AlertCircle}
          rotulo="Fechado (Pipeline)"
          valor={formatarMoeda(totalFechado)}
          detalhe={`${quantidadeFechadas} oportunidade${quantidadeFechadas !== 1 ? "s" : ""}`}
        />
        <StatCard
          icone={Layers}
          rotulo="Total Geral"
          valor={formatarMoeda(totalGeral)}
          detalhe={`${quantidadeGeral} negócio${quantidadeGeral !== 1 ? "s" : ""}`}
        />
        {/* O rótulo dizia "Realizado" embaixo do ticket das oportunidades
            FECHADAS, o oposto do que os cards ao lado chamam de realizado.
            Na tela aparecia "Ticket Médio R$ 0 / Realizado: R$ 12.712" —
            dois números que se desmentiam no mesmo cartão. */}
        <StatCard
          icone={Layers}
          rotulo="Ticket Médio"
          valor={formatarMoeda(ticketMedio || 0)}
          detalhe={
            <>
              {quantidadeVendas > 0 ? "por venda registrada" : "nenhuma venda registrada ainda"}
              {quantidadeFechadas > 0 && (
                <>
                  {" · "}
                  Fechado: {formatarMoeda(ticketMedioFechado || 0)}
                </>
              )}
            </>
          }
        />
      </div>

      {/* Abas */}
      <Segmentado
        rotulo="Vendas"
        valor={abaSelecionada}
        aoMudar={setAbaSelecionada}
        opcoes={[
          { valor: "realizadas", rotulo: "Vendas Realizadas", contagem: quantidadeVendas },
          { valor: "fechadas", rotulo: "Oportunidades Fechadas", contagem: quantidadeFechadas },
          { valor: "resumo", rotulo: "Resumo" },
        ]}
      />

      {/* Conteúdo das Abas */}
      <div>
        {/* Aba: Vendas Realizadas */}
        {abaSelecionada === "realizadas" && (
          <div>
            {vendasFiltradas.length === 0 ? (
              <EstadoVazio icone={TrendingUp} titulo="Nenhuma venda realizada encontrada." />
            ) : (
              <div className="aura-card overflow-x-auto">
                <table className="aura-tabela">
                  <thead>
                    <tr>
                      <th>
                        Cliente
                      </th>
                      <th>
                        Produto
                      </th>
                      <th>
                        Valor
                      </th>
                      <th>
                        Data
                      </th>
                      {isGestor && (
                        <th>
                          Empresa
                        </th>
                      )}
                      <th>
                        Loja
                      </th>
                      <th className="text-right">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendasFiltradas.map((venda) => (
                      <tr key={venda.id}>
                        <td>
                          {venda.cliente}
                        </td>
                        <td className="text-aura-graphite-soft">
                          {venda.produto || "-"}
                        </td>
                        <td className="font-medium tabular-nums">
                          {formatarMoeda(venda.valor)}
                        </td>
                        <td className="text-aura-graphite-soft">
                          {formatarData(venda.data)}
                        </td>
                        {isGestor && (
                          <td className="text-aura-graphite-soft">
                            {venda.empresa || "Sem empresa"}
                          </td>
                        )}
                        <td className="text-aura-graphite-soft">
                          {venda.loja || "-"}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setVendaEditando(venda)}
                              title="Corrigir esta venda"
                              aria-label={`Corrigir a venda de ${venda.cliente}`}
                              className={classeBotao("fantasma", "sm", "w-[1.875rem] px-0")}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void excluirVenda(venda)}
                              disabled={excluindo === venda.id}
                              title="Excluir esta venda"
                              aria-label={`Excluir a venda de ${venda.cliente}`}
                              className={classeBotao("fantasma", "sm", "w-[1.875rem] px-0 text-aura-danger hover:text-aura-danger")}
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
              <EstadoVazio icone={Layers} titulo="Nenhuma oportunidade fechada encontrada." />
            ) : (
              <div className="aura-card overflow-x-auto">
                <table className="aura-tabela">
                  <thead>
                    <tr>
                      <th>
                        Cliente
                      </th>
                      <th>
                        Produto
                      </th>
                      <th>
                        Valor
                      </th>
                      <th>
                        Probabilidade
                      </th>
                      {isGestor && (
                        <th>
                          Empresa
                        </th>
                      )}
                      <th>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {oportunidadeFechadosFiltradas.map((opp) => (
                      <tr key={opp.id}>
                        <td>
                          {opp.cliente}
                        </td>
                        <td className="text-aura-graphite-soft">
                          {opp.produto || "-"}
                        </td>
                        <td className="font-medium tabular-nums">
                          {formatarMoeda(opp.valor)}
                        </td>
                        <td className="text-aura-graphite-soft">
                          {opp.probabilidade}
                        </td>
                        {isGestor && (
                          <td className="text-aura-graphite-soft">
                            {opp.empresa || "Sem empresa"}
                          </td>
                        )}
                        <td>
                          <span className="aura-selo aura-selo-sucesso">
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
              <div className="aura-card p-5">
                <h3 className="mb-4 text-sm font-semibold text-aura-graphite">
                  Resumo de Vendas Realizadas
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-aura-graphite-soft">Total Vendido:</span>
                    <span className="font-semibold tabular-nums text-aura-graphite">
                      {formatarMoeda(totalVendido)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-aura-graphite-soft">Quantidade:</span>
                    <span className="font-semibold tabular-nums text-aura-graphite">
                      {quantidadeVendas}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-aura-graphite-soft">Ticket Médio:</span>
                    <span className="font-semibold tabular-nums text-aura-graphite">
                      {formatarMoeda(ticketMedio)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="aura-card p-5">
                <h3 className="mb-4 text-sm font-semibold text-aura-graphite">
                  Resumo de Oportunidades Fechadas
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-aura-graphite-soft">Total Fechado:</span>
                    <span className="font-semibold tabular-nums text-aura-graphite">
                      {formatarMoeda(totalFechado)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-aura-graphite-soft">Quantidade:</span>
                    <span className="font-semibold tabular-nums text-aura-graphite">
                      {quantidadeFechadas}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-aura-graphite-soft">Ticket Médio:</span>
                    <span className="font-semibold tabular-nums text-aura-graphite">
                      {formatarMoeda(ticketMedioFechado)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="aura-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-aura-graphite">
                Resumo Geral
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-aura-graphite-soft">Total Geral:</span>
                  <span className="font-display text-xl font-semibold tabular-nums text-aura-graphite">
                    {formatarMoeda(totalGeral)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-aura-graphite-soft">Taxa de Realização:</span>
                  <span className="font-semibold tabular-nums text-aura-graphite">
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
    </PageContainer>
  );
}
