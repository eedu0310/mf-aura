"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wrench, AlertTriangle, Star, ArrowRight } from "lucide-react";
import { listarPosVendas, type PosVenda } from "@/lib/supabase/pos-venda";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

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

  const hojeISO = new Date().toISOString().slice(0, 10);
  const atrasadas = itens.filter(
    (i) => i.status === "agendamento_realizado" && i.dataAgendamento && i.dataAgendamento < hojeISO
  ).length;
  const reclamacoesAbertas = itens.filter((i) => i.reclamacao?.trim() && !i.reclamacaoResolvida).length;
  const avaliaram = itens.filter((i) => i.avaliouLoja).length;
  const notaMedia =
    avaliaram > 0
      ? itens.filter((i) => i.notaAvaliacao).reduce((s, i) => s + (i.notaAvaliacao ?? 0), 0) / avaliaram
      : 0;

  const lojas = [...new Set(itens.map((i) => i.empresa))];
  const multiLoja = lojas.length > 1;

  return (
    <Link
      href="/pos-venda"
      className="block rounded-2xl border border-aura-mist bg-white p-5 transition hover:border-aura-petrol-500/40"
    >
      <div className="flex items-center gap-2">
        <Wrench size={16} className="text-aura-petrol-600" />
        <p className="text-sm font-medium text-aura-graphite">
          Pós-venda {multiLoja ? "— todas as lojas" : ""}
        </p>
        <ArrowRight size={13} className="ml-auto text-aura-graphite-soft" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <p className="flex items-center gap-1 text-xs text-aura-graphite-soft">
            <AlertTriangle size={11} className="text-aura-danger" />
            Atrasadas
          </p>
          <p className="mt-0.5 font-display text-lg font-bold text-aura-graphite">{atrasadas}</p>
        </div>
        <div>
          <p className="text-xs text-aura-graphite-soft">Reclamações</p>
          <p className="mt-0.5 font-display text-lg font-bold text-aura-graphite">{reclamacoesAbertas}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-xs text-aura-graphite-soft">
            <Star size={11} className="text-aura-gold" />
            Nota média
          </p>
          <p className="mt-0.5 font-display text-lg font-bold text-aura-graphite">
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
