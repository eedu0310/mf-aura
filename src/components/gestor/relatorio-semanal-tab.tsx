"use client";

/**
 * O retrato da semana: o que a equipe fechou, o que perdeu, e onde cada pessoa
 * erra sempre.
 *
 * Os números vêm somados dos laudos que a AURA já escreveu no fechamento de
 * cada negócio. Não há IA sendo chamada aqui — o mesmo período dá sempre o
 * mesmo número, que é o que permite comparar uma semana com a outra.
 */
import { useEffect, useState, useCallback } from "react";
import { Loader2, CalendarRange, TrendingUp, AlertTriangle } from "lucide-react";
import { SeloOrigem } from "@/components/origem/selo-origem";

interface Contagem {
  item: string;
  vezes: number;
}

interface Vendedor {
  id: string;
  nome: string;
  decididos: number;
  fechou: number;
  perdeu: number;
  faturamento: number;
  conversao: number | null;
  pontosFracos: Contagem[];
  errosRecorrentes: Contagem[];
  acertosRecorrentes: Contagem[];
  pularamEtapa: number;
  etapasMaisPuladas: Contagem[];
}

interface Resposta {
  loja: string;
  dias: number;
  totais: {
    decididos: number;
    fechou: number;
    perdeu: number;
    faturamento: number;
    conversao: number | null;
  };
  lojaPontosFracos: Contagem[];
  lojaErros: Contagem[];
  porVendedor: Vendedor[];
  fechamentos: {
    vendedor: string;
    cliente: string | null;
    resultado: string;
    valor: number | null;
    origem: string | null;
    pontoFraco: string | null;
    resumo: string;
    quando: string;
  }[];
}

