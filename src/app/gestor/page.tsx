"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Video,
  Settings,
  Users,
  Megaphone,
  Sparkles,
  Table2,
  Wallet,
  Star,
  Trophy,
  ShieldCheck,
  AtSign,
  GraduationCap,
  CalendarRange,
  Target,
  GitBranch,
  HeartPulse,
  LayoutDashboard,
  UsersRound,
  FileBarChart,
  KeyRound,
  SlidersHorizontal,
  MessagesSquare,
} from "lucide-react";
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
 * O painel em SEIS ÁREAS, cada uma com as suas abas.
 *
 * Eram 19 itens no mesmo menu lateral: o gestor precisava ler a lista inteira
 * para achar uma tela, e "Custo da IA" tinha o mesmo peso que "Equipe". O
 * pedido do Elton (25/11) foi "mais organizado, que não fique confuso". Agora
 * o menu tem seis portas, na ordem do dia do gestor — ver como está, cobrar a
 * equipe, olhar os números, cuidar dos acessos, cuidar da AURA, ajustar o
 * sistema — e cada porta abre poucas abas de um assunto só.
 *
 * Os ids das abas não mudaram: links antigos (/gestor?aba=saude, que o sino
 * das Sentinelas usa) continuam abrindo a aba certa, dentro da área dela.
 */
type AreaGestor = "visao" | "equipe" | "relatorios" | "acessos" | "aura" | "ajustes";

const AREAS: Array<{ id: AreaGestor; titulo: string; descricao: string; icone: typeof BarChart3 }> = [
  { id: "visao", titulo: "Visão geral", descricao: "Como a operação está agora e o que fazer primeiro", icone: LayoutDashboard },
  { id: "equipe", titulo: "Equipe", descricao: "Conversa por conversa, metas e prêmios de cada um", icone: UsersRound },
  { id: "relatorios", titulo: "Relatórios", descricao: "Fechou, perdeu e os indicadores de leads", icone: FileBarChart },
  { id: "acessos", titulo: "Pessoas e acessos", descricao: "Quem entra no CRM e o que cada um pode fazer", icone: KeyRound },
  { id: "aura", titulo: "AURA", descricao: "O que a IA aprendeu e quanto ela custa", icone: Sparkles },
  { id: "ajustes", titulo: "Ajustes", descricao: "Funil, canais, avaliações e regras do CRM", icone: SlidersHorizontal },
];

