"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  Loader2,
  MinusCircle,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Alerta, EstadoVazio, Selo } from "@/components/ui";

interface Linha {
  id: string;
  nome: string;
  cargo: string;
  atividades: number;
  contatosNovos: number;
  leadsRecebidos: number;
  leadsRespondidos: number;
  oportunidadesNovas: number;
  oportunidadesMovidas: number;
  conversas: number;
  vendas: number;
  faturamento: number;
  porTipo: Record<string, number>;
  primeiraEm: string | null;
  ultimaEm: string | null;
  media: { atividades: number; leadsRecebidos: number; conversas: number };
  diasAtivosNaSemana: number;
  semMovimento: boolean;
  total: number;
}

interface Resposta {
  dia: string;
  loja: string;
  ehHoje: boolean;
  vendedores: Linha[];
  totais: Record<string, number>;
}

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Comparação com o próprio histórico da pessoa.
 *
 * É isto que transforma "12 atividades" em informação. Sem referência, o
 * gestor compara vendedor com vendedor — e carteiras e rotas são diferentes.
 */
function Comparado({ valor, media }: { valor: number; media: number }) {
  if (media <= 0) return null;
  const dif = Math.round(((valor - media) / media) * 100);
  if (Math.abs(dif) < 20) return null;
  const acima = dif > 0;
  return (
    <span
      className={`ml-1.5 inline-flex items-center gap-0.5 text-[11px] ${
        acima ? "text-aura-success" : "text-aura-gold-700"
      }`}
      title={`Média dele nos dias trabalhados: ${media}`}
    >
      {acima ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {acima ? "+" : ""}
      {dif}%
    </span>
  );
}

function Numero({
  rotulo,
  valor,
  media,
}: {
  rotulo: string;
  valor: number;
  media?: number;
}) {
  return (
    <div>
      <p className="aura-rotulo">{rotulo}</p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums text-aura-graphite">
        {valor}
        {media !== undefined && <Comparado valor={valor} media={media} />}
      </p>
    </div>
  );
}

export function MovimentacaoTab() {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const [dia, setDia] = useState(hoje);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = useCallback(async (d: string) => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/gestor/movimentacao?dia=${d}`, { cache: "no-store" });
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
    void carregar(dia);
  }, [carregar, dia]);

  const t = dados?.totais ?? {};
  const parados = dados?.vendedores.filter((v) => v.semMovimento) ?? [];
  const ativos = dados?.vendedores.filter((v) => !v.semMovimento) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-sm text-aura-graphite-soft">
          O que cada pessoa fez. Cada número vem comparado com a média dela
          nos dias em que trabalhou, não com a dos colegas.
        </p>
        <label className="flex items-center gap-2 text-sm text-aura-graphite">
          <CalendarDays className="h-4 w-4 text-aura-graphite-soft" />
          <input
            type="date"
            value={dia}
            max={hoje}
            onChange={(e) => setDia(e.target.value)}
            className="aura-input w-auto"
          />
        </label>
      </div>

      {carregando && (
        <p className="flex items-center gap-2 text-sm text-aura-graphite-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      )}
      {erro && <Alerta tom="perigo" titulo={erro} />}

      {dados && !carregando && (
        <div className="aura-card grid grid-cols-2 gap-4 p-5 sm:grid-cols-4 lg:grid-cols-7">
          <Numero rotulo="Atividades" valor={Number(t.atividades ?? 0)} />
          <Numero rotulo="Contatos novos" valor={Number(t.contatosNovos ?? 0)} />
          <Numero rotulo="Leads recebidos" valor={Number(t.leadsRecebidos ?? 0)} />
          <Numero rotulo="Leads respondidos" valor={Number(t.leadsRespondidos ?? 0)} />
          <Numero rotulo="Negócios novos" valor={Number(t.oportunidadesNovas ?? 0)} />
          <Numero rotulo="Negócios movidos" valor={Number(t.oportunidadesMovidas ?? 0)} />
          <Numero rotulo="Conversas" valor={Number(t.conversas ?? 0)} />
        </div>
      )}

      {/*
        Quem não registrou NADA vem primeiro e separado de quem fez pouco.
        São conversas diferentes: ou a pessoa não trabalhou, ou trabalhou e
        não registrou — e o gestor precisa saber qual das duas para perguntar
        a coisa certa.
      */}
      {dados && !carregando && parados.length > 0 && (
        <Alerta
          tom="atencao"
          icone={MinusCircle}
          titulo={`Sem nenhum registro ${dados.ehHoje ? "até agora" : "neste dia"}`}
          descricao={
            <>
              <p className="text-sm text-aura-graphite">{parados.map((p) => p.nome).join(", ")}</p>
              <p className="mt-1">
                Pode ser folga, pode ser dia sem registro. O sistema não sabe a
                diferença — quem sabe é você.
              </p>
            </>
          }
        />
      )}

      {dados && !carregando && ativos.length > 0 && (
        <div className="flex flex-col gap-3">
          {ativos.map((v) => {
            const expandido = aberto === v.id;
            return (
              <div key={v.id} className="aura-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setAberto(expandido ? null : v.id)}
                  className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left transition hover:bg-aura-sunken/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-aura-graphite">
                      {v.nome}{" "}
                      <span className="font-normal text-aura-graphite-soft">· {v.cargo}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-aura-graphite-soft">
                      {v.primeiraEm
                        ? `Primeiro registro ${v.primeiraEm} · último ${v.ultimaEm}`
                        : "Sem atividade registrada à mão neste dia"}
                      {v.diasAtivosNaSemana > 0 && ` · ativo em ${v.diasAtivosNaSemana} dos últimos 7 dias`}
                    </p>
                  </div>
                  <ChevronDown
                    className={`mt-1 h-4 w-4 shrink-0 text-aura-graphite-soft transition ${
                      expandido ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div className="grid grid-cols-2 gap-4 border-t border-aura-mist px-5 py-4 sm:grid-cols-4">
                  <Numero rotulo="Atividades" valor={v.atividades} media={v.media.atividades} />
                  <Numero rotulo="Leads" valor={v.leadsRecebidos} media={v.media.leadsRecebidos} />
                  <Numero rotulo="Conversas" valor={v.conversas} media={v.media.conversas} />
                  <Numero rotulo="Negócios movidos" valor={v.oportunidadesNovas + v.oportunidadesMovidas} />
                </div>

                {expandido && (
                  <div className="space-y-4 border-t border-aura-mist bg-aura-sunken/40 px-5 py-4 text-sm">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <p className="text-aura-graphite-soft">
                        Contatos novos: <strong className="font-semibold tabular-nums text-aura-graphite">{v.contatosNovos}</strong>
                      </p>
                      <p className="text-aura-graphite-soft">
                        Leads respondidos: <strong className="font-semibold tabular-nums text-aura-graphite">{v.leadsRespondidos}</strong>
                      </p>
                      <p className="text-aura-graphite-soft">
                        Negócios novos: <strong className="font-semibold tabular-nums text-aura-graphite">{v.oportunidadesNovas}</strong>
                      </p>
                      <p className="text-aura-graphite-soft">
                        Vendas: <strong className="font-semibold tabular-nums text-aura-graphite">{v.vendas}</strong>
                        {v.faturamento > 0 && ` · ${moeda(v.faturamento)}`}
                      </p>
                    </div>

                    {Object.keys(v.porTipo).length > 0 && (
                      <div>
                        <p className="aura-rotulo mb-1.5">Atividades por tipo</p>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(v.porTipo)
                            .sort((a, b) => b[1] - a[1])
                            .map(([tipo, n]) => (
                              <Selo key={tipo} tom="neutro">
                                {tipo} · {n}
                              </Selo>
                            ))}
                        </div>
                      </div>
                    )}

                    {v.leadsRecebidos > 0 && v.leadsRespondidos === 0 && (
                      <p className="flex items-start gap-2 rounded-lg border border-aura-mist bg-aura-surface px-3 py-2 text-aura-graphite">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-aura-warning" />
                        Recebeu {v.leadsRecebidos} lead{v.leadsRecebidos > 1 ? "s" : ""} e não
                        respondeu nenhum neste dia.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {dados && !carregando && dados.vendedores.length === 0 && (
        <EstadoVazio icone={Activity} titulo="Nenhum vendedor ativo nesta loja." />
      )}
    </div>
  );
}
