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
import type { LucideIcon } from "lucide-react";
import { Alerta, classeBotao } from "@/components/ui";

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
  kpis: { label: string; valor: string; tom?: Tom; href?: string }[];
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

/*
 * Recado = alerta claro do design system, com o ícone colorido no
 * quadradinho. Antes cada tipo pintava a caixa inteira (vermelho, verde,
 * âmbar, azul) e quatro recados juntos viravam um mosaico.
 */
const ESTILO_TIPO: Record<
  Insight["tipo"],
  { icone: LucideIcon; tom: "perigo" | "atencao" | "sucesso" | "info"; rotulo: string }
> = {
  alerta: { icone: AlertTriangle, tom: "perigo", rotulo: "Atenção" },
  oportunidade: { icone: TrendingUp, tom: "sucesso", rotulo: "Oportunidade" },
  dica: { icone: Lightbulb, tom: "atencao", rotulo: "Dica" },
  conquista: { icone: Trophy, tom: "info", rotulo: "Conquista" },
};

const COR_TOM: Record<Tom, string> = {
  bom: "text-aura-success",
  atencao: "text-aura-gold-700",
  ruim: "text-aura-danger",
  neutro: "text-aura-graphite",
};

const PONTO_TOM: Record<Tom, string> = {
  bom: "bg-aura-success",
  atencao: "bg-aura-warning",
  ruim: "bg-aura-danger",
  neutro: "bg-aura-graphite-soft/40",
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
    <section className={`aura-card overflow-hidden ${className}`} aria-label="Supervisora AURA">
      {/* Cabeçalho claro com a manchete */}
      <div className={`flex items-start gap-3 px-4 py-3.5 sm:px-5 ${recolhido ? "" : "border-b border-aura-mist"}`}>
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-gold/15 ring-1 ring-inset ring-aura-gold/25">
          <Sparkles size={16} className="text-aura-gold-700" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="aura-rotulo">Supervisora AURA</p>
          {carregando && !dados ? (
            <div className="mt-1.5 h-4 w-2/3 animate-pulse rounded bg-aura-sunken" />
          ) : (
            <>
              {/* Quebra em até 2 linhas: no celular o "truncate" escondia a manchete. */}
              <p className="mt-0.5 line-clamp-2 break-words text-[0.9375rem] font-semibold text-aura-graphite">{dados?.manchete ?? "AURA indisponível"}</p>
              {!recolhido && dados?.foco && (
                <p className="mt-1 flex items-start gap-1.5 text-sm text-aura-graphite-soft">
                  <Target size={14} className="mt-0.5 shrink-0 text-aura-gold-700" />
                  {dados.foco}
                </p>
              )}
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => carregar(true)}
            disabled={carregando}
            className="rounded-lg p-1.5 text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-graphite disabled:opacity-50"
            title="Atualizar análise"
          >
            <RefreshCw size={15} className={carregando ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={alternar}
            className="rounded-lg p-1.5 text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-graphite"
            title={recolhido ? "Mostrar" : "Recolher"}
          >
            {recolhido ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
        </div>
      </div>

      {!recolhido && (
        // @container: as colunas seguem a largura do cartão, não da tela. No
        // Meu Dia ele fica numa coluna estreita ao lado da barra lateral.
        <div className="@container space-y-3 bg-aura-bg/40 p-4 sm:p-5">
          {erro && <Alerta tom="perigo" titulo={erro} className="shadow-none" />}

          {/* Números-chave (exatos, vindos do banco) */}
          {dados?.kpis?.length ? (
            <div className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
              {dados.kpis.map((k) => {
                const miolo = (
                  <>
                    <p className="flex items-start gap-1.5">
                      <span className={`mt-[0.3rem] h-1.5 w-1.5 shrink-0 rounded-full ${PONTO_TOM[k.tom ?? "neutro"]}`} aria-hidden />
                      <span className="aura-rotulo min-w-0 break-words">{k.label}</span>
                    </p>
                    <p className={`mt-1.5 font-display text-xl font-semibold tabular-nums ${COR_TOM[k.tom ?? "neutro"]}`}>{k.valor}</p>
                  </>
                );
                // Cartão com destino vira link: a vendedora tocava em
                // "Follow-ups vencidos" e nada abria.
                return k.href ? (
                  <Link
                    key={k.label}
                    href={k.href}
                    className="aura-card aura-card-interativo px-3.5 py-3"
                    title={`Ver ${k.label.toLowerCase()}`}
                  >
                    {miolo}
                  </Link>
                ) : (
                  <div key={k.label} className="aura-card px-3.5 py-3">
                    {miolo}
                  </div>
                );
              })}
            </div>
          ) : carregando ? (
            <div className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[66px] animate-pulse rounded-xl bg-aura-sunken" />
              ))}
            </div>
          ) : null}

          {/* Recados */}
          {dados?.insights?.length ? (
            <ul className="grid gap-2 @2xl:grid-cols-2">
              {dados.insights.map((i, idx) => {
                const est = ESTILO_TIPO[i.tipo] ?? ESTILO_TIPO.dica;
                const botao = i.acao && (
                  <Link href={i.acao.href} className={classeBotao("secundario", "sm")}>
                    {i.acao.label}
                  </Link>
                );
                // Recado estreito (celular, coluna do Meu Dia): o botão desce
                // para baixo do texto, senão o texto ficava espremido ao lado.
                return (
                  <li key={idx} title={est.rotulo} className="@container flex">
                    <Alerta
                      tom={est.tom}
                      icone={est.icone}
                      titulo={i.titulo}
                      descricao={
                        botao ? (
                          <>
                            {i.detalhe}
                            <span className="mt-2 block @md:hidden">{botao}</span>
                          </>
                        ) : (
                          i.detalhe
                        )
                      }
                      className="w-full"
                      acao={botao && <span className="hidden @md:block">{botao}</span>}
                    />
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
