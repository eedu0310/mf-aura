"use client";

import { useEffect, useState } from "react";
import { Activity, BarChart3, Video, Settings, Users, Megaphone, Sparkles, Table2, Wallet, Star, Trophy, ShieldCheck, AtSign, GraduationCap, CalendarRange, Target, GitBranch, HeartPulse} from "lucide-react";
import { usarMeuAcesso } from "@/lib/usar-permissoes";
import { SaudeSistema } from "@/components/gestor/saude-sistema";
import { DashboardTab } from "@/components/gestor/dashboard-tab";
import { UsuariosTab } from "@/components/gestor/usuarios-tab";
import { ConfiguracoesTab } from "@/components/gestor/configuracoes-tab";
import { MarketingTab } from "@/components/gestor/marketing-tab";
import { PlanilhaLeadsDashboard } from "@/components/planilha-leads/planilha-leads-dashboard";
import { GestorPainelAura } from "@/components/aura/gestor-painel-aura";
import { JustificativasEquipe } from "@/components/gestor/justificativas-equipe";
import { CustoIAPainel } from "@/components/gestor/custo-ia-painel";
import { AvaliacoesTab } from "@/components/gestor/avaliacoes-tab";
import { RankingConfigTab } from "@/components/gestor/ranking-config-tab";
import { PermissoesTab } from "@/components/gestor/permissoes-tab";
import { InstagramTab } from "@/components/gestor/instagram-tab";
import { AprendizadoCard } from "@/components/gestor/aprendizado-card";
import { RelatorioSemanalTab } from "@/components/gestor/relatorio-semanal-tab";
import { MovimentacaoTab } from "@/components/gestor/movimentacao-tab";
import { AtendimentoTab } from "@/components/gestor/atendimento-tab";
import { FunilTab } from "@/components/gestor/funil-tab";
import { PontuacaoTab } from "@/components/gestor/pontuacao-tab";
import { EquipeTab } from "@/components/gestor/equipe-tab";

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
  | "funil"
  | "pontuacao"
  | "equipe"
  | "saude";

/**
 * As dezesseis abas do painel, agora com um grupo cada.
 *
 * Elas estavam todas no mesmo nível, numa grade de quatro colunas: dezesseis
 * cartões iguais em que "Custo da IA" tinha o mesmo peso visual que "Equipe".
 * O pedido foi "deixa tudo bem separado"; os grupos abaixo são a separação.
 *
 *   resultado — o que aconteceu: números, conversas, relatórios
 *   equipe    — as pessoas: acesso, poder, meta, ranking
 *   ajustes   — como o sistema se comporta: funil, atendimento, integrações
 */
type GrupoDaAba = "resultado" | "equipe" | "ajustes";

const GRUPOS: Array<{ id: GrupoDaAba; titulo: string; descricao: string }> = [
  {
    id: "resultado",
    titulo: "Resultado",
    descricao: "O que a equipe fez, conversa por conversa",
  },
  {
    id: "equipe",
    titulo: "Equipe",
    descricao: "Quem entra, quem manda, quanto cada um precisa entregar",
  },
  {
    id: "ajustes",
    titulo: "Ajustes do sistema",
    descricao: "Como o CRM e a AURA se comportam",
  },
];

const ABAS: Array<{
  id: AbaGestor;
  label: string;
  descricao: string;
  icon: typeof BarChart3;
  grupo: GrupoDaAba;
  /** Só aparece para quem enxerga as quatro lojas (o servidor confere de novo). */
  soMestre?: boolean;
}> = [
  {
    id: "aura",
    label: "Supervisora AURA",
    descricao: "Equipe, riscos e o que fazer agora",
    icon: Sparkles,
    grupo: "resultado",
  },
  {
    id: "equipe",
    label: "Equipe, conversa por conversa",
    descricao: "Loja → vendedor → conversa e negociação, com o laudo da IA",
    icon: Users,
    grupo: "resultado",
  },
  {
    id: "movimentacao",
    label: "Movimentação do dia",
    descricao: "O que cada um fez hoje, e quem não apareceu",
    icon: Activity,
    grupo: "resultado",
  },
  {
    id: "semanal",
    label: "Relatório do período",
    descricao: "Fechou, perdeu e onde cada um erra",
    icon: CalendarRange,
    grupo: "resultado",
  },
  {
    id: "atendimento",
    label: "Atendimento por distância",
    descricao: "O que oferecer a quem está longe do showroom",
    icon: Video,
    grupo: "ajustes",
  },
  {
    id: "funil",
    label: "Etapas do funil",
    descricao: "Renomeie, reordene e escolha o que conta no pipeline",
    icon: GitBranch,
    grupo: "ajustes",
  },
  {
    id: "pontuacao",
    label: "Metas e prêmios",
    descricao: "Meta por pessoa, pontos e premiação",
    icon: Target,
    grupo: "equipe",
  },
  {
    id: "aprendizado",
    label: "Aprendizado da AURA",
    descricao: "Aprove o que ela tirou das conversas",
    icon: GraduationCap,
    grupo: "equipe",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    descricao: "Visão comercial, equipe e resultados",
    icon: BarChart3,
    grupo: "resultado",
  },
  {
    id: "planilha",
    label: "Planilha de Leads",
    descricao: "Indicadores de leads preenchidos pela equipe",
    icon: Table2,
    grupo: "resultado",
  },
  {
    id: "usuarios",
    label: "Usuários",
    descricao: "Gerencie os acessos da empresa",
    icon: Users,
    grupo: "equipe",
  },
  {
    id: "permissoes",
    label: "Permissões",
    descricao: "Aprovar gestores e definir o que cada um faz",
    icon: ShieldCheck,
    grupo: "equipe",
  },
  {
    id: "instagram",
    label: "Instagram",
    descricao: "Conectar a conta de cada loja e liberar quem atende",
    icon: AtSign,
    grupo: "ajustes",
  },
  {
    id: "ranking",
    label: "Ranking",
    descricao: "O que conta, quanto pesa e o corte do bônus",
    icon: Trophy,
    grupo: "equipe",
  },
  {
    id: "avaliacoes",
    label: "Avaliações",
    descricao: "Links do Google e redes, e quem já avaliou",
    icon: Star,
    grupo: "ajustes",
  },
  {
    id: "custo-ia",
    label: "Custo da IA",
    descricao: "Saldo, consumo e depósitos da AURA",
    icon: Wallet,
    grupo: "ajustes",
  },
  {
    id: "configuracoes",
    label: "Configurações",
    descricao: "Base de conhecimento e regras do CRM",
    icon: Settings,
    grupo: "ajustes",
  },
  {
    id: "marketing",
    label: "Marketing",
    descricao: "Dashboard, usuários e configurações de marketing",
    icon: Megaphone,
    grupo: "ajustes",
  },
  {
    id: "saude",
    label: "Saúde do sistema",
    descricao: "O que as Sentinelas acharam: crons, backup, dados e acessos",
    icon: HeartPulse,
    grupo: "ajustes",
    soMestre: true,
  },
];

