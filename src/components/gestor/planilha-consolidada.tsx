"use client";

import { useEffect, useMemo, useState } from "react";
import { Table2, Loader2 } from "lucide-react";
import {
  METRICAS,
  SEMANAS,
  listarIndicadoresDoMes,
  listarMetasIndicadoresDoMes,
  type Metrica,
} from "@/lib/supabase/indicadores-semanais";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function formatar(valor: number, formato: "numero" | "moeda") {
  if (formato === "moeda") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(valor);
  }
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(valor);
}

export function PlanilhaConsolidada() {
  const mes = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [carregando, setCarregando] = useState(true);
  const [porMetrica, setPorMetrica] = useState<Record<Metrica, number>>({} as Record<Metrica, number>);
  const [metaTotal, setMetaTotal] = useState<Record<Metrica, number>>({} as Record<Metrica, number>);
  const [qtdVendedores, setQtdVendedores] = useState(0);

  useEffect(() => {
    async function carregar() {
      const [indicadores, metas] = await Promise.all([
        listarIndicadoresDoMes(mes),
        listarMetasIndicadoresDoMes(mes),
      ]);

      const vendedoresUnicos = new Set(indicadores.map((i) => i.vendedorId));
      setQtdVendedores(vendedoresUnicos.size);

      const somaPorMetricaSemana: Record<string, number> = {};
      for (const i of indicadores) {
        const k = `${i.metrica}:${i.semana}`;
        somaPorMetricaSemana[k] = (somaPorMetricaSemana[k] ?? 0) + i.valor;
      }

      const resultado: Record<string, number> = {};
      for (const m of METRICAS) {
        const valoresSemanas = SEMANAS.map((s) => somaPorMetricaSemana[`${m.chave}:${s}`] ?? 0);
        resultado[m.chave] =
          m.tipo === "Avg"
            ? valoresSemanas.reduce((a, b) => a + b, 0) / SEMANAS.length
            : valoresSemanas.reduce((a, b) => a + b, 0);
      }
      setPorMetrica(resultado as Record<Metrica, number>);

      const metaPorMetrica: Record<string, number> = {};
      for (const key of metas.keys()) {
        const metrica = key.split(":")[1];
        metaPorMetrica[metrica] = (metaPorMetrica[metrica] ?? 0) + (metas.get(key) ?? 0);
      }
      setMetaTotal(metaPorMetrica as Record<Metrica, number>);

      setCarregando(false);
    }
    carregar();

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const canal = supabase
      .channel("aura-planilha-consolidada-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "indicadores_semanais" }, () => carregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "metas_indicadores" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [mes]);

  if (carregando) {
    return (
      <div className="flex justify-center rounded-2xl border border-aura-mist bg-white py-12 text-aura-graphite-soft">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (qtdVendedores === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-aura-mist bg-white/60 p-6 text-center text-sm text-aura-graphite-soft">
        Nenhum vendedor preencheu a planilha de indicadores ainda este mês.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <div className="flex items-center gap-2">
        <Table2 size={16} className="text-aura-petrol-600" />
        <p className="text-sm font-medium text-aura-graphite">Indicadores Consolidados — {mes}</p>
      </div>
      <p className="mt-1 text-xs text-aura-graphite-soft">
        Soma de {qtdVendedores} vendedor{qtdVendedores > 1 ? "es" : ""} que preencheram a planilha este mês.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-aura-mist text-left text-xs text-aura-graphite-soft">
              <th className="pb-2 pr-3 font-medium">Métrica</th>
              <th className="pb-2 pr-3 font-medium">Resultado</th>
              <th className="pb-2 pr-3 font-medium">Meta (soma)</th>
              <th className="pb-2 font-medium">% Meta</th>
            </tr>
          </thead>
          <tbody>
            {METRICAS.map((m) => {
              const resultado = porMetrica[m.chave] ?? 0;
              const meta = metaTotal[m.chave] ?? 0;
              const pct = meta > 0 ? (resultado / meta) * 100 : 0;
              return (
                <tr key={m.chave} className="border-b border-aura-mist last:border-0">
                  <td className="py-2 pr-3 text-aura-graphite">{m.label}</td>
                  <td className="py-2 pr-3 font-medium text-aura-graphite">{formatar(resultado, m.formato)}</td>
                  <td className="py-2 pr-3 text-aura-graphite-soft">{formatar(meta, m.formato)}</td>
                  <td className="py-2 font-medium text-aura-graphite">{meta > 0 ? `${pct.toFixed(0)}%` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
