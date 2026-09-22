"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/lib/user-profile-context";
import { DashboardKPIs } from "./dashboard-kpis";
import { DashboardAlertasInteligentes } from "./dashboard-alertas-inteligentes";
import { DashboardFunil } from "./dashboard-funil";
import { DashboardPrevisao } from "./dashboard-previsao";
import { DashboardRanking } from "./dashboard-ranking";

interface VendedorDados {
  id: string;
  nome: string;
  empresa: string;
  faturamentoIndividual: number;
  faturamentoCompartilhada: number;
  faturamentoTotal: number;
  metaAnual: number;
  percentualMeta: number;
  atividades: number;
  leads: number;
  prospecaoPropria: number;
}

export function DashboardCompleto() {
  const { profile } = useUserProfile();
  const [vendedores, setVendedores] = useState<VendedorDados[]>([]);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setCarregando(false);
      return;
    }

    try {
      let query = supabase
        .from("profiles")
        .select("id, nome, empresa")
        .in("cargo", ["Vendedor", "Vendedor Interno"]);

      if (profile.cargo !== "Gestor" && profile.cargo !== "Diretor") {
        query = query.eq("empresa", profile.empresa);
      }

      const { data: vendedoresData } = await query;

      const dadosVendedores: VendedorDados[] = [];

      for (const v of vendedoresData || []) {
        const { data: vendas } = await supabase
          .from("vendas")
          .select("valor, valor_fechado")
          .eq("owner_id", v.id);

        const faturamentoIndividual = (vendas || [])
          .reduce((s: number, venda: any) => s + Number(venda.valor_fechado ?? venda.valor ?? 0), 0);

        const faturamentoCompartilhada = 0;

        const { data: atividades } = await supabase
          .from("atividades")
          .select("id")
          .eq("owner_id", v.id);

        const { data: relacionamentos } = await supabase
          .from("relacionamentos")
          .select("id")
          .eq("owner_id", v.id);

        const faturamentoTotal = faturamentoIndividual + faturamentoCompartilhada;
        const metaAnual = 0;

        dadosVendedores.push({
          id: v.id,
          nome: v.nome,
          empresa: v.empresa,
          faturamentoIndividual,
          faturamentoCompartilhada,
          faturamentoTotal,
          metaAnual,
          percentualMeta: (faturamentoTotal / metaAnual) * 100,
          atividades: (atividades || []).length,
          leads: (relacionamentos || []).length,
          prospecaoPropria: (relacionamentos || []).length,
        });
      }

      setVendedores(dadosVendedores);
    } catch (erro) {
      console.error("Erro ao carregar dashboard:", erro);
    }

    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, [profile.empresa]);

  if (carregando) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-aura-petrol-600" />
      </div>
    );
  }

  // Dados para KPIs
  const totalFaturamento = vendedores.reduce((s, v) => s + v.faturamentoTotal, 0);
  const totalVendas = vendedores.length;
  const totalLeads = vendedores.reduce((s, v) => s + v.leads, 0);
  const ticketMedio = totalVendas > 0 ? totalFaturamento / totalVendas : 0;
  const taxaConversao = totalLeads > 0 ? (totalVendas / totalLeads) * 100 : 0;

  const kpiData = {
    ticketMedio,
    taxaConversao,
    cicloDias: 0,
    evolucaoMes: 0,
  };

  // Alertas
  const alertas = vendedores
    .filter((v) => v.percentualMeta < 60)
    .map((v) => ({
      id: `risco-${v.id}`,
      tipo: "risco" as const,
      titulo: `${v.nome} em risco`,
      descricao: `Apenas ${v.percentualMeta.toFixed(0)}% da meta atingida`,
      severidade: "critica" as const,
      vendedor: v.nome,
      detalhes: `R$ ${(v.faturamentoTotal / 1000).toFixed(1)}k de R$ ${(v.metaAnual / 1000).toFixed(1)}k`,
    }));

  // Funil
  const funilDados = [
    { nome: "Prospecção", quantidade: totalLeads, valor: 0 },
    { nome: "Fechado", quantidade: totalVendas, valor: totalFaturamento },
  ];

  // Previsão
  const previsaoDados: Array<{ mes: string; confirmado: number; previsto: number; meta: number }> = [];

  // Ranking
  const rankingDados = vendedores
    .sort((a, b) => b.faturamentoTotal - a.faturamentoTotal)
    .map((v, idx) => ({
      posicao: idx + 1,
      nome: v.nome,
      faturamento: v.faturamentoTotal,
      meta: v.metaAnual,
      percentual: v.percentualMeta,
      tendencia: v.percentualMeta >= 50 ? ("up" as const) : ("down" as const),
      mudancaPosicao: 0,
    }));

  return (
    <div className="space-y-6">
      <DashboardKPIs dados={kpiData} />
      <DashboardAlertasInteligentes alertas={alertas} />
      <DashboardFunil dados={funilDados} />
      <DashboardPrevisao dados={previsaoDados} />
      <DashboardRanking dados={rankingDados} />
    </div>
  );
}
