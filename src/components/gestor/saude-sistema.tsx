"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Database, RefreshCw, ShieldCheck } from "lucide-react";
import { Alerta, Card, CardHeader, Selo, classeBotao, type Tom } from "@/components/ui";

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

const COR: Record<Nivel, { tom: Tom; texto: string }> = {
  ok: { tom: "sucesso", texto: "Tudo certo" },
  atencao: { tom: "atencao", texto: "Atenção" },
  critico: { tom: "perigo", texto: "Crítico" },
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-aura-graphite-soft">
            Três sentinelas conferem o AURA todo dia às 7h30 e às 13h30 e avisam no sino o que for novo.
          </p>
        </div>
        <button
          type="button"
          onClick={rodarAgora}
          disabled={rodando}
          className={classeBotao("primario")}
        >
          <RefreshCw size={15} className={rodando ? "animate-spin" : ""} aria-hidden />
          {rodando ? "Conferindo…" : "Conferir agora"}
        </button>
      </div>

      {erro && <Alerta tom="perigo" titulo={erro} />}

      {rodadas === null ? (
        <p className="text-sm text-aura-graphite-soft">Carregando…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {SENTINELAS.map((s) => {
            const rodada = rodadas.find((r) => r.sentinela === s.id);
            const Icone = s.icon;
            const nivel: Nivel = rodada?.nivel ?? "ok";
            return (
              <Card key={s.id}>
                <CardHeader
                  icone={Icone}
                  titulo={s.nome}
                  descricao={s.descricao}
                  className="mb-0!"
                  acoes={rodada && <Selo tom={COR[nivel].tom}>{COR[nivel].texto}</Selo>}
                />

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
                          className={`rounded-lg border border-l-[3px] border-aura-mist bg-aura-sunken/50 px-3 py-2 text-sm ${
                            a.nivel === "critico" ? "border-l-aura-danger" : "border-l-aura-warning"
                          }`}
                        >
                          <p className="font-medium text-aura-graphite">{a.titulo}</p>
                          <p className="mt-0.5 text-aura-graphite-soft">{a.detalhe}</p>
                          {a.acao && <p className="mt-1 text-xs text-aura-graphite-soft">O que fazer: {a.acao}</p>}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-aura-graphite-soft">
                      Última conferência: {new Date(rodada.criadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </p>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
