"use client";

import { useState } from "react";
import { Activity, BarChart3, Video, Settings, Users, Megaphone, Sparkles, Table2, Wallet, Star, Trophy, ShieldCheck, AtSign, GraduationCap, CalendarRange, Target} from "lucide-react";
import { DashboardTab } from "@/components/gestor/dashboard-tab";
import { UsuariosTab } from "@/components/gestor/usuarios-tab";
import { ConfiguracoesTab } from "@/components/gestor/configuracoes-tab";
import { MarketingTab } from "@/components/gestor/marketing-tab";
import { PlanilhaLeadsDashboard } from "@/components/planilha-leads/planilha-leads-dashboard";
import { GestorPainelAura } from "@/components/aura/gestor-painel-aura";
import { CustoIAPainel } from "@/components/gestor/custo-ia-painel";
import { AvaliacoesTab } from "@/components/gestor/avaliacoes-tab";
import { RankingConfigTab } from "@/components/gestor/ranking-config-tab";
import { PermissoesTab } from "@/components/gestor/permissoes-tab";
import { InstagramTab } from "@/components/gestor/instagram-tab";
import { AprendizadoCard } from "@/components/gestor/aprendizado-card";
import { RelatorioSemanalTab } from "@/components/gestor/relatorio-semanal-tab";
import { MovimentacaoTab } from "@/components/gestor/movimentacao-tab";
import { AtendimentoTab } from "@/components/gestor/atendimento-tab";
import { PontuacaoTab } from "@/components/gestor/pontuacao-tab";

 type AbaGestor =
  | "aura"
  | "dashboard"
  | "planilha"
  | "usuarios"
  | "permissoes"
  | "instagram"
  | "ranking"
  | "avaliacoes"
  | "custo-ia"
  | "configuracoes"
  | "marketing"
  | "aprendizado"
  | "semanal"
  | "movimentacao"
  | "atendimento"
  | "pontuacao";

const ABAS: Array<{
  id: AbaGestor;
  label: string;
  descricao: string;
  icon: typeof BarChart3;
}> = [
  {
    id: "aura",
    label: "Supervisora AURA",
    descricao: "Equipe, riscos e o que fazer agora",
    icon: Sparkles,
  },
  {
    id: "movimentacao",
    label: "Movimentação do dia",
    descricao: "O que cada um fez hoje, e quem não apareceu",
    icon: Activity,
  },
  {
    id: "semanal",
    label: "Relatório do período",
    descricao: "Fechou, perdeu e onde cada um erra",
    icon: CalendarRange,
  },
  {
    id: "atendimento",
    label: "Atendimento por distância",
    descricao: "O que oferecer a quem está longe do showroom",
    icon: Video,
  },
  {
    id: "pontuacao",
    label: "Metas e prêmios",
    descricao: "Meta por pessoa, pontos e premiação",
    icon: Target,
  },
  {
    id: "aprendizado",
    label: "Aprendizado da AURA",
    descricao: "Aprove o que ela tirou das conversas",
    icon: GraduationCap,
  },
  {
    id: "dashboard",
    label: "Dashboard",
    descricao: "Visão comercial, equipe e resultados",
    icon: BarChart3,
  },
  {
    id: "planilha",
    label: "Planilha de Leads",
    descricao: "Indicadores de leads preenchidos pela equipe",
    icon: Table2,
  },
  {
    id: "usuarios",
    label: "Usuários",
    descricao: "Gerencie os acessos da empresa",
    icon: Users,
  },
  {
    id: "permissoes",
    label: "Permissões",
    descricao: "Aprovar gestores e definir o que cada um faz",
    icon: ShieldCheck,
  },
  {
    id: "instagram",
    label: "Instagram",
    descricao: "Conectar a conta de cada loja e liberar quem atende",
    icon: AtSign,
  },
  {
    id: "ranking",
    label: "Ranking",
    descricao: "O que conta, quanto pesa e o corte do bônus",
    icon: Trophy,
  },
  {
    id: "avaliacoes",
    label: "Avaliações",
    descricao: "Links do Google e redes, e quem já avaliou",
    icon: Star,
  },
  {
    id: "custo-ia",
    label: "Custo da IA",
    descricao: "Saldo, consumo e depósitos da AURA",
    icon: Wallet,
  },
  {
    id: "configuracoes",
    label: "Configurações",
    descricao: "Base de conhecimento e regras do CRM",
    icon: Settings,
  },
  {
    id: "marketing",
    label: "Marketing",
    descricao: "Dashboard, usuários e configurações de marketing",
    icon: Megaphone,
  },
];

export default function GestorPage() {
  const [aba, setAba] = useState<AbaGestor>("aura");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-16">
      <header>
        <p className="font-display text-xl font-semibold text-aura-graphite">
          Painel do Gestor
        </p>
        <p className="text-sm text-aura-graphite-soft">
          Gerencie resultados, equipe, configurações e marketing em áreas separadas.
        </p>
      </header>

      <nav
        className="grid grid-cols-1 gap-2 rounded-2xl border border-aura-mist bg-white p-2 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Navegação do painel do gestor"
      >
        {ABAS.map((item) => {
          const Icon = item.icon;
          const ativa = aba === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setAba(item.id)}
              className={`flex items-start gap-3 rounded-xl px-4 py-3 text-left transition ${
                ativa
                  ? "bg-aura-navy-950 text-white"
                  : "text-aura-graphite hover:bg-aura-bg"
              }`}
              aria-selected={ativa}
            >
              <Icon
                size={18}
                className={ativa ? "mt-0.5 text-aura-gold" : "mt-0.5 text-aura-petrol-600"}
              />
              <span>
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className={`mt-0.5 block text-xs ${ativa ? "text-white/60" : "text-aura-graphite-soft"}`}>
                  {item.descricao}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      {aba === "aura" && <GestorPainelAura />}
      {aba === "movimentacao" && <MovimentacaoTab />}
      {aba === "atendimento" && <AtendimentoTab />}
      {aba === "semanal" && <RelatorioSemanalTab />}
      {aba === "pontuacao" && <PontuacaoTab />}
      {aba === "aprendizado" && <AprendizadoCard />}
      {aba === "dashboard" && <DashboardTab />}
      {aba === "planilha" && <PlanilhaLeadsDashboard />}
      {aba === "usuarios" && <UsuariosTab />}
      {aba === "permissoes" && <PermissoesTab />}
      {aba === "instagram" && <InstagramTab />}
      {aba === "ranking" && <RankingConfigTab />}
      {aba === "avaliacoes" && <AvaliacoesTab />}
      {aba === "custo-ia" && <CustoIAPainel />}
      {aba === "configuracoes" && <ConfiguracoesTab />}
      {aba === "marketing" && <MarketingTab />}
    </div>
  );
}
