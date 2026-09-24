"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Store, Trophy } from "lucide-react";

interface Linha {
  id: string;
  nome: string;
  loja: string;
  valor: number;
  posicao: number;
}

interface Disputa {
  id: string;
  titulo: string;
  descricao: string;
  unidade: "moeda" | "quantidade";
  linhas: Linha[];
}

interface Resposta {
  eu: string;
  periodo: string;
  rankings: Disputa[];
}

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/** Medalha nas três primeiras posições, número nas demais. */
function Posicao({ n }: { n: number }) {
  const medalha = n === 1 ? "🥇" : n === 2 ? "🥈" : n === 3 ? "🥉" : null;
  if (medalha) {
    return (
      <span className="flex h-8 w-8 items-center justify-center text-lg" aria-label={`${n}º lugar`}>
        {medalha}
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center text-sm font-semibold tabular-nums text-aura-graphite-soft">
      {n}º
    </span>
  );
}

/**
 * Ranking do grupo: todos os vendedores, de todas as lojas, na mesma lista.
 * Mostra só posição e número — carteira de cliente não aparece para ninguém.
 */
export function RankingGeral() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [dias, setDias] = useState(0);
  const [aba, setAba] = useState("faturamento");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/ranking/geral${dias ? `?dias=${dias}` : ""}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro ?? "Não consegui carregar o ranking.");
      setDados(json);
      setErro(null);
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui carregar o ranking.");
    } finally {
      setCarregando(false);
    }
  }, [dias]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const disputa = dados?.rankings.find((r) => r.id === aba) ?? dados?.rankings[0];
  const lider = disputa?.linhas[0]?.valor ?? 0;
  const minhaLinha = disputa?.linhas.find((l) => l.id === dados?.eu);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-aura-mist bg-white p-1">
          {[
            { v: 0, r: "Este mês" },
            { v: 90, r: "90 dias" },
            { v: 365, r: "12 meses" },
          ].map((p) => (
            <button
              key={p.v}
              type="button"
              onClick={() => setDias(p.v)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                dias === p.v ? "bg-aura-navy-950 text-aura-gold" : "text-aura-graphite-soft hover:text-aura-graphite"
              }`}
            >
              {p.r}
            </button>
          ))}
        </div>
        {carregando && <Loader2 className="h-4 w-4 animate-spin text-aura-petrol-500" />}
      </div>

      {erro && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}

      {dados && (
        <>
          <div className="flex flex-wrap gap-2">
            {dados.rankings.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setAba(r.id)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  (disputa?.id ?? "") === r.id
                    ? "border-aura-navy-950 bg-aura-navy-950 text-aura-gold"
                    : "border-aura-mist bg-white text-aura-graphite hover:bg-aura-bg"
                }`}
              >
                {r.titulo}
              </button>
            ))}
          </div>

          {disputa && (
            <section className="overflow-hidden rounded-2xl border border-aura-mist bg-white shadow-sm">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-aura-mist px-5 py-4">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-aura-graphite">
                    <Trophy size={15} className="text-aura-gold" />
                    {disputa.titulo}
                  </h3>
                  <p className="text-xs text-aura-graphite-soft">
                    {disputa.descricao} · {dados.periodo} · todas as lojas
                  </p>
                </div>
                {minhaLinha && (
                  <p className="text-xs font-medium text-aura-petrol-700">
                    Você está em {minhaLinha.posicao}º de {disputa.linhas.length}
                  </p>
                )}
              </header>

              <ul className="divide-y divide-aura-mist">
                {disputa.linhas.map((linha) => {
                  const sou = linha.id === dados.eu;
                  const proporcao = lider > 0 ? Math.max(2, Math.round((linha.valor / lider) * 100)) : 0;
                  return (
                    <li
                      key={linha.id}
                      className={`flex items-center gap-3 px-5 py-3 ${sou ? "bg-aura-gold/10" : ""}`}
                    >
                      <Posicao n={linha.posicao} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-aura-graphite">
                          {linha.nome}
                          {sou && <span className="ml-2 text-xs font-semibold text-aura-petrol-700">você</span>}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-aura-graphite-soft">
                          <Store size={11} />
                          {linha.loja}
                        </p>
                        <div className="mt-1.5 h-1.5 w-full max-w-56 rounded-full bg-aura-mist">
                          <div
                            className={`h-1.5 rounded-full ${sou ? "bg-aura-gold" : "bg-aura-petrol-600"}`}
                            style={{ width: `${proporcao}%` }}
                          />
                        </div>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-aura-graphite">
                        {disputa.unidade === "moeda" ? moeda(linha.valor) : linha.valor}
                      </p>
                    </li>
                  );
                })}
                {disputa.linhas.length === 0 && (
                  <li className="px-5 py-10 text-center text-sm text-aura-graphite-soft">
                    Nenhum vendedor ativo para comparar ainda.
                  </li>
                )}
              </ul>

              <p className="border-t border-aura-mist bg-aura-bg/50 px-5 py-3 text-xs text-aura-graphite-soft">
                O ranking é do grupo inteiro. A carteira de cada um continua privada: aqui aparece
                só a posição e o número da disputa.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
