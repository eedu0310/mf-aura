"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy, Medal, Zap } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";

export function RankingGamificado() {
  const { vendas, atividades, nomesPorOwnerId } = useAppData();
  const [rankingGeral, setRankingGeral] = useState<Array<{ id: string; nome: string; faturamento: number; vendas: number; atividades: number; pontos: number }>>([]);

  useEffect(() => {
    fetch("/api/ranking/geral", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((dados) => setRankingGeral(dados?.ranking ?? []))
      .catch(() => setRankingGeral([]));
  }, []);

  const todasVendas = Array.isArray(vendas) ? vendas : [];
  const todasAtividades = Array.isArray(atividades) ? atividades : [];

  // ========== PONTUAÇÃO GAMIFICADA ==========
  const pontuacaoVendedores = useMemo(() => {
    const vendedoresMap: Record<string, {
      valor: number;
      vendas: number;
      atividades: number;
      pontos: number;
      nomeVendedor?: string;
    }> = {};

    // Processar vendas
    todasVendas.forEach((v) => {
      const vendedorId = v.ownerId || "Sem ID";
      if (!vendedoresMap[vendedorId]) {
        vendedoresMap[vendedorId] = { valor: 0, vendas: 0, atividades: 0, pontos: 0 };
      }
      vendedoresMap[vendedorId].valor += v.valor || 0;
      vendedoresMap[vendedorId].vendas += 1;
      vendedoresMap[vendedorId].nomeVendedor = nomesPorOwnerId[vendedorId] || "Vendedor";
    });

    // Processar atividades
    todasAtividades.forEach((a) => {
      const vendedorId = a.ownerId || "Sem ID";
      if (!vendedoresMap[vendedorId]) {
        vendedoresMap[vendedorId] = { valor: 0, vendas: 0, atividades: 0, pontos: 0 };
      }
      vendedoresMap[vendedorId].atividades += 1;
      vendedoresMap[vendedorId].nomeVendedor = nomesPorOwnerId[vendedorId] || "Vendedor";
    });

    // Calcular pontos (Vendas: 100pts, Atividades: 10pts)
    Object.keys(vendedoresMap).forEach((id) => {
      const dados = vendedoresMap[id];
      dados.pontos = dados.vendas * 100 + dados.atividades * 10;
    });

    return Object.entries(vendedoresMap)
      .map(([id, dados]) => ({ id, ...dados }))
      .sort((a, b) => b.pontos - a.pontos);
  }, [todasVendas, todasAtividades, nomesPorOwnerId]);

  const pontuacaoVendedoresExibida = rankingGeral.length > 0
    ? rankingGeral.map((v) => ({
        id: v.id,
        valor: v.faturamento,
        vendas: v.vendas,
        atividades: v.atividades,
        pontos: v.pontos,
        nomeVendedor: v.nome,
      }))
    : pontuacaoVendedores;

  function getMedalha(posicao: number) {
    if (posicao === 1) return { icon: Trophy, cor: "text-yellow-500", bg: "bg-yellow-100" };
    if (posicao === 2) return { icon: Medal, cor: "text-gray-400", bg: "bg-gray-100" };
    if (posicao === 3) return { icon: Medal, cor: "text-orange-600", bg: "bg-orange-100" };
    return { icon: Zap, cor: "text-blue-500", bg: "bg-blue-100" };
  }

  function formatarMoeda(valor: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(valor);
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-6 pb-24">
      {/* Top 3 Destaque */}
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pontuacaoVendedoresExibida.slice(0, 3).map((v, idx) => {
          const medalha = getMedalha(idx + 1);
          const Icon = medalha.icon;
          return (
            <div
              key={v.id}
              className={`rounded-2xl border-2 border-aura-mist bg-white p-6 text-center transition ${
                idx === 0 ? "ring-2 ring-yellow-300 shadow-lg" : ""
              }`}
            >
              <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full ${medalha.bg}`}>
                <Icon size={32} className={medalha.cor} />
              </div>
              <p className="font-display text-2xl font-bold text-aura-graphite">
                {idx + 1}º
              </p>
              <p className="mt-2 font-semibold text-aura-graphite">{v.nomeVendedor}</p>
              <div className="mt-3 space-y-1 text-sm text-aura-graphite-soft">
                <p className="font-medium text-lg text-aura-petrol-700">{v.pontos.toLocaleString()} pontos</p>
                <p>{v.vendas} vendas • {v.atividades} atividades</p>
                <p className="text-xs">{formatarMoeda(v.valor)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ranking Completo */}
      <div className="rounded-2xl border border-aura-mist bg-white p-6">
        <p className="mb-4 text-lg font-semibold text-aura-graphite">Ranking Completo</p>
        {pontuacaoVendedoresExibida.length > 0 ? (
          <div className="space-y-2">
            {pontuacaoVendedoresExibida.map((v, idx) => {
              const medalha = getMedalha(idx + 1);
              const Icon = medalha.icon;
              return (
                <div
                  key={v.id}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-aura-mist bg-aura-bg p-4 hover:shadow-md transition"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${medalha.bg}`}>
                      <Icon size={20} className={medalha.cor} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-aura-graphite">{v.nomeVendedor}</p>
                      <p className="text-xs text-aura-graphite-soft">
                        {v.vendas} vendas • {v.atividades} atividades
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-bold text-aura-graphite">
                      {v.pontos.toLocaleString()}
                    </p>
                    <p className="text-xs text-aura-graphite-soft">pontos</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-sm text-aura-graphite-soft py-8">Sem dados de vendas</p>
        )}
      </div>

      {/* Dicas de Pontuação */}
      <div className="rounded-2xl border border-aura-mist bg-aura-bg p-6">
        <p className="mb-3 font-medium text-aura-graphite">Como ganhar pontos:</p>
        <div className="space-y-2 text-sm text-aura-graphite-soft">
          <p>🎯 <span className="font-medium text-aura-graphite">Venda fechada:</span> 100 pontos</p>
          <p>📞 <span className="font-medium text-aura-graphite">Atividade registrada:</span> 10 pontos</p>
          <p>⭐ <span className="font-medium text-aura-graphite">Bônus mensal:</span> Top 3 recebe reconhecimento</p>
        </div>
      </div>
    </div>
  );
}
