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
import { Selo, classeBotao } from "@/components/ui";

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

export function AuraCoachPanel() {
  const { profile } = useUserProfile();
  const { oportunidades, relacionamentos, vendas, atividades, funil, carregando } = useAppData();
  const [concluidas, setConcluidas] = useState<Set<string>>(new Set());
  const [recomendacoes, setRecomendacoes] = useState<Array<{ id: string; titulo: string; descricao: string; prioridade: string }>>([]);

  const tarefas = computePendingTasks(relacionamentos);
  const evolucao = computeSalesEvolution(vendas);
  const totalVendidoMes = evolucao.length > 0 ? evolucao[evolucao.length - 1].valor : 0;
  const prioridades = calcularPrioridadesComerciais({ relacionamentos, oportunidades, atividades, funil });
  const analiseVendas = useMemo(
    () => analisarPorQueNaoVendo({ relacionamentos, oportunidades, vendas, atividades, funil }),
    [relacionamentos, oportunidades, vendas, atividades, funil],
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
      <div className="aura-card p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-aura-gold/15 ring-1 ring-inset ring-aura-gold/25">
            <Sparkles size={16} className="text-aura-gold-700" />
          </span>
          <p className="font-display text-sm font-semibold text-aura-graphite">AURA Coach</p>
          <Selo tom="sucesso" className="ml-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-aura-success" aria-hidden />
            Ativa
          </Selo>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-aura-graphite-soft">
          {profile.nome.split(" ")[0]}, a AURA analisou seus dados reais e separou o próximo passo com maior impacto.
        </p>
        {prioridades.length > 0 ? (
          <div className="mt-3 space-y-2">
            {prioridades.slice(0, 3).map((prioridade) => (
              <Link key={prioridade.id} href={prioridade.acaoHref} className="block rounded-lg border border-aura-mist p-3 text-xs leading-relaxed transition hover:border-aura-petrol-500/40 hover:bg-aura-sunken">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-aura-graphite">{prioridade.titulo}</p>
                  <span className="shrink-0 text-[0.6rem] font-medium uppercase tracking-wide text-aura-gold-700">{rotuloPrioridade(prioridade.nivel)}</span>
                </div>
                <p className="mt-1 text-aura-graphite-soft">{prioridade.descricao}</p>
              </Link>
            ))}
          </div>
        ) : recomendacoes.length > 0 ? (
          <div className="mt-3 space-y-2">
            {recomendacoes.slice(0, 3).map((recomendacao) => (
              <div key={recomendacao.id} className="rounded-lg border border-aura-mist p-3 text-xs leading-relaxed">
                <p className="font-medium text-aura-graphite">{recomendacao.titulo}</p>
                <p className="mt-1 text-aura-graphite-soft">{recomendacao.descricao}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-lg bg-aura-sunken p-3 text-xs leading-relaxed text-aura-graphite-soft">
            {/* Enquanto os dados chegam, não mostrar "0 oportunidades" como se a carteira estivesse vazia. */}
            {carregando
              ? "Carregando seus dados…"
              : `${oportunidades.length} oportunidades, ${relacionamentos.length} relacionamentos e ${vendas.length} vendas carregados do sistema. Converse com a AURA para uma análise detalhada.`}
          </div>
        )}

        <Link
          href="/aura-coach"
          className={classeBotao("primario", "md", "mt-4 w-full")}
        >
          <Sparkles size={14} />
          Conversar com AURA
        </Link>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Link href="/registrar-atividade" className="flex flex-col items-center gap-1 rounded-lg border border-aura-mist px-2 py-2 text-[0.65rem] font-medium text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-graphite" title="Registrar atividade">
            <ClipboardCheck size={15} /> Registrar
          </Link>
          <Link href="/agenda" className="flex flex-col items-center gap-1 rounded-lg border border-aura-mist px-2 py-2 text-[0.65rem] font-medium text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-graphite" title="Abrir agenda">
            <CalendarDays size={15} /> Agenda
          </Link>
          <Link href="/pipeline" className="flex flex-col items-center gap-1 rounded-lg border border-aura-mist px-2 py-2 text-[0.65rem] font-medium text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-graphite" title="Abrir pipeline">
            <KanbanSquare size={15} /> Pipeline
          </Link>
        </div>
      </div>

      {/* Próximas Tarefas — derivadas do CRM real */}
      <div className="aura-card p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-aura-sunken">
            <CheckSquare size={15} className="text-aura-petrol-600" />
          </span>
          <p className="text-sm font-semibold text-aura-graphite">Próximas Tarefas</p>
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
          className="mt-4 inline-block text-xs font-medium text-aura-petrol-600 hover:underline"
        >
          Ver relacionamentos
        </Link>
      </div>

      <div className="aura-card p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-aura-sunken">
            <BarChart3 size={15} className="text-aura-petrol-600" />
          </span>
          <p className="text-sm font-semibold text-aura-graphite">Por que não estou vendendo?</p>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-aura-graphite-soft">Comparação dos últimos 30 dias com os 30 dias anteriores. A análise mostra sinais observáveis, não inventa motivos sobre os clientes.</p>
        <p className="mt-3 rounded-lg bg-aura-sunken p-3 text-xs leading-relaxed text-aura-graphite">{analiseVendas.mensagem}</p>
        {analiseVendas.principal && (
          <div className="mt-3 rounded-lg border border-aura-mist border-l-2 border-l-aura-warning p-3">
            <p className="text-xs font-semibold text-aura-graphite">Fator principal: {analiseVendas.principal.nome}</p>
            <p className="mt-1 text-xs text-aura-graphite-soft">{analiseVendas.principal.explicacao}</p>
            {analiseVendas.secundarios.length > 0 && (
              <div className="mt-2 border-t border-aura-mist pt-2">
                <p className="aura-rotulo">Também merece atenção</p>
                {analiseVendas.secundarios.map((fator) => <p key={fator.nome} className="mt-1 text-xs text-aura-graphite-soft">• {fator.explicacao}</p>)}
              </div>
            )}
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-aura-mist p-2.5"><span className="aura-rotulo block">Período atual</span><span className="mt-1 block font-semibold tabular-nums text-aura-graphite">{analiseVendas.atual.fechamentos} fechamentos · {formatarMoeda(analiseVendas.atual.valorVendido)}</span></div>
          <div className="rounded-lg border border-aura-mist p-2.5"><span className="aura-rotulo block">Período anterior</span><span className="mt-1 block font-semibold tabular-nums text-aura-graphite">{analiseVendas.anterior.fechamentos} fechamentos · {formatarMoeda(analiseVendas.anterior.valorVendido)}</span></div>
        </div>
        <Link href="/relatorios" className="mt-4 inline-block text-xs font-medium text-aura-petrol-600 hover:underline">Ver relatórios completos</Link>
      </div>

      {/* Evolução de vendas real do mês */}
      <div className="aura-card p-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-aura-sunken">
            <LineChartIcon size={15} className="text-aura-petrol-600" />
          </span>
          <p className="text-sm font-semibold text-aura-graphite">Vendas do Mês</p>
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
