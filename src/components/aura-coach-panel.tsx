"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  CheckSquare,
  Square,
  LineChart as LineChartIcon,
  CalendarDays,
  ClipboardCheck,
  KanbanSquare,
  BarChart3,
} from "lucide-react";
import { EvolutionMiniChart } from "@/components/charts/evolution-mini-chart";
import { useUserProfile } from "@/lib/user-profile-context";
import { useAppData } from "@/lib/app-data-context";
import { computePendingTasks } from "@/lib/compute-pending-tasks";
import { computeSalesEvolution } from "@/lib/compute-sales-evolution";
import { calcularPrioridadesComerciais, rotuloPrioridade } from "@/lib/aura-prioridades";
import { analisarPorQueNaoVendo } from "@/lib/por-que-nao-vendo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

export function AuraCoachPanel() {
  const { profile } = useUserProfile();
  const { oportunidades, relacionamentos, vendas, atividades, funil } = useAppData();
  const [concluidas, setConcluidas] = useState<Set<string>>(new Set());
  const [recomendacoes, setRecomendacoes] = useState<Array<{ id: string; titulo: string; descricao: string; prioridade: string }>>([]);

  const tarefas = computePendingTasks(relacionamentos);
  const evolucao = computeSalesEvolution(vendas);
  const totalVendidoMes = evolucao.length > 0 ? evolucao[evolucao.length - 1].valor : 0;
  const prioridades = calcularPrioridadesComerciais({ relacionamentos, oportunidades, atividades, funil });
  const analiseVendas = useMemo(
    () => analisarPorQueNaoVendo({ relacionamentos, oportunidades, vendas, atividades, funil }),
    [relacionamentos, oportunidades, vendas, atividades],
  );

  useEffect(() => {
    let ativo = true;
    const supabase = getSupabaseBrowserClient();
    const carregarRecomendacoes = async () => {
      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      const headers: HeadersInit = data.session?.access_token
        ? { Authorization: `Bearer ${data.session.access_token}` }
        : {};
      return fetch("/api/aura/supervisao", { cache: "no-store", headers });
    };
    carregarRecomendacoes()
      .then(async (resposta) => (resposta.ok ? (await resposta.json()) as { recomendacoes?: typeof recomendacoes } : { recomendacoes: [] }))
      .then((dados) => {
        if (ativo) setRecomendacoes(dados.recomendacoes ?? []);
      })
      .catch(() => {
        if (ativo) setRecomendacoes([]);
      });
    return () => {
      ativo = false;
    };
  }, []);

  function alternarTarefa(id: string) {
    setConcluidas((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  return (
    <aside
      data-imprimir="esconder"
      className="order-first flex w-full flex-col gap-5 xl:order-none xl:w-80 xl:shrink-0"
    >
      {/* AURA Coach */}
      <div className="rounded-2xl bg-aura-navy-950 p-5">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-aura-gold" />
          <p className="font-display text-sm font-semibold text-white">AURA Coach</p>
          <span className="ml-auto rounded-full bg-aura-gold/15 px-2 py-0.5 text-[0.6rem] font-semibold tracking-wide text-aura-gold">
            ATIVA
          </span>
        </div>

        <p className="mt-4 text-sm text-white/70">
          {profile.nome.split(" ")[0]}, a AURA analisou seus dados reais e separou o próximo passo com maior impacto.
        </p>
        {prioridades.length > 0 ? (
          <div className="mt-3 space-y-2">
            {prioridades.slice(0, 3).map((prioridade) => (
              <Link key={prioridade.id} href={prioridade.acaoHref} className="block rounded-xl bg-white/10 p-3 text-xs leading-relaxed text-white/85 transition hover:bg-white/15">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-white">{prioridade.titulo}</p>
                  <span className="shrink-0 text-[0.6rem] font-semibold uppercase text-aura-gold">{rotuloPrioridade(prioridade.nivel)}</span>
                </div>
                <p className="mt-1 text-white/70">{prioridade.descricao}</p>
              </Link>
            ))}
          </div>
        ) : recomendacoes.length > 0 ? (
          <div className="mt-3 space-y-2">
            {recomendacoes.slice(0, 3).map((recomendacao) => (
              <div key={recomendacao.id} className="rounded-xl bg-white/10 p-3 text-xs leading-relaxed text-white/85">
                <p className="font-medium text-white">{recomendacao.titulo}</p>
                <p className="mt-1 text-white/70">{recomendacao.descricao}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-xl bg-white/5 p-3 text-xs leading-relaxed text-white/80">
            {oportunidades.length} oportunidades, {relacionamentos.length} relacionamentos e {vendas.length} vendas carregados do sistema. Converse com a AURA para uma análise detalhada.
          </div>
        )}

        <Link
          href="/aura-coach"
          className="mt-4 block w-full rounded-xl bg-aura-gold py-2.5 text-center text-sm font-medium text-aura-navy-950 transition hover:bg-aura-gold-soft"
        >
          Conversar com AURA
        </Link>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Link href="/registrar-atividade" className="flex flex-col items-center gap-1 rounded-lg bg-white/10 px-2 py-2 text-[0.65rem] text-white/80 hover:bg-white/15" title="Registrar atividade">
            <ClipboardCheck size={15} /> Registrar
          </Link>
          <Link href="/agenda" className="flex flex-col items-center gap-1 rounded-lg bg-white/10 px-2 py-2 text-[0.65rem] text-white/80 hover:bg-white/15" title="Abrir agenda">
            <CalendarDays size={15} /> Agenda
          </Link>
          <Link href="/pipeline" className="flex flex-col items-center gap-1 rounded-lg bg-white/10 px-2 py-2 text-[0.65rem] text-white/80 hover:bg-white/15" title="Abrir pipeline">
            <KanbanSquare size={15} /> Pipeline
          </Link>
        </div>
      </div>

      {/* Próximas Tarefas — derivadas do CRM real */}
      <div className="rounded-2xl border border-aura-mist bg-white p-5">
        <div className="flex items-center gap-2">
          <CheckSquare size={16} className="text-aura-petrol-600" />
          <p className="text-sm font-medium text-aura-graphite">Próximas Tarefas</p>
        </div>

        {tarefas.length === 0 ? (
          <p className="mt-3 text-xs text-aura-graphite-soft">
            Nenhuma tarefa pendente agora. Bom trabalho!
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2.5">
            {tarefas.map((tarefa) => {
              const feita = concluidas.has(tarefa.id);
              return (
                <li key={tarefa.id} className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => alternarTarefa(tarefa.id)}
                    aria-pressed={feita}
                    aria-label={feita ? "Marcar como pendente" : "Marcar como concluída"}
                    className="shrink-0 text-aura-graphite-soft hover:text-aura-petrol-600"
                  >
                    {feita ? (
                      <CheckSquare size={15} className="text-aura-success" />
                    ) : (
                      <Square size={15} />
                    )}
                  </button>
                  <p
                    className={`flex-1 text-xs ${
                      feita ? "text-aura-graphite-soft line-through" : "text-aura-graphite"
                    }`}
                  >
                    {tarefa.titulo}
                  </p>
                  <span
                    className={`shrink-0 text-[0.65rem] font-medium ${
                      tarefa.urgente ? "text-aura-danger" : "text-aura-graphite-soft"
                    }`}
                  >
                    {tarefa.quando}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <Link
          href="/relacionamentos"
          className="mt-3 inline-block text-xs font-medium text-aura-petrol-600 hover:underline"
        >
          Ver relacionamentos
        </Link>
      </div>

      <div className="rounded-2xl border border-aura-mist bg-white p-5">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-aura-petrol-600" />
          <p className="text-sm font-medium text-aura-graphite">Por que não estou vendendo?</p>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-aura-graphite-soft">Comparação dos últimos 30 dias com os 30 dias anteriores. A análise mostra sinais observáveis, não inventa motivos sobre os clientes.</p>
        <p className="mt-3 rounded-xl bg-aura-bg p-3 text-xs leading-relaxed text-aura-graphite">{analiseVendas.mensagem}</p>
        {analiseVendas.principal && (
          <div className="mt-3 rounded-xl border border-aura-warning/30 bg-aura-warning/5 p-3">
            <p className="text-xs font-semibold text-aura-graphite">Fator principal: {analiseVendas.principal.nome}</p>
            <p className="mt-1 text-xs text-aura-graphite-soft">{analiseVendas.principal.explicacao}</p>
            {analiseVendas.secundarios.length > 0 && (
              <div className="mt-2 border-t border-aura-warning/20 pt-2">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-aura-graphite-soft">Também merece atenção</p>
                {analiseVendas.secundarios.map((fator) => <p key={fator.nome} className="mt-1 text-xs text-aura-graphite-soft">• {fator.explicacao}</p>)}
              </div>
            )}
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-aura-bg p-2"><span className="block text-aura-graphite-soft">Período atual</span><b className="text-aura-graphite">{analiseVendas.atual.fechamentos} fechamentos · {formatarMoeda(analiseVendas.atual.valorVendido)}</b></div>
          <div className="rounded-lg bg-aura-bg p-2"><span className="block text-aura-graphite-soft">Período anterior</span><b className="text-aura-graphite">{analiseVendas.anterior.fechamentos} fechamentos · {formatarMoeda(analiseVendas.anterior.valorVendido)}</b></div>
        </div>
        <Link href="/relatorios" className="mt-3 inline-block text-xs font-medium text-aura-petrol-600 hover:underline">Ver relatórios completos</Link>
      </div>

      {/* Evolução de vendas real do mês */}
      <div className="rounded-2xl border border-aura-mist bg-white p-5">
        <div className="flex items-center gap-2">
          <LineChartIcon size={16} className="text-aura-petrol-600" />
          <p className="text-sm font-medium text-aura-graphite">Vendas do Mês</p>
        </div>

        {evolucao.length === 0 ? (
          <p className="mt-3 text-xs text-aura-graphite-soft">
            Nenhuma venda registrada neste mês ainda.
          </p>
        ) : (
          <>
            <div className="mt-3 text-xs text-aura-graphite-soft">
              Acumulado{" "}
              <span className="font-data font-medium text-aura-graphite">
                {formatarMoeda(totalVendidoMes)}
              </span>
            </div>
            <EvolutionMiniChart data={evolucao} />
          </>
        )}
      </div>
    </aside>
  );
}
