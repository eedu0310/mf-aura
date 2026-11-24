"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Filter, DollarSign, Users, Loader2, ShoppingBag, ArrowRight, BarChart3, LineChart as LineChartIcon, PieChart as PieChartIcon } from "lucide-react";
import { Card, CardHeader, StatCard } from "@/components/ui";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useAppData } from "@/lib/app-data-context";
import { colunaDoNegocio, etapasVisiveis } from "@/lib/funil";
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

// Cores da marca que funcionam nos dois temas: petróleo, ouro, petróleo claro, cinza.
const CORES = ["#138780", "#c99a33", "#3aa59d", "#8a94a3"];

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

export function DashboardTab() {
  const { profile } = useUserProfile();
  const { oportunidadesTodasLojas, vendasTodasLojas, atividades, relacionamentos, funil } = useAppData();
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
    // As etapas do funil da loja, sem a de perda: num gráfico de valor em
    // aberto, negócio perdido não é dinheiro em jogo.
    return etapasVisiveis(funil)
      .filter((e) => e.tipo !== "perda")
      .map((e) => ({
        nome: e.nome,
        valor: oportunidadesTodasLojas
          .filter((o) => colunaDoNegocio(o.etapa, funil) === e.nome)
          .reduce((total, o) => total + Number(o.valor ?? 0), 0),
      }))
      .filter((item) => item.valor > 0);
  }, [oportunidadesTodasLojas, funil]);

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

  const eixo = { fill: "currentColor", fontSize: 11 };
  const caixaTooltip = {
    background: "var(--aura-surface)",
    border: "1px solid var(--aura-mist)",
    borderRadius: 8,
    color: "var(--aura-graphite)",
    fontSize: 12,
  };
  const atalhos = [
    { href: "/relacionamentos", rotulo: "CRM", icone: Users },
    { href: "/pipeline", rotulo: "Pipeline", icone: Filter },
    { href: "/vendas", rotulo: "Vendas", icone: ShoppingBag },
    { href: "/leads", rotulo: "Leads", icone: Users },
  ];

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* Aprovação de Compromissos */}
      <AprovacaoCompromissosMensais />

      {/* Resumo Consolidado */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard rotulo="Vendedores" valor={equipe.length} icone={Users} tom="marca" />
        <StatCard rotulo="Pipeline" valor={formatarMoeda(valorPipeline)} icone={Filter} tom="marca" />
        <StatCard rotulo="Vendido" valor={formatarMoeda(valorVendido)} icone={DollarSign} tom="sucesso" />
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
        <Card>
          <CardHeader titulo="Faturamento vs Previsão" icone={LineChartIcon} />
          <div className="text-aura-graphite-soft">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dadosFaturamento}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--aura-mist)" vertical={false} />
                <XAxis dataKey="mes" tick={eixo} stroke="var(--aura-mist)" />
                <YAxis tick={eixo} stroke="var(--aura-mist)" />
                <Tooltip contentStyle={caixaTooltip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="confirmado" stroke={CORES[0]} name="Confirmado" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="previsto" stroke={CORES[1]} name="Previsto" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Pipeline */}
        <Card>
          <CardHeader titulo="Pipeline por Estágio" icone={PieChartIcon} />
          <div className="text-aura-graphite-soft">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dadosPipeline}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry: any) => `${entry.nome}: R$ ${(entry.valor / 1000).toFixed(0)}k`}
                  outerRadius={100}
                  fill={CORES[0]}
                  stroke="var(--aura-surface)"
                  dataKey="valor"
                >
                  {dadosPipeline.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CORES[index % CORES.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={caixaTooltip} formatter={(value: any) => value ? `R$ ${value.toLocaleString("pt-BR")}` : ""} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Atividades */}
      <Card>
        <CardHeader titulo="Atividades da Semana" icone={BarChart3} />
        <div className="text-aura-graphite-soft">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dadosAtividades}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--aura-mist)" vertical={false} />
              <XAxis dataKey="dia" tick={eixo} stroke="var(--aura-mist)" />
              <YAxis tick={eixo} stroke="var(--aura-mist)" />
              <Tooltip contentStyle={caixaTooltip} cursor={{ fill: "var(--aura-sunken)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="ligacoes" fill={CORES[0]} name="Ligações" radius={[4, 4, 0, 0]} />
              <Bar dataKey="visitas" fill={CORES[1]} name="Visitas" radius={[4, 4, 0, 0]} />
              <Bar dataKey="reunioes" fill={CORES[2]} name="Reuniões" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Planilha e Calendário */}
      <PlanilhaConsolidada />
      <CalendarioPostagens />

      {/* Atalhos Rápidos */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {atalhos.map(({ href, rotulo, icone: Icone }) => (
          <Link key={href} href={href} className="aura-card aura-card-interativo flex items-center gap-2 p-3.5">
            <Icone size={15} className="text-aura-petrol-600" />
            <span className="flex-1 text-xs font-medium text-aura-graphite">{rotulo}</span>
            <ArrowRight size={12} className="text-aura-graphite-soft" />
          </Link>
        ))}
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
