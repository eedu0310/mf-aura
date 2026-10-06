"use client";

import { useState, useMemo } from "react";
import { Trophy, TrendingUp, Target, Zap, Award } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { useUserProfile } from "@/lib/user-profile-context";
import { ehPerda } from "@/lib/funil";

type AbaRanking = "vendedores" | "relacionamentos" | "oportunidades" | "atividades" | "performance";

export function RankingView() {
  const { vendas, oportunidades, relacionamentos, atividades, nomesPorOwnerId, funil } = useAppData();
  const { profile } = useUserProfile();
  const [abaAtiva, setAbaAtiva] = useState<AbaRanking>("vendedores");

  const todasVendas = Array.isArray(vendas) ? vendas : [];
  const todasOportunidades = Array.isArray(oportunidades) ? oportunidades : [];
  const todosRelacionamentos = Array.isArray(relacionamentos) ? relacionamentos : [];
  const todasAtividades = Array.isArray(atividades) ? atividades : [];

  // ========== ABA 1: VENDEDORES POR VALOR ==========
  const vendedoresPorValor = useMemo(() => {
    const vendedoresMap: Record<string, { valor: number; vendas: number; nomeVendedor?: string }> = {};

    todasVendas.forEach((v) => {
      const vendedorId = v.ownerId || "Sem ID";
      if (!vendedoresMap[vendedorId]) {
        vendedoresMap[vendedorId] = { valor: 0, vendas: 0 };
      }
      vendedoresMap[vendedorId].valor += v.valor || 0;
      vendedoresMap[vendedorId].vendas += 1;
      vendedoresMap[vendedorId].nomeVendedor = nomesPorOwnerId[vendedorId] || "Vendedor";
    });

    return Object.entries(vendedoresMap)
      .map(([id, dados]) => ({
        id,
        nome: dados.nomeVendedor || "Vendedor",
        valor: dados.valor,
        vendas: dados.vendas,
        ticketMedio: dados.vendas > 0 ? dados.valor / dados.vendas : 0,
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [todasVendas, nomesPorOwnerId]);

  // ========== ABA 2: RELACIONAMENTOS QUENTES ==========
  const relacionamentosQuentes = useMemo(() => {
    const temperaturaPriority = { quente: 4, ativo: 3, esfriando: 2, frio: 1 };
    return todosRelacionamentos
      .map((r) => ({
        ...r,
        prioridade: temperaturaPriority[r.temperatura as keyof typeof temperaturaPriority] || 0,
      }))
      .sort((a, b) => {
        if (a.prioridade !== b.prioridade) return b.prioridade - a.prioridade;
        return (b.valorGerado || 0) - (a.valorGerado || 0);
      })
      .slice(0, 10);
  }, [todosRelacionamentos]);

  // ========== ABA 3: OPORTUNIDADES MAIOR VALOR ==========
  const oportunidadesMaiorValor = useMemo(() => {
    return todasOportunidades
      .filter((o) => !ehPerda(o.etapa, funil))
      .sort((a, b) => (b.valor || 0) - (a.valor || 0))
      .slice(0, 10);
  }, [todasOportunidades]);

  // ========== ABA 4: VENDEDORES POR ATIVIDADES ==========
  const vendedoresPorAtividades = useMemo(() => {
    const vendedoresMap: Record<string, { atividades: number; nomeVendedor?: string }> = {};

    todasAtividades.forEach((a) => {
      const vendedorId = a.ownerId || "Sem ID";
      if (!vendedoresMap[vendedorId]) {
        vendedoresMap[vendedorId] = { atividades: 0 };
      }
      vendedoresMap[vendedorId].atividades += 1;
      vendedoresMap[vendedorId].nomeVendedor = nomesPorOwnerId[vendedorId] || "Vendedor";
    });

    return Object.entries(vendedoresMap)
      .map(([id, dados]) => ({
        id,
        nome: dados.nomeVendedor || "Vendedor",
        atividades: dados.atividades,
      }))
      .sort((a, b) => b.atividades - a.atividades);
  }, [todasAtividades, nomesPorOwnerId]);

  // ========== ABA 5: PERFORMANCE VS META ==========
  const performanceVsMeta = useMemo(() => {
    const metaPorVendedor = 0;
    return vendedoresPorValor.map((v) => ({
      ...v,
      meta: metaPorVendedor,
      atingimento: metaPorVendedor > 0 ? (v.valor / metaPorVendedor) * 100 : 0,
    }));
  }, [vendedoresPorValor]);

  function formatarMoeda(valor: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(valor);
  }

  function getTemperaturaColor(temp: string) {
    const cores: Record<string, string> = {
      quente: "bg-red-100 text-red-700",
      ativo: "bg-green-100 text-green-700",
      esfriando: "bg-yellow-100 text-yellow-700",
      frio: "bg-blue-100 text-blue-700",
    };
    return cores[temp] || "bg-gray-100 text-gray-700";
  }

  return (
    <div className="space-y-6 pb-24 pt-2 sm:pt-4">
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
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Ranking</h1>
          <p className="mt-1 text-sm text-white/50">
            Acompanhe a performance e competições saudáveis.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-6 sm:px-8">
        {/* Abas */}
        <div className="mb-6 flex flex-wrap gap-2 border-b border-aura-mist pb-4">
          {[
            { id: "vendedores", label: "Vendedores", icon: Trophy },
            { id: "relacionamentos", label: "Relacionamentos", icon: TrendingUp },
            { id: "oportunidades", label: "Oportunidades", icon: Target },
            { id: "atividades", label: "Atividades", icon: Zap },
            { id: "performance", label: "Performance", icon: Award },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAbaAtiva(id as AbaRanking)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                abaAtiva === id
                  ? "bg-aura-petrol-700 text-white"
                  : "border border-aura-mist text-aura-graphite hover:border-aura-petrol-300"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* ABA 1: VENDEDORES */}
        {abaAtiva === "vendedores" && (
          <div className="rounded-2xl border border-aura-mist bg-white p-6">
            <p className="mb-4 text-lg font-semibold text-aura-graphite">Vendedores por Valor Vendido</p>
            {vendedoresPorValor.length > 0 ? (
              <div className="space-y-3">
                {vendedoresPorValor.map((v, idx) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-lg border border-aura-mist bg-aura-bg p-4"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-aura-petrol-600 text-white font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-medium text-aura-graphite">{v.nome}</p>
                        <p className="text-xs text-aura-graphite-soft">{v.vendas} vendas • Ticket: {formatarMoeda(v.ticketMedio)}</p>
                      </div>
                    </div>
                    <p className="font-display text-xl font-bold text-aura-graphite">{formatarMoeda(v.valor)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-aura-graphite-soft py-8">Sem dados</p>
            )}
          </div>
        )}

        {/* ABA 2: RELACIONAMENTOS */}
        {abaAtiva === "relacionamentos" && (
          <div className="rounded-2xl border border-aura-mist bg-white p-6">
            <p className="mb-4 text-lg font-semibold text-aura-graphite">Relacionamentos Mais Quentes</p>
            {relacionamentosQuentes.length > 0 ? (
              <div className="space-y-3">
                {relacionamentosQuentes.map((r, idx) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-aura-mist bg-aura-bg p-4"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-aura-petrol-600 text-white font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-medium text-aura-graphite">{r.nome}</p>
                        <p className="text-xs text-aura-graphite-soft">{r.categoria}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${getTemperaturaColor(r.temperatura)}`}>
                        {r.temperatura}
                      </span>
                    </div>
                    <p className="font-display text-lg font-bold text-aura-graphite">{formatarMoeda(r.valorGerado || 0)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-aura-graphite-soft py-8">Sem dados</p>
            )}
          </div>
        )}

        {/* ABA 3: OPORTUNIDADES */}
        {abaAtiva === "oportunidades" && (
          <div className="rounded-2xl border border-aura-mist bg-white p-6">
            <p className="mb-4 text-lg font-semibold text-aura-graphite">Oportunidades de Maior Valor</p>
            {oportunidadesMaiorValor.length > 0 ? (
              <div className="space-y-3">
                {oportunidadesMaiorValor.map((o, idx) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between rounded-lg border border-aura-mist bg-aura-bg p-4"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-aura-petrol-600 text-white font-bold">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-medium text-aura-graphite">{o.cliente}</p>
                        <p className="text-xs text-aura-graphite-soft">{o.etapa} • {o.probabilidade}</p>
                      </div>
                    </div>
                    <p className="font-display text-lg font-bold text-aura-graphite">{formatarMoeda(o.valor || 0)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-aura-graphite-soft py-8">Sem dados</p>
            )}
          </div>
        )}

        {/* ABA 4: ATIVIDADES */}
        {abaAtiva === "atividades" && (
          <div className="rounded-2xl border border-aura-mist bg-white p-6">
            <p className="mb-4 text-lg font-semibold text-aura-graphite">Vendedores Mais Ativos</p>
            {vendedoresPorAtividades.length > 0 ? (
              <div className="space-y-3">
                {vendedoresPorAtividades.map((v, idx) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-lg border border-aura-mist bg-aura-bg p-4"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-aura-petrol-600 text-white font-bold">
                        {idx + 1}
                      </div>
                      <p className="font-medium text-aura-graphite">{v.nome}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-lg font-bold text-aura-graphite">{v.atividades}</p>
                      <p className="text-xs text-aura-graphite-soft">atividades</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-aura-graphite-soft py-8">Sem dados</p>
            )}
          </div>
        )}

        {/* ABA 5: PERFORMANCE */}
        {abaAtiva === "performance" && (
          <div className="rounded-2xl border border-aura-mist bg-white p-6">
            <p className="mb-4 text-lg font-semibold text-aura-graphite">Performance vs Meta</p>
            {performanceVsMeta.length > 0 ? (
              <div className="space-y-4">
                {performanceVsMeta.map((v, idx) => (
                  <div key={v.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-aura-petrol-600 text-white text-xs font-bold">
                          {idx + 1}
                        </div>
                        <p className="font-medium text-aura-graphite">{v.nome}</p>
                      </div>
                      <p className={`font-bold text-lg ${
                        v.atingimento >= 100 ? "text-aura-success" : "text-aura-warning"
                      }`}>
                        {v.atingimento.toFixed(0)}%
                      </p>
                    </div>
                    <div className="w-full bg-aura-mist rounded-lg h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          v.atingimento >= 100 ? "bg-aura-success" : "bg-aura-warning"
                        }`}
                        style={{ width: `${Math.min(v.atingimento, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-aura-graphite-soft">
                      <span>{formatarMoeda(v.valor)}</span>
                      <span>Meta: {formatarMoeda(v.meta)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-aura-graphite-soft py-8">Sem dados</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
