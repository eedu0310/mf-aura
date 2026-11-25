"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wrench, AlertTriangle, Star, ArrowRight } from "lucide-react";
import { listarPosVendas, type PosVenda } from "@/lib/supabase/pos-venda";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { diaEmSaoPaulo } from "@/lib/fuso";

export function PosVendaResumoCard() {
  const [itens, setItens] = useState<PosVenda[]>([]);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    const lista = await listarPosVendas();
    if (lista) setItens(lista);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const canal = supabase
      .channel("aura-gestor-pos-venda-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "pos_vendas" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  if (carregando || itens.length === 0) return null;

  // Dia de Brasília: em UTC, depois das 21h o "hoje" já virava amanhã e o
  // agendamento do dia contava como atrasado.
  const hojeISO = diaEmSaoPaulo();
  const atrasadas = itens.filter(
    (i) => i.status === "agendamento_realizado" && i.dataAgendamento && i.dataAgendamento < hojeISO
  ).length;
  const reclamacoesAbertas = itens.filter((i) => i.reclamacao?.trim() && !i.reclamacaoResolvida).length;
  // Média só entre quem deu nota: avaliar a loja sem marcar nota não pode
  // puxar a média para baixo.
  const comNota = itens.filter((i) => i.notaAvaliacao);
  const notaMedia =
    comNota.length > 0 ? comNota.reduce((s, i) => s + (i.notaAvaliacao ?? 0), 0) / comNota.length : 0;

  const lojas = [...new Set(itens.map((i) => i.empresa))];
  const multiLoja = lojas.length > 1;

  return (
    <Link
      href="/pos-venda"
      className="aura-card aura-card-interativo block p-5"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-sunken">
          <Wrench size={16} className="text-aura-petrol-600" />
        </span>
        <p className="text-sm font-semibold text-aura-graphite">
          Pós-venda {multiLoja ? "— todas as lojas" : ""}
        </p>
        <ArrowRight size={13} className="ml-auto text-aura-graphite-soft" />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="aura-rotulo flex items-center gap-1">
            <AlertTriangle size={11} className="text-aura-danger" />
            Atrasadas
          </p>
          <p className="mt-1 font-display text-xl font-semibold tabular-nums text-aura-graphite">{atrasadas}</p>
        </div>
        <div>
          <p className="aura-rotulo">Reclamações</p>
          <p className="mt-1 font-display text-xl font-semibold tabular-nums text-aura-graphite">{reclamacoesAbertas}</p>
        </div>
        <div>
          <p className="aura-rotulo flex items-center gap-1">
            <Star size={11} className="text-aura-gold" />
            Nota média
          </p>
          <p className="mt-1 font-display text-xl font-semibold tabular-nums text-aura-graphite">
            {notaMedia > 0 ? notaMedia.toFixed(1) : "—"}
          </p>
        </div>
      </div>

      {multiLoja && (
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-aura-mist pt-3 sm:grid-cols-4">
          {lojas.map((loja) => {
            const itensLoja = itens.filter((i) => i.empresa === loja);
            const reclamacoesLoja = itensLoja.filter((i) => i.reclamacao?.trim() && !i.reclamacaoResolvida).length;
            return (
              <div key={loja}>
                <p className="truncate text-[0.65rem] text-aura-graphite-soft">{loja}</p>
                <p className="text-xs font-medium text-aura-graphite">
                  {itensLoja.length} vendas
                  {reclamacoesLoja > 0 ? ` · ${reclamacoesLoja} reclam.` : ""}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </Link>
  );
}
