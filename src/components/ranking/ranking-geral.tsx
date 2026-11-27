"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Store, Trophy } from "lucide-react";
import { Alerta, Segmentado } from "@/components/ui";

interface Linha {
  id: string;
  nome: string;
  loja: string;
  valor: number;
  posicao: number;
  /** A pessoa não tinha como ter esta medida no período (ex.: ticket sem venda). */
  semDado?: boolean;
}

interface Disputa {
  id: string;
  titulo: string;
  descricao: string;
  unidade: "moeda" | "quantidade" | "percentual" | "dias";
  /** Menor é melhor (ciclo, cancelamentos). */
  inversa?: boolean;
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
  const comDado = (disputa?.linhas ?? []).filter((l) => !l.semDado);
  // A barra cheia é o melhor: o maior, ou o menor nas medidas "menor é melhor".
  const lider = disputa?.inversa
    ? Math.min(...comDado.map((l) => l.valor).filter((v) => v > 0), Infinity)
    : Math.max(0, ...comDado.map((l) => l.valor));
  const minhaLinha = disputa?.linhas.find((l) => l.id === dados?.eu);

  return (
    <div className="space-y-4">
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

      {erro && <Alerta tom="perigo" titulo={erro} />}

      {dados && (
        <>
          <Segmentado
            rotulo="Disputa"
            valor={disputa?.id ?? ""}
            aoMudar={setAba}
            opcoes={dados.rankings.map((r) => ({ valor: r.id, rotulo: r.titulo }))}
          />

          {disputa && (
            <section className="aura-card overflow-hidden">
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
                  <p className="text-xs font-medium text-aura-petrol-600">
                    Você está em {minhaLinha.posicao}º de {disputa.linhas.length}
                  </p>
                )}
              </header>

              <ul className="divide-y divide-aura-mist">
                {disputa.linhas.map((linha) => {
                  const sou = linha.id === dados.eu;
                  const proporcao = linha.semDado
                    ? 0
                    : disputa.inversa
                      ? linha.valor <= 0
                        ? 100
                        : Number.isFinite(lider)
                          ? Math.max(2, Math.round((lider / linha.valor) * 100))
                          : 0
                      : lider > 0
                        ? Math.max(2, Math.round((linha.valor / lider) * 100))
                        : 0;
                  return (
                    <li
                      key={linha.id}
                      className={`flex items-center gap-3 px-5 py-3 ${sou ? "bg-aura-petrol-500/[0.06]" : ""}`}
                    >
                      <Posicao n={linha.posicao} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-aura-graphite">
                          {linha.nome}
                          {sou && <span className="ml-2 text-xs font-medium text-aura-petrol-600">você</span>}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-aura-graphite-soft">
                          <Store size={11} />
                          {linha.loja}
                        </p>
                        <div className="mt-1.5 h-1.5 w-full max-w-56 rounded-full bg-aura-sunken">
                          <div
                            className={`h-1.5 rounded-full ${sou ? "bg-aura-petrol-500" : "bg-aura-graphite-soft/40"}`}
                            style={{ width: `${proporcao}%` }}
                          />
                        </div>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-aura-graphite">
                        {linha.semDado
                          ? <span className="text-xs font-normal text-aura-graphite-soft" title="Fora da conta: não tinha como ter esta medida no período">—</span>
                          : disputa.unidade === "moeda"
                          ? moeda(linha.valor)
                          : disputa.unidade === "percentual"
                            ? `${linha.valor}%`
                            : disputa.unidade === "dias"
                              ? `${linha.valor} dias`
                              : linha.valor}
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

              <p className="border-t border-aura-mist bg-aura-sunken/50 px-5 py-3 text-xs text-aura-graphite-soft">
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
