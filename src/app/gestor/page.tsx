"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
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
import { AparenciaTab } from "@/components/gestor/aparencia-tab";
import { LeadsExcluidosTab } from "@/components/gestor/leads-excluidos-tab";
import { hrefDaAbaGestor, useAbaGestor } from "@/components/gestor/areas";

// A área Agentes só carrega o código dela quando alguém abre uma das abas.
// (As opções do dynamic ficam escritas em cada chamada: o compilador do Next lê o objeto ali mesmo.)
function CarregandoAgentes() {
  return <div className="h-64 rounded-xl bg-aura-sunken motion-safe:animate-pulse" aria-hidden />;
}
const Escritorio = dynamic(() => import("@/components/agentes/escritorio").then((m) => m.Escritorio), {
  loading: () => <CarregandoAgentes />,
});
const EquipeAgentes = dynamic(() => import("@/components/agentes/equipe").then((m) => m.EquipeAgentes), {
  loading: () => <CarregandoAgentes />,
});
const PropostasAgentes = dynamic(() => import("@/components/agentes/propostas").then((m) => m.PropostasAgentes), {
  loading: () => <CarregandoAgentes />,
});
const ConhecimentoAgentes = dynamic(() => import("@/components/agentes/conhecimento").then((m) => m.ConhecimentoAgentes), {
  loading: () => <CarregandoAgentes />,
});

/**
 * Conteúdo do Painel do Gestor. O menu das áreas está no layout (casca de
 * área de trabalho); aqui ficam o título da área, as abas dela e a tela da aba
 * aberta. Tudo segue a aba do endereço (src/components/gestor/areas.ts).
 */
export default function GestorPage() {
  const { atual, areaAtual, abasDaArea, souMestre } = useAbaGestor();

  // ?aba=instagram (a volta do "Conectar com o Instagram") já abre a aba: ela vem do endereço.

  return (
    <div className="pb-16">
      <header className="mb-4">
        <h1 className="font-display text-xl font-semibold text-aura-graphite">{areaAtual.titulo}</h1>
        <p className="text-sm text-aura-graphite-soft">{areaAtual.descricao}</p>
      </header>

      {/* Abas da área. Com uma aba só, a fileira não aparece. */}
      {abasDaArea.length > 1 && (
        <div className="mb-2 overflow-x-auto border-b border-aura-mist">
          <nav className="flex gap-1" aria-label={`Abas de ${areaAtual.titulo}`}>
            {abasDaArea.map((item) => {
              const Icon = item.icon;
              const ativa = item.id === atual.id;
              return (
                <Link
                  key={item.id}
                  href={hrefDaAbaGestor(item.id)}
                  scroll={false}
                  aria-current={ativa ? "page" : undefined}
                  className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                    ativa
                      ? "border-aura-petrol-600 text-aura-graphite"
                      : "border-transparent text-aura-graphite-soft hover:border-aura-mist hover:text-aura-graphite"
                  }`}
                >
                  <Icon size={15} className={ativa ? "text-aura-petrol-600" : ""} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
      <p className="mb-6 text-xs text-aura-graphite-soft">{atual.descricao}</p>

      {atual.id === "aura" && (
        <div className="space-y-5">
          <JustificativasEquipe />
          <GestorPainelAura />
        </div>
      )}
      {atual.id === "escritorio" && <Escritorio />}
      {atual.id === "agentes-equipe" && <EquipeAgentes />}
      {atual.id === "propostas" && <PropostasAgentes />}
      {atual.id === "conhecimento" && <ConhecimentoAgentes />}
      {atual.id === "equipe" && <EquipeTab />}
      {atual.id === "movimentacao" && <MovimentacaoTab />}
      {atual.id === "atendimento" && <AtendimentoTab />}
      {atual.id === "funil" && <FunilTab />}
      {atual.id === "semanal" && <RelatorioSemanalTab />}
      {atual.id === "pontuacao" && <PontuacaoTab />}
      {atual.id === "aprendizado" && <AprendizadoCard />}
      {atual.id === "dashboard" && <DashboardTab />}
      {atual.id === "planilha" && <PlanilhaLeadsDashboard />}
      {atual.id === "leads-excluidos" && <LeadsExcluidosTab />}
      {atual.id === "usuarios" && <UsuariosTab />}
      {atual.id === "permissoes" && <PermissoesTab />}
      {atual.id === "instagram" && <InstagramTab />}
      {atual.id === "ranking" && <RankingConfigTab />}
      {atual.id === "avaliacoes" && <AvaliacoesTab />}
      {atual.id === "custo-ia" && <CustoIAPainel />}
      {atual.id === "saude" && souMestre && <SaudeSistema />}
      {atual.id === "aparencia" && souMestre && <AparenciaTab />}
      {atual.id === "configuracoes" && <ConfiguracoesTab />}
      {atual.id === "marketing" && <MarketingTab />}
    </div>
  );
}
