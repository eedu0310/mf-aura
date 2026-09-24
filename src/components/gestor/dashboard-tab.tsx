"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Filter, DollarSign, Users, Loader2, ShoppingBag, ArrowRight } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useAppData } from "@/lib/app-data-context";
import { useUserProfile } from "@/lib/user-profile-context";
import { carregarEquipe, type MembroEquipe } from "@/lib/supabase/team";
import { TeamRoster } from "@/components/gestor/team-roster";
import { ManagerAlerts } from "@/components/gestor/manager-alerts";
import { AprovacaoCompromissosMensais } from "@/components/gestor/aprovacao-compromissos-mensais";
import { AlertaLeadsSemResposta } from "@/components/gestor/alerta-leads-sem-resposta";
import { MeetingPrepCard } from "@/components/gestor/meeting-prep-card";
import { PosVendaResumoCard } from "@/components/gestor/pos-venda-resumo-card";
import { PlanilhaConsolidada } from "@/components/gestor/planilha-consolidada";
import { CalendarioPostagens } from "@/components/marketing/calendario-postagens";
import { AuraManagerPanel } from "@/components/gestor/aura-manager-panel";

const CORES = ["#0F766E", "#14B8A6", "#2DD4BF", "#99F6E4"];

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

export function DashboardTab() {
  const { profile } = useUserProfile();
  const { oportunidadesTodasLojas, vendasTodasLojas, atividades, relacionamentos } = useAppData();
  const [equipe, setEquipe] = useState<MembroEquipe[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      const dados = await carregarEquipe();
      if (dados === null) {
        setEquipe([
          {
            id: "local",
            nome: profile.nome || "Você",
            empresa: profile.empresa,
            ativo: true,
            cargo: profile.cargo ?? "Vendedor",
            vendasTotal: vendasTodasLojas.reduce((s, v) => s + v.valor, 0),
            vendasEsteMes: vendasTodasLojas.reduce((s, v) => s + v.valor, 0),
            vendasMesPassado: 0,
            atividades7dias: 0,
            souEu: true,
          },
        ]);
      } else {
        setEquipe(dados);
      }
      setCarregando(false);
    }
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const valorPipeline = oportunidadesTodasLojas.reduce((soma, o) => soma + o.valor, 0);
  const valorVendido = vendasTodasLojas.reduce((soma, v) => soma + v.valor, 0);

  const dadosFaturamento = useMemo(() => {
    const porMes = new Map<string, { mes: string; confirmado: number; previsto: number }>();
    for (const venda of vendasTodasLojas) {
      const data = new Date(venda.data);
      if (Number.isNaN(data.getTime())) continue;
      const chave = `${data.getFullYear()}-${data.getMonth()}`;
      const atual = porMes.get(chave) ?? { mes: data.toLocaleDateString("pt-BR", { month: "short" }), confirmado: 0, previsto: 0 };
      atual.confirmado += Number(venda.valor ?? 0);
      porMes.set(chave, atual);
    }
    return [...porMes.values()].slice(-6);
  }, [vendasTodasLojas]);

  const dadosPipeline = useMemo(() => {
    const etapas = ["Prospecção", "Apresentação", "Proposta", "Negociação", "Fechados"];
    return etapas.map((nome) => ({
      nome,
      valor: oportunidadesTodasLojas.filter((o) => o.etapa === nome).reduce((total, o) => total + Number(o.valor ?? 0), 0),
    })).filter((item) => item.valor > 0);
  }, [oportunidadesTodasLojas]);

  const dadosAtividades = useMemo(() => {
    const dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    return dias.map((dia, indice) => {
      const doDia = atividades.filter((atividade: any) => {
        const data = new Date(atividade.data ?? atividade.quando ?? atividade.createdAt ?? atividade.created_at ?? "");
        return !Number.isNaN(data.getTime()) && data.getDay() === (indice + 1) % 7;
      });
      return {
        dia,
        ligacoes: doDia.filter((a: any) => String(a.tipo ?? a.tipo_atividade ?? "").toLowerCase().includes("liga")).length,
        visitas: doDia.filter((a: any) => String(a.tipo ?? a.tipo_atividade ?? "").toLowerCase().includes("visit")).length,
        reunioes: doDia.filter((a: any) => String(a.tipo ?? a.tipo_atividade ?? "").toLowerCase().includes("reuni")).length,
      };
    });
  }, [atividades]);

  return (
    <div className="space-y-6 pb-16">
      {/* Aprovação de Compromissos */}
      <AprovacaoCompromissosMensais />

      {/* Resumo Consolidado */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-aura-petrol-600" />
            <p className="text-sm text-aura-graphite-soft">Vendedores</p>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-aura-graphite">
            {equipe.length}
          </p>
        </div>
        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-aura-petrol-600" />
            <p className="text-sm text-aura-graphite-soft">Pipeline</p>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-aura-graphite">
            {formatarMoeda(valorPipeline)}
          </p>
        </div>
        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-aura-petrol-600" />
            <p className="text-sm text-aura-graphite-soft">Vendido</p>
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-aura-graphite">
            {formatarMoeda(valorVendido)}
          </p>
        </div>
      </div>

      {/* Alertas */}
      <AlertaLeadsSemResposta />
      <PosVendaResumoCard />
      <AuraManagerPanel
        oportunidades={oportunidadesTodasLojas}
        relacionamentos={relacionamentos}
        atividades={atividades}
        vendas={vendasTodasLojas}
      />

      {/* Gráficos Principais */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Faturamento */}
        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <p className="font-medium text-aura-graphite">Faturamento vs Previsão</p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dadosFaturamento}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="confirmado" stroke="#0F766E" name="Confirmado" strokeWidth={2} />
              <Line type="monotone" dataKey="previsto" stroke="#14B8A6" name="Previsto" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pipeline */}
        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <p className="font-medium text-aura-graphite">Pipeline por Estágio</p>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={dadosPipeline}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => `${entry.nome}: R$ ${(entry.valor / 1000).toFixed(0)}k`}
                outerRadius={100}
                fill="#0F766E"
                dataKey="valor"
              >
                {dadosPipeline.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CORES[index]} />
                ))}
              </Pie>
            <Tooltip formatter={(value: any) => value ? `R$ ${value.toLocaleString("pt-BR")}` : ""} />            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Atividades */}
      <div className="rounded-2xl border border-aura-mist bg-white p-5">
        <p className="font-medium text-aura-graphite">Atividades da Semana</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dadosAtividades}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="dia" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="ligacoes" fill="#0F766E" name="Ligações" />
            <Bar dataKey="visitas" fill="#14B8A6" name="Visitas" />
            <Bar dataKey="reunioes" fill="#2DD4BF" name="Reuniões" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Planilha e Calendário */}
      <PlanilhaConsolidada />
      <CalendarioPostagens />

      {/* Atalhos Rápidos */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          href="/relacionamentos"
          className="flex items-center gap-2 rounded-2xl border border-aura-mist bg-white p-3.5 transition hover:border-aura-petrol-500/40"
        >
          <Users size={15} className="text-aura-petrol-600" />
          <span className="flex-1 text-xs font-medium text-aura-graphite">CRM</span>
          <ArrowRight size={12} className="text-aura-graphite-soft" />
        </Link>
        <Link
          href="/pipeline"
          className="flex items-center gap-2 rounded-2xl border border-aura-mist bg-white p-3.5 transition hover:border-aura-petrol-500/40"
        >
          <Filter size={15} className="text-aura-petrol-600" />
          <span className="flex-1 text-xs font-medium text-aura-graphite">Pipeline</span>
          <ArrowRight size={12} className="text-aura-graphite-soft" />
        </Link>
        <Link
          href="/vendas"
          className="flex items-center gap-2 rounded-2xl border border-aura-mist bg-white p-3.5 transition hover:border-aura-petrol-500/40"
        >
          <ShoppingBag size={15} className="text-aura-petrol-600" />
          <span className="flex-1 text-xs font-medium text-aura-graphite">Vendas</span>
          <ArrowRight size={12} className="text-aura-graphite-soft" />
        </Link>
        <Link
          href="/leads"
          className="flex items-center gap-2 rounded-2xl border border-aura-mist bg-white p-3.5 transition hover:border-aura-petrol-500/40"
        >
          <Users size={15} className="text-aura-petrol-600" />
          <span className="flex-1 text-xs font-medium text-aura-graphite">Leads</span>
          <ArrowRight size={12} className="text-aura-graphite-soft" />
        </Link>
      </div>

      {/* Equipe e Alertas */}
      {carregando ? (
        <div className="flex justify-center py-8 text-aura-graphite-soft">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : (
        <>
          <ManagerAlerts equipe={equipe} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
            <TeamRoster equipe={equipe} />
            <MeetingPrepCard equipe={equipe} />
          </div>
        </>
      )}
    </div>
  );
}
