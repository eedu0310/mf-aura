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
import { Loader2, TrendingUp, ChevronDown } from "lucide-react";
import { SeloOrigem } from "@/components/origem/selo-origem";
import { Alerta, Card, EstadoVazio, Segmentado, Selo, StatCard } from "@/components/ui";

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-aura-graphite-soft">
          Fechamentos, perdas e o padrão de erro de cada vendedor.
        </p>
        <Segmentado
          rotulo="Período"
          opcoes={PERIODOS.map((p) => ({ valor: String(p.dias), rotulo: p.label }))}
          valor={String(dias)}
          aoMudar={(v) => setDias(Number(v))}
        />
      </div>

      {erro && <Alerta tom="perigo" titulo={erro} />}

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-aura-graphite-soft">
          <Loader2 size={15} className="animate-spin" /> Carregando…
        </p>
      ) : !dados || dados.totais.decididos === 0 ? (
        <EstadoVazio
          titulo="Nenhum negócio decidido neste período."
          descricao="O relatório se monta conforme a equipe fecha e perde negócios — cada decisão gera um laudo da AURA que entra aqui."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard rotulo="Fechou" valor={String(dados.totais.fechou)} tom="sucesso" />
            <StatCard rotulo="Perdeu" valor={String(dados.totais.perdeu)} tom="perigo" />
            <StatCard
              rotulo="Conversão"
              valor={dados.totais.conversao === null ? "—" : `${dados.totais.conversao}%`}
            />
            <StatCard rotulo="Faturamento" valor={moeda(dados.totais.faturamento)} />
          </div>

          {dados.lojaPontosFracos.length > 0 && (
            <Alerta
              tom="atencao"
              titulo="Onde a loja está perdendo negócio"
              descricao={
                <>
                  <p className="text-sm">
                    {dados.lojaPontosFracos
                      .map((p) => `${p.item} (${p.vezes}×)`)
                      .join(" · ")}
                  </p>
                  {dados.lojaErros.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {dados.lojaErros.map((e, i) => (
                        <li key={i} className="text-sm text-aura-graphite">
                          · {e.item}{" "}
                          <span className="text-aura-graphite-soft">({e.vezes}×)</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              }
            />
          )}
        </>
      )}

      {/* Por vendedor */}
      {dados && dados.porVendedor.length > 0 && (
        <div className="flex flex-col gap-3">
          {dados.porVendedor.map((v) => (
            <Card key={v.id} semPadding>
              <button
                type="button"
                onClick={() => setAberto(aberto === v.id ? null : v.id)}
                aria-expanded={aberto === v.id}
                className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl px-5 py-4 text-left transition hover:bg-aura-sunken/60"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-aura-graphite">{v.nome}</p>
                  <p className="mt-0.5 text-xs text-aura-graphite-soft">
                    {v.fechou} fechou · {v.perdeu} perdeu
                    {v.conversao !== null && ` · ${v.conversao}% de conversão`}
                    {v.pularamEtapa > 0 && ` · ${v.pularamEtapa} pularam etapa`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="flex items-center gap-1.5 font-display text-base font-semibold tabular-nums text-aura-graphite">
                    <TrendingUp size={15} className="text-aura-petrol-600" />
                    {moeda(v.faturamento)}
                  </p>
                  <ChevronDown
                    size={16}
                    className={`text-aura-graphite-soft transition ${aberto === v.id ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </div>
              </button>

              {aberto === v.id && (
                <div className="grid gap-5 border-t border-aura-mist px-5 py-4 sm:grid-cols-2">
                  <div>
                    <p className="aura-rotulo">Onde erra sempre</p>
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
                    <p className="aura-rotulo">O que está funcionando</p>
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
                        <p className="aura-rotulo mt-3">Etapas que pula</p>
                        <p className="mt-1 text-sm text-aura-graphite">
                          {v.etapasMaisPuladas.map((e) => `${e.item} (${e.vezes}×)`).join(" · ")}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Os negócios dessa pessoa, caso a caso. */}
                  <div className="sm:col-span-2">
                    <p className="aura-rotulo">Negócios decididos</p>
                    <ul className="mt-2 space-y-2">
                      {dados.fechamentos
                        .filter((f) => f.vendedor === v.nome)
                        .map((f, i) => (
                          <li key={i} className="rounded-lg border border-aura-mist bg-aura-sunken/50 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Selo tom={f.resultado === "fechado" ? "sucesso" : "perigo"}>
                                {f.resultado === "fechado" ? "Fechou" : "Perdeu"}
                              </Selo>
                              <span className="text-sm font-medium text-aura-graphite">
                                {f.cliente ?? "Cliente"}
                              </span>
                              {f.valor != null && (
                                <span className="text-sm tabular-nums text-aura-graphite-soft">
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