function moeda(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

const PERIODOS = [
  { dias: 7, label: "7 dias" },
  { dias: 14, label: "14 dias" },
  { dias: 30, label: "30 dias" },
];

export function RelatorioSemanalTab() {
  const [dias, setDias] = useState(7);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = useCallback(async (d: number) => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/gestor/relatorio-semanal?dias=${d}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro ?? "Não foi possível carregar.");
      setDados(j);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar(dias);
  }, [carregar, dias]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-aura-mist bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <CalendarRange size={20} className="mt-0.5 shrink-0 text-aura-petrol-600" />
            <div>
              <h3 className="font-display text-lg font-semibold text-aura-graphite">
                Relatório do período
              </h3>
              <p className="mt-1 text-sm text-aura-graphite-soft">
                Fechamentos, perdas e o padrão de erro de cada vendedor.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {PERIODOS.map((p) => (
              <button
                key={p.dias}
                type="button"
                onClick={() => setDias(p.dias)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  dias === p.dias
                    ? "bg-aura-petrol-700 text-white"
                    : "border border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-400"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {erro && (
          <p className="mt-4 rounded-lg bg-aura-danger/10 px-3 py-2 text-sm text-aura-danger">
            {erro}
          </p>
        )}

        {carregando ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-aura-graphite-soft">
            <Loader2 size={15} className="animate-spin" /> Carregando…
          </p>
        ) : !dados || dados.totais.decididos === 0 ? (
          <p className="mt-6 text-sm text-aura-graphite-soft">
            Nenhum negócio decidido neste período. O relatório se monta conforme
            a equipe fecha e perde negócios — cada decisão gera um laudo da AURA
            que entra aqui.
          </p>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { rotulo: "Fechou", valor: String(dados.totais.fechou), cor: "text-aura-success" },
                { rotulo: "Perdeu", valor: String(dados.totais.perdeu), cor: "text-aura-danger" },
                {
                  rotulo: "Conversão",
                  valor: dados.totais.conversao === null ? "—" : `${dados.totais.conversao}%`,
                  cor: "text-aura-graphite",
                },
                {
                  rotulo: "Faturamento",
                  valor: moeda(dados.totais.faturamento),
                  cor: "text-aura-graphite",
                },
              ].map((k) => (
                <div key={k.rotulo} className="rounded-xl border border-aura-mist p-4">
                  <p className="text-xs text-aura-graphite-soft">{k.rotulo}</p>
                  <p className={`mt-1 font-display text-xl font-bold ${k.cor}`}>{k.valor}</p>
                </div>
              ))}
            </div>

            {dados.lojaPontosFracos.length > 0 && (
              <div className="mt-5 rounded-xl border border-aura-warning/40 bg-aura-warning/5 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-aura-graphite">
                  <AlertTriangle size={15} className="text-aura-warning" />
                  Onde a loja está perdendo negócio
                </p>
                <p className="mt-2 text-sm text-aura-graphite-soft">
                  {dados.lojaPontosFracos
                    .map((p) => `${p.item} (${p.vezes}×)`)
                    .join(" · ")}
                </p>
                {dados.lojaErros.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {dados.lojaErros.map((e, i) => (
                      <li key={i} className="text-sm text-aura-graphite">
                        · {e.item}{" "}
                        <span className="text-aura-graphite-soft">({e.vezes}×)</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Por vendedor */}
      {dados && dados.porVendedor.length > 0 && (
        <div className="space-y-3">
          {dados.porVendedor.map((v) => (
            <div key={v.id} className="rounded-2xl border border-aura-mist bg-white p-5">
              <button
                type="button"
                onClick={() => setAberto(aberto === v.id ? null : v.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
              >
                <div>
                  <p className="font-display text-base font-semibold text-aura-graphite">
                    {v.nome}
                  </p>
                  <p className="mt-0.5 text-sm text-aura-graphite-soft">
                    {v.fechou} fechou · {v.perdeu} perdeu
                    {v.conversao !== null && ` · ${v.conversao}% de conversão`}
                    {v.pularamEtapa > 0 && ` · ${v.pularamEtapa} pularam etapa`}
                  </p>
                </div>
                <p className="flex items-center gap-1.5 font-display text-lg font-bold text-aura-graphite">
                  <TrendingUp size={16} className="text-aura-petrol-600" />
                  {moeda(v.faturamento)}
                </p>
              </button>

              {aberto === v.id && (
                <div className="mt-4 grid gap-4 border-t border-aura-mist pt-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-aura-graphite-soft">
                      Onde erra sempre
                    </p>
                    {v.pontosFracos.length === 0 ? (
                      <p className="mt-1.5 text-sm text-aura-graphite-soft">
                        Nenhum padrão de falha no período.
                      </p>
                    ) : (
                      <ul className="mt-1.5 space-y-1">
                        {v.pontosFracos.map((p, i) => (
                          <li key={i} className="text-sm text-aura-graphite">
                            {p.item}{" "}
                            <span className="text-aura-graphite-soft">({p.vezes}×)</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {v.errosRecorrentes.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {v.errosRecorrentes.map((e, i) => (
                          <li key={i} className="text-xs text-aura-graphite-soft">
                            · {e.item} ({e.vezes}×)
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-aura-graphite-soft">
                      O que está funcionando
                    </p>
                    {v.acertosRecorrentes.length === 0 ? (
                      <p className="mt-1.5 text-sm text-aura-graphite-soft">
                        Sem padrão de acerto registrado ainda.
                      </p>
                    ) : (
                      <ul className="mt-1.5 space-y-1">
                        {v.acertosRecorrentes.map((a, i) => (
                          <li key={i} className="text-sm text-aura-graphite">
                            {a.item}{" "}
                            <span className="text-aura-graphite-soft">({a.vezes}×)</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {v.etapasMaisPuladas.length > 0 && (
                      <>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-aura-graphite-soft">
                          Etapas que pula
                        </p>
                        <p className="mt-1 text-sm text-aura-graphite">
                          {v.etapasMaisPuladas.map((e) => `${e.item} (${e.vezes}×)`).join(" · ")}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Os negócios dessa pessoa, caso a caso. */}
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-aura-graphite-soft">
                      Negócios decididos
                    </p>
                    <ul className="mt-2 space-y-2">
                      {dados.fechamentos
                        .filter((f) => f.vendedor === v.nome)
                        .map((f, i) => (
                          <li
                            key={i}
                            className="rounded-lg border border-aura-mist bg-aura-bg/50 p-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  f.resultado === "fechado"
                                    ? "bg-aura-success text-white"
                                    : "bg-aura-danger text-white"
                                }`}
                              >
                                {f.resultado === "fechado" ? "Fechou" : "Perdeu"}
                              </span>
                              <span className="text-sm font-medium text-aura-graphite">
                                {f.cliente ?? "Cliente"}
                              </span>
                              {f.valor != null && (
                                <span className="text-sm text-aura-graphite-soft">
                                  {moeda(f.valor)}
                                </span>
                              )}
                              <SeloOrigem origem={f.origem} tamanho={11} />
                            </div>
                            <p className="mt-2 text-sm text-aura-graphite-soft">{f.resumo}</p>
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
