"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Medal, Star, TrendingUp, Wallet } from "lucide-react";

/**
 * Painel avançado do ranking.
 *
 * Fundo escuro, na linha do resto do AURA. A paleta das séries foi validada
 * para daltonismo e contraste contra a superfície escura — por isso a ordem
 * das cores é fixa e não pode ser embaralhada: trocar a ordem quebra a
 * separação entre as barras vizinhas.
 */
const SERIE = ["#b8862a", "#1fa873", "#2f8fd4", "#d4564a"];

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
        <Loader2 className="h-6 w-6 animate-spin text-aura-gold" />
      </div>
    );
  }
  if (!dados?.notas?.length) {
    return (
      <p className="rounded-2xl bg-aura-navy-900 px-5 py-8 text-center text-sm text-white/60">
        Ainda não há vendedores no ranking deste período.
      </p>
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
    <div className="space-y-5 rounded-2xl bg-aura-navy-950 p-4 sm:p-6">
      {/* Período */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { v: 0, r: "Este mês" },
          { v: 90, r: "90 dias" },
          { v: 365, r: "12 meses" },
        ].map((p) => (
          <button
            key={p.v}
            type="button"
            onClick={() => setDias(p.v)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              dias === p.v
                ? "bg-aura-gold text-aura-navy-950"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            {p.r}
          </button>
        ))}
      </div>

      {/* Indicadores */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cartoes.map((c) => (
          <div key={c.rotulo} className="rounded-2xl bg-aura-navy-900 p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/50">
              <c.Icone size={13} /> {c.rotulo}
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-white">{c.valor}</p>
            {c.sufixo && <p className="mt-0.5 text-xs text-white/50">{c.sufixo}</p>}
          </div>
        ))}
      </div>

      {/* Notas por vendedor */}
      <section className="rounded-2xl bg-aura-navy-900 p-5">
        <h3 className="text-sm font-semibold text-white">Nota do período</h3>
        <p className="mb-4 text-xs text-white/50">
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
                  className={`w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-white/5 ${
                    eu ? "bg-white/5 ring-1 ring-aura-gold/40" : ""
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="w-5 shrink-0 text-xs tabular-nums text-white/40">
                        {n.posicao}º
                      </span>
                      <span className="truncate text-sm font-medium text-white">{n.nome}</span>
                      <span className="hidden truncate text-xs text-white/40 sm:inline">
                        {n.loja}
                      </span>
                      {n.bonus && (
                        <span className="shrink-0 rounded-full bg-aura-gold/20 px-1.5 py-0.5 text-[10px] font-semibold text-aura-gold-soft">
                          bônus
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-white">
                      {n.nota.toFixed(1)}
                    </span>
                  </div>

                  {/* barra: uma série só, então rótulo direto dispensa legenda */}
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${largura}%`, backgroundColor: SERIE[0] }}
                    />
                  </div>
                </button>

                {aberto === n.vendedorId && (
                  <div className="mb-2 ml-3 mr-3 rounded-xl bg-aura-navy-950 p-4">
                    <p className="mb-3 text-xs text-white/50">
                      CRM preenchido em <strong className="text-white/80">{n.crmEmDia}%</strong>
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
                              <span className="truncate text-white/80">{p.titulo}</span>
                              <span className="shrink-0 tabular-nums text-white/50">
                                {p.feito}/{p.meta} · {p.pontos.toFixed(1)} de {p.peso}
                              </span>
                            </div>
                            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
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

      <p className="text-center text-xs text-white/40">
        O ranking é do grupo. A carteira de cada um continua privada: aqui aparece só a posição,
        a nota e o quanto cada um fez em cada critério.
      </p>
    </div>
  );
}
