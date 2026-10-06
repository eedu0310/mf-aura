"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, UserX, UserCheck, Loader2, Target, Sparkles } from "lucide-react";
import type { MembroEquipe } from "@/lib/supabase/team";
import { MetasVendedorModal } from "./metas-vendedor-modal";
import { useAppData } from "@/lib/app-data-context";
import { computeDnaScore } from "@/lib/compute-dna-score";

const ICONE_TENDENCIA = {
  subiu: <TrendingUp size={14} className="text-aura-success" />,
  caiu: <TrendingDown size={14} className="text-aura-danger" />,
  estavel: <Minus size={14} className="text-aura-graphite-soft" />,
};

function tendenciaDe(m: MembroEquipe) {
  if (m.vendasEsteMes > m.vendasMesPassado) return "subiu" as const;
  if (m.vendasEsteMes < m.vendasMesPassado) return "caiu" as const;
  return "estavel" as const;
}

function iniciais(nome: string) {
  const partes = nome.split(" ");
  return (partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "");
}

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

export function TeamRoster({ equipe }: { equipe: MembroEquipe[] }) {
  const { relacionamentos, oportunidades, atividades, funil } = useAppData();
  const [processando, setProcessando] = useState<string | null>(null);
  const [statusLocal, setStatusLocal] = useState<Record<string, boolean>>({});
  const [membroMetas, setMembroMetas] = useState<MembroEquipe | null>(null);

  const ordenado = [...equipe].sort((a, b) => b.vendasTotal - a.vendasTotal);

  function auraScoreDe(m: MembroEquipe): number | null {
    if (m.id === "local") return null;
    const relDoMembro = relacionamentos.filter((r) => r.ownerId === m.id);
    const opsDoMembro = oportunidades.filter((o) => o.ownerId === m.id);
    const ativDoMembro = atividades.filter((a) => a.ownerId === m.id);
    if (relDoMembro.length === 0 && opsDoMembro.length === 0 && ativDoMembro.length === 0) return null;
    return computeDnaScore({
      relacionamentos: relDoMembro,
      oportunidades: opsDoMembro,
      atividades: ativDoMembro,
      funil,
    }).score;
  }

  function estaAtivo(m: MembroEquipe) {
    return statusLocal[m.id] ?? m.ativo;
  }

  async function alternarStatus(m: MembroEquipe) {
    const novoStatus = !estaAtivo(m);
    const acao = novoStatus ? "reativar" : "desativar";
    const confirmMsg = novoStatus
      ? `Reativar ${m.nome}? Ele volta a conseguir logar e entrar na distribuição de leads.`
      : `Desativar ${m.nome}? Ele não vai mais conseguir logar, e para de entrar na distribuição de leads. O histórico de vendas e atividades dele continua intacto.`;

    if (!confirm(confirmMsg)) return;

    setProcessando(m.id);
    try {
      const resp = await fetch("/api/admin/definir-status-usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: m.id, ativo: novoStatus }),
      });
      const dados = await resp.json();
      if (!resp.ok) {
        alert(dados.erro ?? `Não consegui ${acao} esse vendedor.`);
      } else {
        setStatusLocal((prev) => ({ ...prev, [m.id]: novoStatus }));
      }
    } catch {
      alert(`Não consegui ${acao} esse vendedor. Tente novamente.`);
    } finally {
      setProcessando(null);
    }
  }

  return (
    <div className="rounded-2xl border border-aura-mist bg-white">
      <div className="border-b border-aura-mist px-5 py-3.5">
        <p className="text-sm font-medium text-aura-graphite">Equipe</p>
      </div>
      {ordenado.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-aura-graphite-soft">
          Nenhum vendedor cadastrado nesta loja ainda.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-aura-mist">
          {ordenado.map((m) => {
            const tendencia = tendenciaDe(m);
            const ativo = estaAtivo(m);
            const precisaAtencao = ativo && (m.atividades7dias === 0 || tendencia === "caiu");
            return (
              <li
                key={m.id}
                className={`flex items-center gap-3 px-5 py-3.5 ${!ativo ? "opacity-50" : ""}`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aura-petrol-700/10 font-display text-xs font-semibold text-aura-petrol-700">
                  {iniciais(m.nome)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-aura-graphite">
                    {m.nome}
                    {!ativo && (
                      <span className="rounded-full bg-aura-graphite-soft/15 px-1.5 py-0.5 text-[0.6rem] font-medium text-aura-graphite-soft">
                        Inativo
                      </span>
                    )}
                    {precisaAtencao && (
                      <AlertTriangle size={12} className="shrink-0 text-aura-warning" />
                    )}
                  </p>
                  <p className="text-xs text-aura-graphite-soft">
                    {m.atividades7dias} atividade{m.atividades7dias !== 1 ? "s" : ""} em 7 dias
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {(() => {
                    const score = auraScoreDe(m);
                    if (score === null) return null;
                    return (
                      <span
                        className="flex items-center gap-1 rounded-full bg-aura-gold/10 px-2 py-0.5 text-xs font-semibold text-aura-gold"
                        title="AURA Score"
                      >
                        <Sparkles size={11} />
                        {score}
                      </span>
                    );
                  })()}
                  <div className="flex items-center gap-1.5">
                    {ICONE_TENDENCIA[tendencia]}
                    <span className="font-data text-sm font-medium text-aura-graphite">
                      {formatarMoeda(m.vendasTotal)}
                    </span>
                  </div>
                </div>
                {m.id !== "local" && (
                  <button
                    type="button"
                    onClick={() => setMembroMetas(m)}
                    aria-label="Definir metas"
                    title="Definir metas"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-aura-graphite-soft hover:bg-aura-petrol-700/10 hover:text-aura-petrol-700"
                  >
                    <Target size={13} />
                  </button>
                )}
                {!m.souEu && m.id !== "local" && (
                  <button
                    type="button"
                    onClick={() => alternarStatus(m)}
                    disabled={processando === m.id}
                    aria-label={ativo ? "Desativar vendedor" : "Reativar vendedor"}
                    title={ativo ? "Desativar vendedor" : "Reativar vendedor"}
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      ativo
                        ? "text-aura-graphite-soft hover:bg-aura-danger/10 hover:text-aura-danger"
                        : "text-aura-success hover:bg-aura-success/10"
                    }`}
                  >
                    {processando === m.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : ativo ? (
                      <UserX size={13} />
                    ) : (
                      <UserCheck size={13} />
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {membroMetas && (
        <MetasVendedorModal membro={membroMetas} onClose={() => setMembroMetas(null)} />
      )}
    </div>
  );
}
