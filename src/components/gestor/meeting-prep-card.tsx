"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import type { MembroEquipe } from "@/lib/supabase/team";

export function MeetingPrepCard({ equipe }: { equipe: MembroEquipe[] }) {
  const { playbook } = useAppData();
  const [carregando, setCarregando] = useState(false);
  const [pauta, setPauta] = useState<string | null>(null);

  async function prepararReuniao() {
    setCarregando(true);
    setPauta(null);
    try {
      const resp = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modo: "preparar_reuniao",
          playbook,
          equipe: equipe.map((m) => ({
            nome: m.nome,
            vendas: m.vendasTotal,
            atividades7dias: m.atividades7dias,
            tendencia: m.vendasEsteMes > m.vendasMesPassado ? "subiu" : m.vendasEsteMes < m.vendasMesPassado ? "caiu" : "estavel",
          })),
        }),
      });
      const dados = await resp.json();
      if (!resp.ok || !dados.resposta) throw new Error(dados.erro ?? "Não foi possível preparar a pauta.");
      setPauta(dados.resposta);
    } catch {
      setPauta("Não consegui preparar a pauta agora. Tente novamente em instantes.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="rounded-2xl bg-aura-navy-950 p-6">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-aura-gold" />
        <p className="font-display text-sm font-semibold text-white">
          Preparar reunião de segunda-feira
        </p>
      </div>
      <p className="mt-1.5 text-xs text-white/60">
        A AURA monta a pauta com base no desempenho real da equipe: Reconhecer → Aprender →
        Desenvolver → Comprometer.
      </p>

      {equipe.length === 0 ? (
        <p className="mt-4 text-xs text-white/50">
          Cadastre pelo menos um vendedor nesta loja para preparar a reunião.
        </p>
      ) : (
        <>
          {!pauta && !carregando && (
            <button
              type="button"
              onClick={prepararReuniao}
              className="mt-4 rounded-xl bg-aura-gold px-4 py-2.5 text-sm font-medium text-aura-navy-950 transition hover:bg-aura-gold-soft"
            >
              Preparar reunião com IA
            </button>
          )}

          {carregando && (
            <div className="mt-4 flex items-center gap-2 text-sm text-white/70">
              <Loader2 size={15} className="animate-spin" />
              Montando a pauta...
            </div>
          )}

          {pauta && (
            <div className="mt-4 rounded-xl bg-white/5 p-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/90">{pauta}</p>
              <button
                type="button"
                onClick={prepararReuniao}
                className="mt-3 text-xs font-medium text-aura-gold hover:underline"
              >
                Gerar novamente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
