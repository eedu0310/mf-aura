"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Database, RefreshCw, ShieldCheck } from "lucide-react";

type Nivel = "ok" | "atencao" | "critico";

interface Achado {
  nivel: Exclude<Nivel, "ok">;
  titulo: string;
  detalhe: string;
  acao?: string;
}

interface Rodada {
  sentinela: "operacao" | "dados" | "seguranca";
  criadoEm: string;
  nivel: Nivel;
  resumo: string | null;
  achados: Achado[];
}

const SENTINELAS = [
  { id: "operacao", nome: "Operação", descricao: "Crons, backup, IA e saldo", icon: Activity },
  { id: "dados", nome: "Dados", descricao: "Leads, pipeline e cadastros", icon: Database },
  { id: "seguranca", nome: "Segurança", descricao: "Acessos, RLS e contas novas", icon: ShieldCheck },
] as const;

const COR: Record<Nivel, { selo: string; texto: string }> = {
  ok: { selo: "bg-emerald-100 text-emerald-800", texto: "Tudo certo" },
  atencao: { selo: "bg-amber-100 text-amber-800", texto: "Atenção" },
  critico: { selo: "bg-red-100 text-red-800", texto: "Crítico" },
};

/**
 * Saúde do sistema: o que as Sentinelas acharam na última rodada.
 * Elas rodam sozinhas (7h30 e 13h30); o botão roda na hora.
 */
export function SaudeSistema() {
  const [rodadas, setRodadas] = useState<Rodada[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rodando, setRodando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    const r = await fetch("/api/gestor/saude", { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErro(d?.erro ?? "Não consegui carregar a saúde do sistema.");
      setRodadas([]);
      return;
    }
    setRodadas(d.rodadas ?? []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function rodarAgora() {
    setRodando(true);
    try {
      const r = await fetch("/api/gestor/saude", { method: "POST" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErro(d?.erro ?? "As sentinelas não conseguiram rodar.");
      }
      await carregar();
    } finally {
      setRodando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-aura-graphite">Saúde do sistema</h2>
          <p className="text-sm text-aura-graphite-soft">
            Três sentinelas conferem o AURA todo dia às 7h30 e às 13h30 e avisam no sino o que for novo.
          </p>
        </div>
        <button
          type="button"
          onClick={rodarAgora}
          disabled={rodando}
          className="flex items-center gap-2 rounded-full bg-aura-navy-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          <RefreshCw size={15} className={rodando ? "animate-spin" : ""} aria-hidden />
          {rodando ? "Conferindo…" : "Conferir agora"}
        </button>
      </div>

      {erro && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      {rodadas === null ? (
        <p className="text-sm text-aura-graphite-soft">Carregando…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {SENTINELAS.map((s) => {
            const rodada = rodadas.find((r) => r.sentinela === s.id);
            const Icone = s.icon;
            const nivel: Nivel = rodada?.nivel ?? "ok";
            return (
              <section key={s.id} className="rounded-2xl border border-aura-mist bg-white p-5 shadow-sm">
                <header className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icone size={18} className="text-aura-graphite" aria-hidden />
                    <div>
                      <h3 className="text-sm font-semibold text-aura-graphite">{s.nome}</h3>
                      <p className="text-xs text-aura-graphite-soft">{s.descricao}</p>
                    </div>
                  </div>
                  {rodada && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${COR[nivel].selo}`}>
                      {COR[nivel].texto}
                    </span>
                  )}
                </header>

                {!rodada ? (
                  <p className="mt-4 text-sm text-aura-graphite-soft">
                    Ainda não rodou. Clique em “Conferir agora”.
                  </p>
                ) : (
                  <>
                    {rodada.resumo && <p className="mt-3 text-sm text-aura-graphite">{rodada.resumo}</p>}
                    <ul className="mt-3 flex flex-col gap-3">
                      {rodada.achados.map((a) => (
                        <li
                          key={a.titulo}
                          className={`rounded-xl border-l-4 px-3 py-2 text-sm ${
                            a.nivel === "critico" ? "border-red-500 bg-red-50" : "border-amber-400 bg-amber-50"
                          }`}
                        >
                          <p className="font-semibold text-aura-graphite">{a.titulo}</p>
                          <p className="mt-0.5 text-aura-graphite">{a.detalhe}</p>
                          {a.acao && <p className="mt-1 text-xs text-aura-graphite-soft">O que fazer: {a.acao}</p>}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-aura-graphite-soft">
                      Última conferência: {new Date(rodada.criadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </p>
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
