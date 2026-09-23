"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";

type Tom = "bom" | "atencao" | "ruim" | "neutro";

interface Insight {
  tipo: "alerta" | "oportunidade" | "dica" | "conquista";
  titulo: string;
  detalhe?: string;
  acao?: { label: string; href: string };
}

interface RespostaAura {
  manchete: string;
  foco: string;
  insights: Insight[];
  kpis: { label: string; valor: string; tom?: Tom }[];
  fonte: "ia" | "regras";
  geradoEm: string;
  iaDisponivel: boolean;
}

export type PaginaAura =
  | "meu-dia"
  | "agenda"
  | "relacionamentos"
  | "pipeline"
  | "vendas"
  | "atividades"
  | "relatorio"
  | "ranking"
  | "whatsapp"
  | "gestor";

const ESTILO_TIPO: Record<Insight["tipo"], { icone: React.ReactNode; borda: string; fundo: string; rotulo: string }> = {
  alerta: { icone: <AlertTriangle className="h-4 w-4 text-red-600" />, borda: "border-red-200", fundo: "bg-red-50", rotulo: "Atenção" },
  oportunidade: { icone: <TrendingUp className="h-4 w-4 text-emerald-700" />, borda: "border-emerald-200", fundo: "bg-emerald-50", rotulo: "Oportunidade" },
  dica: { icone: <Lightbulb className="h-4 w-4 text-amber-600" />, borda: "border-amber-200", fundo: "bg-amber-50", rotulo: "Dica" },
  conquista: { icone: <Trophy className="h-4 w-4 text-sky-700" />, borda: "border-sky-200", fundo: "bg-sky-50", rotulo: "Conquista" },
};

const COR_TOM: Record<Tom, string> = {
  bom: "text-emerald-700",
  atencao: "text-amber-700",
  ruim: "text-red-600",
  neutro: "text-aura-graphite",
};

const PONTO_TOM: Record<Tom, string> = {
  bom: "bg-emerald-500",
  atencao: "bg-amber-500",
  ruim: "bg-red-500",
  neutro: "bg-slate-300",
};

function lerRecolhido(pagina: string) {
  try {
    return window.localStorage.getItem(`aura-card-${pagina}`) === "1";
  } catch {
    return false;
  }
}

function salvarRecolhido(pagina: string, v: boolean) {
  try {
    window.localStorage.setItem(`aura-card-${pagina}`, v ? "1" : "0");
  } catch {
    /* sem armazenamento: tudo bem */
  }
}

/**
 * Cartão da Supervisora AURA. Coloque no topo de qualquer tela:
 *   <AuraInsightCard pagina="pipeline" />
 * Mostra números-chave exatos + recados curtos gerados pelo Claude.
 */
export function AuraInsightCard({
  pagina,
  vendedorId,
  loja,
  className = "",
}: {
  pagina: PaginaAura;
  vendedorId?: string;
  loja?: string;
  className?: string;
}) {
  const [dados, setDados] = useState<RespostaAura | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [recolhido, setRecolhido] = useState(false);

  useEffect(() => setRecolhido(lerRecolhido(pagina)), [pagina]);

  const carregar = useCallback(
    async (forcar = false) => {
      setCarregando(true);
      setErro(null);
      try {
        const qs = new URLSearchParams({ pagina });
        if (vendedorId) qs.set("vendedor", vendedorId);
        if (loja) qs.set("loja", loja);
        if (forcar) qs.set("refresh", "1");
        const res = await fetch(`/api/aura/insights?${qs}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Erro ao falar com a AURA");
        setDados(json);
      } catch (e: any) {
        setErro(e?.message ?? "A AURA não respondeu.");
      } finally {
        setCarregando(false);
      }
    },
    [pagina, vendedorId, loja],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  const alternar = () => {
    setRecolhido((v) => {
      salvarRecolhido(pagina, !v);
      return !v;
    });
  };

  return (
    <section className={`overflow-hidden rounded-2xl border border-aura-mist bg-white shadow-sm ${className}`} aria-label="Supervisora AURA">
      {/* Cabeçalho escuro com a manchete */}
      <div className="flex items-start gap-3 bg-aura-navy-950 px-4 py-3 sm:px-5">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aura-gold/15 ring-1 ring-aura-gold/40">
          <Sparkles className="h-5 w-5 text-aura-gold" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-aura-gold/80">Supervisora AURA</p>
          {carregando && !dados ? (
            <div className="mt-1 h-5 w-2/3 animate-pulse rounded bg-white/10" />
          ) : (
            <>
              <p className="truncate text-base font-semibold text-white sm:text-lg">{dados?.manchete ?? "AURA indisponível"}</p>
              {!recolhido && dados?.foco && (
                <p className="mt-0.5 flex items-start gap-1.5 text-sm text-white/75">
                  <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-aura-gold" />
                  {dados.foco}
                </p>
              )}
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => carregar(true)}
            disabled={carregando}
            className="rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            title="Atualizar análise"
          >
            <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={alternar}
            className="rounded-full p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
            title={recolhido ? "Mostrar" : "Recolher"}
          >
            {recolhido ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {!recolhido && (
        <div className="space-y-3 p-4 sm:p-5">
          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

          {/* Números-chave (exatos, vindos do banco) */}
          {dados?.kpis?.length ? (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {dados.kpis.map((k) => (
                <div key={k.label} className="rounded-xl border border-aura-mist bg-aura-bg/50 px-3 py-2">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-aura-graphite-soft">
                    <span className={`h-1.5 w-1.5 rounded-full ${PONTO_TOM[k.tom ?? "neutro"]}`} aria-hidden />
                    {k.label}
                  </p>
                  <p className={`mt-0.5 text-xl font-bold tabular-nums ${COR_TOM[k.tom ?? "neutro"]}`}>{k.valor}</p>
                </div>
              ))}
            </div>
          ) : carregando ? (
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[62px] animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : null}

          {/* Recados */}
          {dados?.insights?.length ? (
            <ul className="grid gap-2 md:grid-cols-2">
              {dados.insights.map((i, idx) => {
                const est = ESTILO_TIPO[i.tipo] ?? ESTILO_TIPO.dica;
                return (
                  <li key={idx} className={`flex items-start gap-3 rounded-xl border ${est.borda} ${est.fundo} px-3 py-2.5`}>
                    <span className="mt-0.5 shrink-0" title={est.rotulo}>
                      {est.icone}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-aura-graphite">{i.titulo}</p>
                      {i.detalhe && <p className="mt-0.5 text-xs text-aura-graphite-soft">{i.detalhe}</p>}
                    </div>
                    {i.acao && (
                      <Link
                        href={i.acao.href}
                        className="shrink-0 self-center rounded-full bg-aura-navy-950 px-3 py-1.5 text-xs font-semibold text-aura-gold transition hover:bg-aura-navy-900"
                      >
                        {i.acao.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {dados && (
            <p className="text-right text-[11px] text-aura-graphite-soft">
              {dados.fonte === "ia" ? "Análise da AURA (Claude)" : dados.iaDisponivel ? "Análise automática" : "IA desligada — análise automática"} ·{" "}
              {new Date(dados.geradoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