const ABAS: Array<{
  id: AbaGestor;
  label: string;
  descricao: string;
  icon: typeof BarChart3;
  area: AreaGestor;
  /** Só aparece para quem enxerga as quatro lojas (o servidor confere de novo). */
  soMestre?: boolean;
}> = [
  // Visão geral
  { id: "aura", label: "Supervisora AURA", descricao: "Equipe, riscos e o que fazer agora", icon: Sparkles, area: "visao" },
  { id: "movimentacao", label: "Movimentação do dia", descricao: "O que cada um fez hoje, e quem não apareceu", icon: Activity, area: "visao" },
  { id: "dashboard", label: "Dashboard", descricao: "Visão comercial, equipe e resultados", icon: BarChart3, area: "visao" },
  // Equipe
  { id: "equipe", label: "Conversa por conversa", descricao: "Loja → vendedor → conversa e negociação, com o laudo da IA", icon: MessagesSquare, area: "equipe" },
  { id: "pontuacao", label: "Metas e prêmios", descricao: "Meta por pessoa, pontos e premiação", icon: Target, area: "equipe" },
  { id: "ranking", label: "Regras do ranking", descricao: "O que conta, quanto pesa e o corte do bônus", icon: Trophy, area: "equipe" },
  // Relatórios
  { id: "semanal", label: "Relatório do período", descricao: "Fechou, perdeu e onde cada um erra", icon: CalendarRange, area: "relatorios" },
  { id: "planilha", label: "Planilha de leads", descricao: "Indicadores de leads preenchidos pela equipe", icon: Table2, area: "relatorios" },
  // Pessoas e acessos
  { id: "usuarios", label: "Usuários", descricao: "Gerencie os acessos da empresa", icon: Users, area: "acessos" },
  { id: "permissoes", label: "Permissões", descricao: "Aprovar gestores e definir o que cada um faz", icon: ShieldCheck, area: "acessos" },
  // AURA
  { id: "aprendizado", label: "Aprendizado", descricao: "Aprove o que ela tirou das conversas", icon: GraduationCap, area: "aura" },
  { id: "configuracoes", label: "Base de conhecimento", descricao: "O que a AURA sabe e as regras do CRM", icon: Settings, area: "aura" },
  { id: "custo-ia", label: "Custo da IA", descricao: "Saldo, consumo e depósitos da AURA", icon: Wallet, area: "aura" },
  // Ajustes
  { id: "funil", label: "Etapas do funil", descricao: "Renomeie, reordene e escolha o que conta no pipeline", icon: GitBranch, area: "ajustes" },
  { id: "atendimento", label: "Atendimento por distância", descricao: "O que oferecer a quem está longe do showroom", icon: Video, area: "ajustes" },
  { id: "avaliacoes", label: "Avaliações", descricao: "Links do Google e redes, e quem já avaliou", icon: Star, area: "ajustes" },
  { id: "instagram", label: "Instagram", descricao: "Conectar a conta de cada loja e liberar quem atende", icon: AtSign, area: "ajustes" },
  { id: "marketing", label: "Marketing", descricao: "Dashboard, usuários e configurações de marketing", icon: Megaphone, area: "ajustes" },
  { id: "saude", label: "Saúde do sistema", descricao: "O que as Sentinelas acharam: crons, backup, dados e acessos", icon: HeartPulse, area: "ajustes", soMestre: true },
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

  /**
   * A aba aberta vai para o endereço (?aba=…): recarregar a página volta para
   * o mesmo lugar e o link copiado abre a mesma tela para outro gestor.
   * replaceState, e não push: trocar de aba não enche o histórico do "voltar".
   */
  function abrir(id: AbaGestor) {
    setAba(id);
    const url = new URL(window.location.href);
    url.searchParams.set("aba", id);
    window.history.replaceState(null, "", url);
  }

  const visiveis = ABAS.filter((a) => !a.soMestre || souMestre);
  // Menu, cabeçalho e conteúdo seguem a mesma aba (`atual`): quem não é mestre
  // e abre /gestor?aba=saude cai na primeira aba, e não numa tela vazia.
  const atual = visiveis.find((a) => a.id === aba) ?? visiveis[0];
  const areaAtual = AREAS.find((ar) => ar.id === atual.area) ?? AREAS[0];
  const abasDaArea = visiveis.filter((a) => a.area === areaAtual.id);
  const areasVisiveis = AREAS.filter((ar) => visiveis.some((a) => a.area === ar.id));

  /** Abrir uma área = abrir a primeira aba dela. */
  function abrirArea(id: AreaGestor) {
    const primeira = visiveis.find((a) => a.area === id);
    if (primeira) abrir(primeira.id);
  }

  return (
    <div className="flex flex-col gap-6 pb-16 lg:flex-row lg:items-start lg:gap-8">
      {/* Computador: seis áreas no menu lateral, cada uma com uma linha de descrição. */}
      <nav className="hidden w-60 shrink-0 lg:sticky lg:top-20 lg:block" aria-label="Áreas do painel do gestor">
        <div className="flex flex-col gap-1">
          {areasVisiveis.map((area) => {
            const Icone = area.icone;
            const ativa = area.id === areaAtual.id;
            return (
              <button
                key={area.id}
                type="button"
                onClick={() => abrirArea(area.id)}
                aria-current={ativa ? "page" : undefined}
                className={`group flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                  ativa
                    ? "bg-aura-surface shadow-sm ring-1 ring-aura-mist"
                    : "hover:bg-aura-sunken"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    ativa ? "bg-aura-petrol-600 text-white" : "bg-aura-sunken text-aura-graphite-soft group-hover:text-aura-graphite"
                  }`}
                >
                  <Icone size={16} />
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-medium ${ativa ? "text-aura-graphite" : "text-aura-graphite-soft group-hover:text-aura-graphite"}`}>
                    {area.titulo}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-aura-graphite-soft">{area.descricao}</span>
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        {/* Celular: as áreas viram uma fileira de botões que rola de lado. */}
        <div className="-mx-4 mb-4 overflow-x-auto px-4 lg:hidden">
          <div className="flex gap-2" role="tablist" aria-label="Áreas do painel do gestor">
            {areasVisiveis.map((area) => {
              const Icone = area.icone;
              const ativa = area.id === areaAtual.id;
              return (
                <button
                  key={area.id}
                  type="button"
                  role="tab"
                  aria-selected={ativa}
                  onClick={() => abrirArea(area.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    ativa
                      ? "border-aura-petrol-600 bg-aura-petrol-600 text-white"
                      : "border-aura-mist bg-aura-surface text-aura-graphite-soft"
                  }`}
                >
                  <Icone size={15} />
                  {area.titulo}
                </button>
              );
            })}
          </div>
        </div>

        <header className="mb-4">
          <h1 className="font-display text-xl font-semibold text-aura-graphite">{areaAtual.titulo}</h1>
          <p className="text-sm text-aura-graphite-soft">{areaAtual.descricao}</p>
        </header>

        {/* Abas da área. Com uma aba só, a fileira não aparece. */}
        {abasDaArea.length > 1 && (
          <div className="mb-2 overflow-x-auto border-b border-aura-mist">
            <div className="flex gap-1" role="tablist" aria-label={`Abas de ${areaAtual.titulo}`}>
              {abasDaArea.map((item) => {
                const Icon = item.icon;
                const ativa = item.id === atual.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={ativa}
                    onClick={() => abrir(item.id)}
                    className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                      ativa
                        ? "border-aura-petrol-600 text-aura-graphite"
                        : "border-transparent text-aura-graphite-soft hover:border-aura-mist hover:text-aura-graphite"
                    }`}
                  >
                    <Icon size={15} className={ativa ? "text-aura-petrol-600" : ""} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <p className="mb-6 text-xs text-aura-graphite-soft">{atual.descricao}</p>

        {atual.id === "aura" && (
          <div className="space-y-5">
            <JustificativasEquipe />
            <GestorPainelAura />
          </div>
        )}
        {atual.id === "equipe" && <EquipeTab />}
        {atual.id === "movimentacao" && <MovimentacaoTab />}
        {atual.id === "atendimento" && <AtendimentoTab />}
        {atual.id === "funil" && <FunilTab />}
        {atual.id === "semanal" && <RelatorioSemanalTab />}
        {atual.id === "pontuacao" && <PontuacaoTab />}
        {atual.id === "aprendizado" && <AprendizadoCard />}
        {atual.id === "dashboard" && <DashboardTab />}
        {atual.id === "planilha" && <PlanilhaLeadsDashboard />}
        {atual.id === "usuarios" && <UsuariosTab />}
        {atual.id === "permissoes" && <PermissoesTab />}
        {atual.id === "instagram" && <InstagramTab />}
        {atual.id === "ranking" && <RankingConfigTab />}
        {atual.id === "avaliacoes" && <AvaliacoesTab />}
        {atual.id === "custo-ia" && <CustoIAPainel />}
        {atual.id === "saude" && souMestre && <SaudeSistema />}
        {atual.id === "configuracoes" && <ConfiguracoesTab />}
        {atual.id === "marketing" && <MarketingTab />}
      </div>
    </div>
  );
}
