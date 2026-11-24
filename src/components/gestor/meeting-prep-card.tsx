"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import type { MembroEquipe } from "@/lib/supabase/team";
import { Card, CardHeader, classeBotao } from "@/components/ui";

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
    <Card>
      <CardHeader
        titulo="Preparar reunião de segunda-feira"
        descricao="A AURA monta a pauta com base no desempenho real da equipe: Reconhecer → Aprender → Desenvolver → Comprometer."
        icone={Sparkles}
        corIcone="text-aura-gold"
      />

      {equipe.length === 0 ? (
        <p className="text-xs text-aura-graphite-soft">
          Cadastre pelo menos um vendedor nesta loja para preparar a reunião.
        </p>
      ) : (
        <>
          {!pauta && !carregando && (
            <button
              type="button"
              onClick={prepararReuniao}
              className={classeBotao("primario")}
            >
              <Sparkles size={15} aria-hidden />
              Preparar reunião com IA
            </button>
          )}

          {carregando && (
            <div className="flex items-center gap-2 text-sm text-aura-graphite-soft">
              <Loader2 size={15} className="animate-spin" />
              Montando a pauta...
            </div>
          )}

          {pauta && (
            <div className="rounded-lg border border-aura-mist bg-aura-sunken p-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-aura-graphite">{pauta}</p>
              <button
                type="button"
                onClick={prepararReuniao}
                className="mt-3 text-xs font-medium text-aura-petrol-600 hover:underline"
              >
                Gerar novamente
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
