"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Filter, AlertCircle, Activity, Calendar, ListChecks, ArrowRight, CheckCircle2 } from "lucide-react";

import { PanelCard } from "@/components/panel-card";
import { MetaDoMesCard } from "@/components/meu-dia/meta-do-mes-card";
import { DnaScoreCard } from "@/components/meu-dia/dna-score-card";
import { RankingMiniCard } from "@/components/meu-dia/ranking-mini-card";
import { ConquistasCard } from "@/components/meu-dia/conquistas-card";
import { PopupMotivacional } from "@/components/popups/popup-motivacional";
import { TarefasInteligentes } from "@/components/tarefas/tarefas-inteligentes";
import { MinhaPlanilhaIndicadores } from "@/components/meu-dia/minha-planilha-indicadores";
import { AuraSupervisorPanel } from "@/components/aura-supervisor-panel";
import { AuraCoachPanel } from "@/components/aura-coach-panel";
import { CompromissoMensalBanner } from "@/components/meu-dia/compromisso-mensal-banner";
import { PedidosAvaliacaoCard } from "@/components/avaliacoes/pedidos-avaliacao-card";
import { BriefingDoDia } from "@/components/meu-dia/briefing-do-dia";

import { useAppData } from "@/lib/app-data-context";
import { AuraInsightCard } from "@/components/aura/aura-insight-card";
import { computeDnaScore } from "@/lib/compute-dna-score";
import { computeMissoesDoDia } from "@/lib/compute-missoes";
import { computeConquistas } from "@/lib/compute-conquistas";
import { listarCompromissos, type Compromisso } from "@/lib/supabase/compromissos";
import { carregarEquipe } from "@/lib/supabase/team";
import { buscarMetaDoMes, definirMetaDoMes } from "@/lib/supabase/metas";
import { listarNiveis, type NivelPerformance } from "@/lib/supabase/niveis";
import { listarMinhasPendenciasPosVenda, type PosVenda } from "@/lib/supabase/pos-venda";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Etapa } from "@/lib/types";
import { calcularPrioridadesComerciais, rotuloPrioridade } from "@/lib/aura-prioridades";

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

const ETAPAS: Etapa[] = [
  "Prospecção",
  "Apresentação",
  "Proposta",
  "Negociação",
  "Fechados",
];

const CORES_PIPELINE = [
  "bg-aura-petrol-700",
  "bg-aura-petrol-500",
  "bg-aura-gold",
  "bg-aura-mist",
  "bg-aura-graphite-soft/30",
];

const CORES_TIPO: Record<string, string> = {
  Visita: "bg-aura-petrol-500",
  Reunião: "bg-aura-petrol-700",
  "Follow-up": "bg-aura-gold",
  Ligação: "bg-aura-warning",
  Outro: "bg-aura-graphite-soft",
};

