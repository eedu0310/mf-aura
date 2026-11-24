"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, UserX, UserCheck, Loader2, Target, Sparkles, Users } from "lucide-react";
import { Selo } from "@/components/ui";
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
    <div className="aura-card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-aura-mist px-5 py-3.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-sunken">
          <Users size={16} className="text-aura-petrol-600" />
        </span>
        <p className="text-sm font-semibold text-aura-graphite">Equipe</p>
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
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aura-petrol-500/10 font-display text-xs font-semibold text-aura-petrol-600">
                  {iniciais(m.nome)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-aura-graphite">
                    {m.nome}
                    {!ativo && (
                      <Selo tom="neutro">Inativo</Selo>
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
                      <span className="aura-selo aura-selo-ouro gap-1 tabular-nums" title="AURA Score">
                        <Sparkles size={11} />
                        {score}
                      </span>
                    );
                  })()}
                  <div className="flex items-center gap-1.5">
                    {ICONE_TENDENCIA[tendencia]}
                    <span className="text-sm font-medium tabular-nums text-aura-graphite">
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
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-petrol-600"
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
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${
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
