"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy, Medal, Zap } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { CardHeader, EstadoVazio } from "@/components/ui";

export function RankingGamificado() {
  const { vendas, atividades, nomesPorOwnerId } = useAppData();
  const [rankingGeral, setRankingGeral] = useState<Array<{ id: string; nome: string; faturamento: number | null; vendas: number; atividades: number; pontos: number }>>([]);

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
    if (posicao === 1) return { icon: Trophy, cor: "text-aura-gold", bg: "bg-aura-gold/15" };
    if (posicao === 2) return { icon: Medal, cor: "text-aura-graphite-soft", bg: "bg-aura-sunken" };
    if (posicao === 3) return { icon: Medal, cor: "text-aura-gold-700", bg: "bg-aura-gold/10" };
    return { icon: Zap, cor: "text-aura-graphite-soft", bg: "bg-aura-sunken" };
  }

  // null é o R$ de um colega, que a rota só manda para o gestor: mostrar
  // "R$ 0" daria a entender que a pessoa não vendeu nada.
  function formatarMoeda(valor: number | null) {
    if (valor === null) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(valor);
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Top 3 Destaque */}
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {pontuacaoVendedoresExibida.slice(0, 3).map((v, idx) => {
          const medalha = getMedalha(idx + 1);
          const Icon = medalha.icon;
          return (
            <div
              key={v.id}
              className={`aura-card p-5 text-center ${
                idx === 0 ? "border-aura-gold/50" : ""
              }`}
            >
              <div className={`mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl ${medalha.bg}`}>
                <Icon size={20} className={medalha.cor} />
              </div>
              <p className="font-display text-2xl font-semibold tabular-nums text-aura-graphite">
                {idx + 1}º
              </p>
              <p className="mt-1 text-sm font-medium text-aura-graphite">{v.nomeVendedor}</p>
              <div className="mt-3 space-y-1 text-sm text-aura-graphite-soft">
                <p className="text-base font-semibold tabular-nums text-aura-petrol-600">{v.pontos.toLocaleString()} pontos</p>
                <p>{v.vendas} vendas • {v.atividades} atividades</p>
                <p className="text-xs">{formatarMoeda(v.valor)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ranking Completo */}
      <div className="aura-card p-5">
        <CardHeader titulo="Ranking Completo" icone={Trophy} />
        {pontuacaoVendedoresExibida.length > 0 ? (
          <div className="divide-y divide-aura-mist">
            {pontuacaoVendedoresExibida.map((v, idx) => {
              const medalha = getMedalha(idx + 1);
              const Icon = medalha.icon;
              return (
                <div
                  key={v.id}
                  className="flex min-w-0 items-center justify-between gap-3 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${medalha.bg}`}>
                      <Icon size={15} className={medalha.cor} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-aura-graphite">{v.nomeVendedor}</p>
                      <p className="text-xs text-aura-graphite-soft">
                        {v.vendas} vendas • {v.atividades} atividades
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-base font-semibold tabular-nums text-aura-graphite">
                      {v.pontos.toLocaleString()}
                    </p>
                    <p className="text-xs text-aura-graphite-soft">pontos</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EstadoVazio icone={Trophy} titulo="Sem dados de vendas" />
        )}
      </div>

      {/* Dicas de Pontuação */}
      <div className="rounded-xl border border-aura-mist bg-aura-sunken/50 p-5">
        <p className="mb-3 text-sm font-semibold text-aura-graphite">Como ganhar pontos:</p>
        <div className="space-y-2 text-sm text-aura-graphite-soft">
          <p>🎯 <span className="font-medium text-aura-graphite">Venda fechada:</span> 100 pontos</p>
          <p>📞 <span className="font-medium text-aura-graphite">Atividade registrada:</span> 10 pontos</p>
          <p>⭐ <span className="font-medium text-aura-graphite">Bônus mensal:</span> Top 3 recebe reconhecimento</p>
        </div>
      </div>
    </div>
  );
}
