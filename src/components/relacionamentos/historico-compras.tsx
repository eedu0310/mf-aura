"use client";

import { useEffect, useState } from "react";
import { Repeat, ShoppingBag } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Historico {
  compras: number;
  total_comprado: number;
  primeira_compra: string | null;
  ultima_compra: string | null;
  recorrente: boolean;
  dias_desde_ultima_compra: number | null;
}

interface Compra {
  id: string;
  cliente: string;
  produto: string | null;
  valor: number;
  valor_fechado: number | null;
  data: string;
}

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

/**
 * O que este cliente já comprou.
 *
 * Sem isto o vendedor abria a ficha de alguém que comprou no ano passado e
 * não via nada — tratava como contato novo, e a chance de vender de novo
 * para quem já confiou na loja passava batido.
 */
export function HistoricoCompras({ relacionamentoId }: { relacionamentoId: string }) {
  const [resumo, setResumo] = useState<Historico | null>(null);
  const [compras, setCompras] = useState<Compra[]>([]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;

      const [{ data: h }, { data: v }] = await Promise.all([
        supabase
          .from("cliente_historico")
          .select("compras, total_comprado, primeira_compra, ultima_compra, recorrente, dias_desde_ultima_compra")
          .eq("relacionamento_id", relacionamentoId)
          .maybeSingle(),
        supabase
          .from("vendas")
          .select("id, cliente, produto, valor, valor_fechado, data")
          .eq("relacionamento_id", relacionamentoId)
          .order("data", { ascending: false })
          .limit(20),
      ]);

      if (!vivo) return;
      setResumo(h as Historico | null);
      setCompras((v ?? []) as Compra[]);
    })();
    return () => {
      vivo = false;
    };
  }, [relacionamentoId]);

  if (!resumo || resumo.compras === 0) return null;

  return (
    <section className="rounded-xl border border-aura-mist bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-aura-graphite">
          <ShoppingBag size={15} className="text-aura-petrol-600" />
          Já comprou {resumo.compras}{resumo.compras === 1 ? " vez" : " vezes"}
        </h4>
        {resumo.recorrente && (
          <span className="inline-flex items-center gap-1 rounded-full bg-aura-gold/15 px-2 py-0.5 text-xs font-semibold text-aura-graphite">
            <Repeat size={11} /> Cliente recorrente
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-aura-graphite-soft">
        {moeda(Number(resumo.total_comprado))} no total
        {resumo.dias_desde_ultima_compra != null && (
          <> · última compra há {resumo.dias_desde_ultima_compra} dia
            {resumo.dias_desde_ultima_compra === 1 ? "" : "s"}</>
        )}
      </p>

      {resumo.dias_desde_ultima_compra != null && resumo.dias_desde_ultima_compra > 180 && (
        <p className="mt-2 rounded-lg bg-aura-gold/10 px-3 py-2 text-xs text-aura-graphite">
          Faz mais de seis meses desde a última compra. Cliente que já confiou na loja volta
          mais fácil do que um contato novo.
        </p>
      )}

      <ul className="mt-3 divide-y divide-aura-mist border-t border-aura-mist">
        {compras.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-sm text-aura-graphite">
                {c.produto || "Venda"}
              </span>
              <span className="text-xs text-aura-graphite-soft">{dia(c.data)}</span>
            </span>
            <span className="shrink-0 text-sm font-medium tabular-nums text-aura-graphite">
              {moeda(Number(c.valor_fechado ?? c.valor ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