export default function GestorPage() {
  const [aba, setAba] = useState<AbaGestor>("aura");
  const acesso = usarMeuAcesso();
  const souMestre = acesso.gestorMestre && acesso.gestorAprovado;

  // O aviso das Sentinelas no sino leva para /gestor?aba=saude: abre direto
  // na aba certa. Lido no navegador para não exigir Suspense no build.
  useEffect(() => {
    const pedida = new URLSearchParams(window.location.search).get("aba");
    if (pedida && ABAS.some((a) => a.id === pedida)) setAba(pedida as AbaGestor);
  }, []);

  const visiveis = ABAS.filter((a) => !a.soMestre || souMestre);
  const atual = visiveis.find((a) => a.id === aba) ?? visiveis[0];
  const IconeAtual = atual.icon;

  return (
    <div className="flex flex-col gap-6 pb-16 lg:flex-row lg:items-start lg:gap-8">
      {/*
        Navegação do painel: antes eram 19 cartões grandes empilhados em cima do
        conteúdo, e cada troca de aba empurrava a tela. Agora é um menu lateral
        compacto e agrupado (no computador) e uma lista de seleção (no celular),
        como nos CRMs de alto padrão. A descrição de cada aba aparece no
        cabeçalho da aba aberta.
      */}
      <nav
        className="hidden w-56 shrink-0 lg:sticky lg:top-20 lg:block"
        aria-label="Navegação do painel do gestor"
      >
        {GRUPOS.map((g) => {
          const doGrupo = visiveis.filter((a) => a.grupo === g.id);
          if (!doGrupo.length) return null;
          return (
            <div key={g.id} className="mb-5">
              <p className="mb-1 px-2.5 text-[0.68rem] font-medium uppercase tracking-wider text-aura-graphite-soft">
                {g.titulo}
              </p>
              <div className="flex flex-col gap-0.5">
                {doGrupo.map((item) => {
                  const Icon = item.icon;
                  const ativa = aba === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAba(item.id)}
                      title={item.descricao}
                      // aria-current, e não aria-selected: estes são botões de
                      // navegação, não abas de um tablist, e o leitor de tela
                      // ignora aria-selected num botão.
                      aria-current={ativa ? "page" : undefined}
                      className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[0.8125rem] font-medium transition ${
                        ativa
                          ? "bg-aura-surface text-aura-graphite shadow-sm ring-1 ring-aura-mist"
                          : "text-aura-graphite-soft hover:bg-aura-sunken hover:text-aura-graphite"
                      }`}
                    >
                      <Icon
                        size={16}
                        className={ativa ? "text-aura-petrol-600" : "text-aura-graphite-soft group-hover:text-aura-graphite"}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1">
        <label className="mb-4 block lg:hidden">
          <span className="sr-only">Área do painel</span>
          <select
            value={atual.id}
            onChange={(e) => setAba(e.target.value as AbaGestor)}
            className="h-11 w-full rounded-lg border border-aura-mist bg-aura-surface px-3 text-sm font-medium text-aura-graphite"
          >
            {GRUPOS.map((g) => {
              const doGrupo = visiveis.filter((a) => a.grupo === g.id);
              if (!doGrupo.length) return null;
              return (
                <optgroup key={g.id} label={g.titulo}>
                  {doGrupo.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>

        <header className="mb-6 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-aura-mist bg-aura-surface">
            <IconeAtual size={18} className="text-aura-petrol-600" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold text-aura-graphite">{atual.label}</h1>
            <p className="text-sm text-aura-graphite-soft">{atual.descricao}</p>
          </div>
        </header>

      {aba === "aura" && (
        <div className="space-y-5">
          <JustificativasEquipe />
          <GestorPainelAura />
        </div>
      )}
      {aba === "equipe" && <EquipeTab />}
      {aba === "movimentacao" && <MovimentacaoTab />}
      {aba === "atendimento" && <AtendimentoTab />}
      {aba === "funil" && <FunilTab />}
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
      {aba === "saude" && souMestre && <SaudeSistema />}
      {aba === "configuracoes" && <ConfiguracoesTab />}
      {aba === "marketing" && <MarketingTab />}
      </div>
    </div>
  );
}
