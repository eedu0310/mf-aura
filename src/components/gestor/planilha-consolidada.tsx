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
import { CardHeader, EstadoVazio } from "@/components/ui";

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
      <div className="aura-card flex justify-center py-12 text-aura-graphite-soft">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  if (qtdVendedores === 0) {
    return (
      <EstadoVazio
        icone={Table2}
        titulo="Nenhum vendedor preencheu a planilha de indicadores ainda este mês."
      />
    );
  }

  return (
    <div className="aura-card overflow-hidden">
      <div className="px-5 pt-5">
        <CardHeader
          titulo={`Indicadores Consolidados — ${mes}`}
          descricao={`Soma de ${qtdVendedores} vendedor${qtdVendedores > 1 ? "es" : ""} que preencheram a planilha este mês.`}
          icone={Table2}
        />
      </div>

      <div className="overflow-x-auto border-t border-aura-mist">
        <table className="aura-tabela min-w-[520px]">
          <thead>
            <tr className="text-left">
              <th>Métrica</th>
              <th className="text-right">Resultado</th>
              <th className="text-right">Meta (soma)</th>
              <th className="text-right">% Meta</th>
            </tr>
          </thead>
          <tbody>
            {METRICAS.map((m) => {
              const resultado = porMetrica[m.chave] ?? 0;
              const meta = metaTotal[m.chave] ?? 0;
              const pct = meta > 0 ? (resultado / meta) * 100 : 0;
              return (
                <tr key={m.chave}>
                  <td>{m.label}</td>
                  <td className="text-right font-medium tabular-nums">{formatar(resultado, m.formato)}</td>
                  <td className="text-right tabular-nums text-aura-graphite-soft">{formatar(meta, m.formato)}</td>
                  <td className="text-right font-medium tabular-nums">{meta > 0 ? `${pct.toFixed(0)}%` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
