"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Medal, Star, TrendingUp, Wallet } from "lucide-react";
import { EstadoVazio, Segmentado, Selo, StatCard } from "@/components/ui";

/**
 * Painel avançado do ranking.
 *
 * Segue o tema (claro ou escuro), como o resto da AURA. As séries usam as
 * cores do tema, numa ordem fixa: ouro, verde, marca, vermelho — trocar a
 * ordem junta cores parecidas em barras vizinhas.
 */
const SERIE = ["var(--aura-gold)", "var(--aura-success)", "var(--aura-petrol-500)", "var(--aura-danger)"];

interface Parcela {
  criterioId: string;
  titulo: string;
  feito: number;
  meta: number;
  peso: number;
  pontos: number;
}

interface Nota {
  vendedorId: string;
  nome: string;
  loja: string;
  nota: number;
  posicao: number;
  parcelas: Parcela[];
  crmEmDia: number;
  bonus: boolean;
}

interface Resposta {
  notas: Nota[];
  eu: string;
  periodo: string;
  bonus: { crmMinimo: number; descricao: string };
  ranking: { id: string; faturamento: number }[];
}

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function RankingAvancado() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [dias, setDias] = useState(0);
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/ranking/geral${dias ? `?dias=${dias}` : ""}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (res.ok) setDados(json);
    } finally {
      setCarregando(false);
    }
  }, [dias]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carregando && !dados) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-aura-petrol-500" />
      </div>
    );
  }
  if (!dados?.notas?.length) {
    return (
      <EstadoVazio icone={Medal} titulo="Ainda não há vendedores no ranking deste período." />
    );
  }

  const notas = dados.notas;
  const faturamentoDe = (id: string) =>
    dados.ranking?.find((r) => r.id === id)?.faturamento ?? 0;

  const media = notas.reduce((s, n) => s + n.nota, 0) / notas.length;
  const faturamentoTotal = notas.reduce((s, n) => s + faturamentoDe(n.vendedorId), 0);
  const avaliacoes = notas.reduce(
    (s, n) => s + (n.parcelas.find((p) => /avalia/i.test(p.titulo))?.feito ?? 0),
    0,
  );
  const comBonus = notas.filter((n) => n.bonus).length;
  const maiorNota = Math.max(...notas.map((n) => n.nota), 1);

  const cartoes = [
    { rotulo: "Nota média da equipe", valor: media.toFixed(1), sufixo: "de 10", Icone: TrendingUp },
    { rotulo: "Faturamento no período", valor: moeda(faturamentoTotal), sufixo: "", Icone: Wallet },
    { rotulo: "Avaliações conquistadas", valor: String(avaliacoes), sufixo: "clientes", Icone: Star },
    {
      rotulo: dados.bonus.descricao,
      valor: `${comBonus}/${notas.length}`,
      sufixo: `com CRM ≥ ${dados.bonus.crmMinimo}%`,
      Icone: Medal,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Período */}
      <div className="flex flex-wrap items-center gap-2">
        <Segmentado
          rotulo="Período"
          valor={String(dias)}
          aoMudar={(v) => setDias(Number(v))}
          opcoes={[
            { valor: "0", rotulo: "Este mês" },
            { valor: "90", rotulo: "90 dias" },
            { valor: "365", rotulo: "12 meses" },
          ]}
        />
        {carregando && <Loader2 className="h-4 w-4 animate-spin text-aura-petrol-500" />}
      </div>

      {/* Indicadores */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cartoes.map((c) => (
          <StatCard key={c.rotulo} rotulo={c.rotulo} valor={c.valor} detalhe={c.sufixo || undefined} icone={c.Icone} />
        ))}
      </div>

      {/* Notas por vendedor */}
      <section className="aura-card p-5">
        <h3 className="text-sm font-semibold text-aura-graphite">Nota do período</h3>
        <p className="mb-4 text-xs text-aura-graphite-soft">
          Toque numa pessoa para ver de onde veio a nota dela.
        </p>

        <ul className="space-y-1">
          {notas.map((n) => {
            const eu = n.vendedorId === dados.eu;
            const largura = Math.max(2, (n.nota / maiorNota) * 100);
            return (
              <li key={n.vendedorId}>
                <button
                  type="button"
                  onClick={() => setAberto(aberto === n.vendedorId ? null : n.vendedorId)}
                  className={`w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-aura-sunken ${
                    eu ? "bg-aura-petrol-500/[0.06] ring-1 ring-aura-petrol-500/30" : ""
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="w-5 shrink-0 text-xs tabular-nums text-aura-graphite-soft">
                        {n.posicao}º
                      </span>
                      <span className="truncate text-sm font-medium text-aura-graphite">{n.nome}</span>
                      <span className="hidden truncate text-xs text-aura-graphite-soft sm:inline">
                        {n.loja}
                      </span>
                      {n.bonus && (
                        <Selo tom="ouro" className="shrink-0">
                          bônus
                        </Selo>
                      )}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-aura-graphite">
                      {n.nota.toFixed(1)}
                    </span>
                  </div>

                  {/* barra: uma série só, então rótulo direto dispensa legenda */}
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-aura-sunken">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${largura}%`, backgroundColor: SERIE[0] }}
                    />
                  </div>
                </button>

                {aberto === n.vendedorId && (
                  <div className="mb-2 ml-3 mr-3 rounded-lg border border-aura-mist bg-aura-sunken/50 p-4">
                    <p className="mb-3 text-xs text-aura-graphite-soft">
                      CRM preenchido em <strong className="font-semibold text-aura-graphite">{n.crmEmDia}%</strong>
                      {n.bonus
                        ? " — bônus liberado."
                        : ` — faltam ${Math.max(0, dados.bonus.crmMinimo - n.crmEmDia)} pontos para o bônus.`}
                    </p>
                    <ul className="space-y-2.5">
                      {n.parcelas.map((p, i) => {
                        const proporcao = p.meta > 0 ? Math.min(1, p.feito / p.meta) : 0;
                        return (
                          <li key={p.criterioId}>
                            <div className="flex items-baseline justify-between gap-2 text-xs">
                              <span className="truncate text-aura-graphite">{p.titulo}</span>
                              <span className="shrink-0 tabular-nums text-aura-graphite-soft">
                                {p.feito}/{p.meta} · {p.pontos.toFixed(1)} de {p.peso}
                              </span>
                            </div>
                            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-aura-mist">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(2, proporcao * 100)}%`,
                                  backgroundColor: SERIE[i % SERIE.length],
                                }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-center text-xs text-aura-graphite-soft">
        O ranking é do grupo. A carteira de cada um continua privada: aqui aparece só a posição,
        a nota e o quanto cada um fez em cada critério.
      </p>
    </div>
  );
}