export default function MeuDiaPage() {
  const { oportunidades, atividades, vendas, relacionamentos } = useAppData();

  const [compromissosHoje, setCompromissosHoje] = useState<Compromisso[]>([]);
  const [posicaoRanking, setPosicaoRanking] = useState<number | null>(null);
  const [totalEquipe, setTotalEquipe] = useState(0);
  const [metaValor, setMetaValor] = useState<number | null>(null);
  const [niveis, setNiveis] = useState<NivelPerformance[]>([]);
  const [pendenciasPosVenda, setPendenciasPosVenda] = useState<PosVenda[]>([]);
  const [missoesHabilitadas, setMissoesHabilitadas] = useState(false);

  async function carregarExtras() {
    const agora = new Date();
    const hojeISO = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;

    const [listaCompromissos, equipe, meta, listaNiveis, pendencias] = await Promise.all([
      listarCompromissos(),
      carregarEquipe(),
      buscarMetaDoMes(),
      listarNiveis(),
      listarMinhasPendenciasPosVenda(),
    ]);

    if (listaCompromissos) {
      setCompromissosHoje(
        listaCompromissos.filter(
          (compromisso) => compromisso.data === hojeISO && !compromisso.concluido,
        ),
      );
    }

    if (equipe && equipe.length > 0) {
      const ordenado = [...equipe].sort((a, b) => b.vendasTotal - a.vendasTotal);
      const minhaPosicao = ordenado.findIndex((membro) => membro.souEu) + 1;
      setPosicaoRanking(minhaPosicao > 0 ? minhaPosicao : null);
      setTotalEquipe(ordenado.length);
    }

    setMetaValor(meta);
    if (listaNiveis) setNiveis(listaNiveis);
    setPendenciasPosVenda(pendencias);
  }

  useEffect(() => {
    void carregarExtras();
    setMissoesHabilitadas(localStorage.getItem("aura:missoes") === "true");
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const canal = supabase
      .channel("aura-meu-dia-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "compromissos" }, () => void carregarExtras())
      .on("postgres_changes", { event: "*", schema: "public", table: "metas" }, () => void carregarExtras())
      .on("postgres_changes", { event: "*", schema: "public", table: "niveis_performance" }, () => void carregarExtras())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => void carregarExtras())
      .on("postgres_changes", { event: "*", schema: "public", table: "vendas" }, () => void carregarExtras())
      .on("postgres_changes", { event: "*", schema: "public", table: "pos_vendas" }, () => void carregarExtras())
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
     
  }, []);

  const agora = new Date();
  const mesAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const vendasDoMes = vendas.filter((venda) => venda.data.startsWith(mesAtual));
  const totalVendasMes = vendasDoMes.reduce((soma, venda) => soma + venda.valor, 0);

  const pipelinePorEtapa = ETAPAS.map((etapa) => {
    const itens = oportunidades.filter((oportunidade) => oportunidade.etapa === etapa);
    return {
      etapa,
      valor: itens.reduce((soma, oportunidade) => soma + oportunidade.valor, 0),
      oportunidades: itens.length,
    };
  });

  const maiorValorPipeline = Math.max(...pipelinePorEtapa.map((etapa) => etapa.valor), 1);

  const precisamDeAtencao = relacionamentos
    .filter((relacionamento) => {
      const proximoContato = relacionamento.proximoContato.toLowerCase();
      return (
        relacionamento.temperatura === "esfriando" ||
        relacionamento.temperatura === "frio" ||
        proximoContato.includes("hoje") ||
        proximoContato.includes("atrasado")
      );
    })
    .sort((a, b) => {
      const prioridade = (relacionamento: typeof a) => {
        const proximoContato = relacionamento.proximoContato.toLowerCase();
        if (proximoContato.includes("atrasado")) return 0;
        if (relacionamento.temperatura === "frio") return 1;
        return 2;
      };
      return prioridade(a) - prioridade(b);
    })
    .slice(0, 6);

  const dnaResultado = computeDnaScore({ relacionamentos, oportunidades, atividades });
  const missoes = missoesHabilitadas
    ? computeMissoesDoDia({ relacionamentos, oportunidades, atividades })
    : [];
  const vendasTotal = vendas.reduce((soma, venda) => soma + venda.valor, 0);
  const conquistas = computeConquistas({
    vendas,
    oportunidades,
    atividades,
    metaValor,
    metaRealizado: totalVendasMes,
    posicaoRanking,
  });
  const prioridades = useMemo(
    () => calcularPrioridadesComerciais({ relacionamentos, oportunidades, atividades }),
    [relacionamentos, oportunidades, atividades],
  );

  async function definirMeta(valor: number): Promise<boolean> {
    const sucesso = await definirMetaDoMes(valor);
    if (sucesso) setMetaValor(valor);
    return sucesso;
  }

  return (
    <>
      <PopupMotivacional />

      <div className="grid items-start gap-6 pb-28 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <BriefingDoDia />

        <AuraInsightCard pagina="meu-dia" />

        <PedidosAvaliacaoCard />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetaDoMesCard valor={metaValor} atingido={totalVendasMes} onDefinir={definirMeta} />
          <DnaScoreCard
            score={dnaResultado.score}
            detalhes={dnaResultado.detalhes}
            recomendacao={dnaResultado.recomendacao}
            nivelAtual={
              dnaResultado.score >= 85
                ? "Excelente"
                : dnaResultado.score >= 60
                ? "Bom ritmo"
                : "Em desenvolvimento"
            }
          />
          <RankingMiniCard posicao={posicaoRanking} totalEquipe={totalEquipe} />
        </div>

        <section className="rounded-2xl bg-aura-navy-950 p-5 text-white" aria-labelledby="comecar-dia-titulo">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-aura-gold">Começar meu dia</p>
              <h1 id="comecar-dia-titulo" className="mt-1 font-display text-2xl font-semibold">Seu próximo resultado começa agora.</h1>
              <p className="mt-1 max-w-2xl text-sm text-white/65">A AURA organizou as ações com maior impacto usando seus retornos, oportunidades e relacionamentos reais.</p>
            </div>
            <Link href={prioridades[0]?.acaoHref ?? "/registrar-atividade"} className="inline-flex items-center gap-2 rounded-xl bg-aura-gold px-4 py-2.5 text-sm font-semibold text-aura-navy-950 hover:bg-aura-gold-soft">
              {prioridades[0]?.acaoLabel ?? "Registrar primeira atividade"} <ArrowRight size={15} />
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
            {prioridades.slice(0, 4).map((prioridade) => (
              <Link key={prioridade.id} href={prioridade.acaoHref} className="group rounded-xl border border-white/10 bg-white/5 p-3 transition hover:bg-white/10">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-aura-gold" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-aura-gold">{rotuloPrioridade(prioridade.nivel)}</span>
                      <p className="truncate text-sm font-medium text-white">{prioridade.titulo}</p>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-white/60">{prioridade.descricao}</p>
                  </div>
                  <ArrowRight size={15} className="mt-1 shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white" />
                </div>
              </Link>
            ))}
            {prioridades.length === 0 && <p className="rounded-xl bg-white/5 p-3 text-sm text-white/65">Nenhuma prioridade crítica identificada. Continue registrando os próximos passos.</p>}
          </div>
        </section>

        <CompromissoMensalBanner />

        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <TarefasInteligentes />
        </div>

        <AuraSupervisorPanel />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PanelCard icon={Calendar} titulo="Agenda de Hoje" acaoLabel="Ver agenda" acaoHref="/agenda">
            {compromissosHoje.length === 0 ? (
              <p className="py-4 text-center text-sm text-aura-graphite-soft">Nenhum compromisso agendado para hoje.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-aura-mist">
                {[...compromissosHoje]
                  .sort((a, b) => (a.hora ?? "99:99").localeCompare(b.hora ?? "99:99"))
                  .map((compromisso) => (
                    <li key={compromisso.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="w-12 shrink-0 pt-0.5 font-data text-xs text-aura-graphite-soft">{compromisso.hora ?? "—"}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-aura-graphite">{compromisso.titulo}</p>
                        {(compromisso.relacionamentoNome || compromisso.subtitulo) && (
                          <p className="text-xs text-aura-graphite-soft">
                            {compromisso.relacionamentoNome}
                            {compromisso.relacionamentoNome && compromisso.subtitulo && " · "}
                            {compromisso.subtitulo}
                          </p>
                        )}
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-xs text-aura-graphite-soft">
                        <span className={`h-1.5 w-1.5 rounded-full ${CORES_TIPO[compromisso.tipo] ?? CORES_TIPO.Outro}`} />
                        {compromisso.tipo}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </PanelCard>

          <PanelCard icon={Filter} titulo="Pipeline por etapa" acaoLabel="Ver pipeline" acaoHref="/pipeline">
            {oportunidades.length === 0 ? (
              <p className="py-4 text-center text-sm text-aura-graphite-soft">Nenhuma oportunidade cadastrada ainda.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {pipelinePorEtapa.map((etapa, index) => (
                  <li key={etapa.etapa}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-aura-graphite">{etapa.etapa}</span>
                      <span className="font-data font-medium text-aura-graphite">{formatarMoeda(etapa.valor)}</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-aura-bg">
                      <div className={`h-full rounded-full ${CORES_PIPELINE[index]}`} style={{ width: `${(etapa.valor / maiorValorPipeline) * 100}%` }} />
                    </div>
                    <p className="mt-0.5 text-xs text-aura-graphite-soft">{etapa.oportunidades} oportunidades</p>
                  </li>
                ))}
              </ul>
            )}
          </PanelCard>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <PanelCard
            icon={AlertCircle}
            iconColor="text-aura-warning"
            titulo="Follow-ups Pendentes"
            acaoLabel="Ver relacionamentos"
            acaoHref="/relacionamentos"
            badge={precisamDeAtencao.length > 0 ? <span className="rounded-full bg-aura-danger/10 px-1.5 py-0.5 text-[0.65rem] font-semibold text-aura-danger">{precisamDeAtencao.length}</span> : undefined}
          >
            {precisamDeAtencao.length === 0 ? (
              <p className="py-4 text-center text-sm text-aura-graphite-soft">Nada urgente por aqui. Bom trabalho!</p>
            ) : (
              <ul className="flex flex-col divide-y divide-aura-mist">
                {precisamDeAtencao.map((relacionamento) => (
                  <li key={relacionamento.id}>
                    <Link href={`/relacionamentos?buscar=${encodeURIComponent(relacionamento.nome)}`} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0 hover:opacity-70">
                      <div>
                        <p className="text-sm font-medium text-aura-graphite">{relacionamento.nome}</p>
                        <p className="text-xs text-aura-graphite-soft">{relacionamento.categoria}</p>
                      </div>
                      <span className={`shrink-0 text-xs font-medium ${relacionamento.proximoContato.toLowerCase().includes("atrasado") ? "text-aura-danger" : "text-aura-graphite-soft"}`}>{relacionamento.proximoContato}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </PanelCard>

          {missoesHabilitadas ? <PanelCard icon={ListChecks} titulo="Missões do Dia">
            <ul className="flex flex-col divide-y divide-aura-mist">
              {missoes.map((missao) => (
                <li key={missao.titulo} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${missao.concluida ? "text-aura-success" : "text-aura-graphite"}`}>{missao.titulo}</p>
                    <div className="mt-1 h-1.5 w-full max-w-[8rem] overflow-hidden rounded-full bg-aura-mist">
                      <div className={`h-full rounded-full ${missao.concluida ? "bg-aura-success" : "bg-aura-petrol-500"}`} style={{ width: `${Math.min(100, (missao.progresso / missao.meta) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="font-data text-xs text-aura-graphite-soft">{missao.progresso}/{missao.meta}</span>
                </li>
              ))}
            </ul>
          </PanelCard> : null}

          <PanelCard icon={Activity} titulo="Atividades Recentes" acaoLabel="Ver todas atividades" acaoHref="/atividades">
            {atividades.length === 0 ? (
              <p className="py-4 text-center text-sm text-aura-graphite-soft">Nenhuma atividade registrada ainda. Que tal começar agora?</p>
            ) : (
              <ul className="flex flex-col divide-y divide-aura-mist">
                {atividades.slice(0, 5).map((atividade) => (
                  <li key={atividade.id}>
                    <Link href={`/relacionamentos?buscar=${encodeURIComponent(atividade.contexto)}`} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0 hover:opacity-70">
                      <div>
                        <p className="text-sm font-medium text-aura-graphite">{atividade.titulo}</p>
                        <p className="text-xs text-aura-graphite-soft">{atividade.contexto}</p>
                      </div>
                      <span className="shrink-0 text-xs text-aura-graphite-soft">{atividade.quando}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </PanelCard>
        </div>

        <ConquistasCard conquistas={conquistas} niveis={niveis} vendasTotal={vendasTotal} />

        {pendenciasPosVenda.length > 0 && (
          <div className="rounded-2xl border border-aura-danger/30 bg-aura-danger/5 p-5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-aura-graphite">
              <AlertCircle size={15} className="text-aura-danger" />
              Pós-venda das suas vendas precisa de atenção
            </p>
            <ul className="mt-2 flex flex-col divide-y divide-aura-danger/10">
              {pendenciasPosVenda.map((posVenda) => (
                <li key={posVenda.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-aura-graphite">{posVenda.cliente}</p>
                    <p className="text-xs text-aura-graphite-soft">{posVenda.produto}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-aura-danger">
                    {posVenda.reclamacao?.trim() && !posVenda.reclamacaoResolvida ? "Reclamação em aberto" : "Instalação atrasada"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-aura-graphite-soft">Fale com o time de Pós-venda se puder ajudar a resolver mais rápido.</p>
          </div>
        )}

        <MinhaPlanilhaIndicadores />
      </div>
      <AuraCoachPanel />
      </div>
    </>
  );
}
