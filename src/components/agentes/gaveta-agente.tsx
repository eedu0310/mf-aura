"use client";

/**
 * Ficha do agente, aberta ao clicar na mesa: missão, agenda, última rodada,
 * o que ele disse no escritório, gasto x orçamento e (só para o gestor
 * mestre) ligar/desligar, mudar orçamento e mandar rodar agora.
 */
import { CalendarClock, CheckCircle2, CircleAlert, Loader2, MessagesSquare, Target, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import type { FalaEscritorio, MesaAgente } from "@/lib/agentes/tipos";
import { EstadoVazio, Selo } from "@/components/ui";
import {
  AvatarAgente,
  BarraOrcamento,
  CRIADO_POR,
  ESTADOS,
  Gaveta,
  LuzStatus,
  TIPOS_AGENTE,
  TIPOS_FALA,
  dataHora,
  dolar,
  haQuanto,
  numero,
  quandoVai,
  rotuloSetor,
} from "./comum";
import { BotaoRodar, ChaveAtivo, EditorOrcamento } from "./controles";

function Bloco({ titulo, icone, children }: { titulo: string; icone?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-aura-mist pb-5 last:border-b-0 last:pb-0">
      <h3 className="aura-rotulo mb-2 flex items-center gap-1.5">
        {icone}
        {titulo}
      </h3>
      {children}
    </section>
  );
}

export function GavetaAgente({
  mesa,
  falas,
  equipeAtiva,
  souMestre,
  aoFechar,
  aoMudar,
}: {
  mesa: MesaAgente | null;
  falas: FalaEscritorio[];
  equipeAtiva: boolean;
  souMestre: boolean;
  aoFechar: () => void;
  aoMudar: () => void | Promise<void>;
}) {
  if (!mesa) return null;
  const doAgente = falas
    .filter((f) => f.de === mesa.id || f.para === mesa.id)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    .slice(0, 8);
  const exec = mesa.ultimaExecucao;
  const estado = ESTADOS[mesa.estado] ?? ESTADOS.ocioso;

  return (
    <Gaveta
      aberto
      aoFechar={aoFechar}
      titulo={mesa.nome}
      subtitulo={`${mesa.cargo} · ${rotuloSetor(mesa.setor)}`}
      icone={<AvatarAgente icone={mesa.icone} destaque={mesa.setor === "direcao"} apagado={!mesa.ativo} />}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Selo tom={estado.tom}>
            <LuzStatus estado={mesa.estado} className="!h-2 !w-2" />
            {estado.rotulo}
          </Selo>
          <Selo>{TIPOS_AGENTE[mesa.tipo] ?? mesa.tipo}</Selo>
          <Selo>Criado por: {CRIADO_POR[mesa.criadoPor] ?? mesa.criadoPor}</Selo>
        </div>

        {mesa.fazendoAgora && (
          <p className="rounded-lg bg-aura-sunken px-3 py-2.5 text-sm leading-relaxed text-aura-graphite">{mesa.fazendoAgora}</p>
        )}

        {souMestre && (
          <Bloco titulo="Comando">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-aura-graphite">
                <ChaveAtivo mesa={mesa} habilitado={equipeAtiva} aoMudar={aoMudar} />
                {mesa.ativo ? "Ligado" : "Desligado"}
              </label>
              <BotaoRodar mesa={mesa} habilitado={equipeAtiva && mesa.ativo} aoMudar={aoMudar} />
            </div>
            {!equipeAtiva && (
              <p className="mt-2 text-xs text-aura-graphite-soft">Os comandos liberam quando a equipe for ativada.</p>
            )}
          </Bloco>
        )}

        <Bloco titulo="Missão" icone={<Target size={12} />}>
          <p className="text-sm leading-relaxed text-aura-graphite">{mesa.missao || "—"}</p>
        </Bloco>

        <Bloco titulo="Agenda" icone={<CalendarClock size={12} />}>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-aura-graphite-soft">Quando roda</dt>
              <dd className="text-aura-graphite">{mesa.agendaTexto || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-aura-graphite-soft">Próxima rodada</dt>
              <dd className="text-aura-graphite">{mesa.ativo ? quandoVai(mesa.proximaExecucao) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-aura-graphite-soft">Achados abertos</dt>
              <dd className="tabular-nums text-aura-graphite">{numero(mesa.achadosAbertos)}</dd>
            </div>
            <div>
              <dt className="text-xs text-aura-graphite-soft">Resolvidos em 30 dias</dt>
              <dd className="tabular-nums text-aura-graphite">{numero(mesa.achadosResolvidos30d)}</dd>
            </div>
          </dl>
        </Bloco>

        <Bloco titulo="Última rodada">
          {exec ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-aura-mist p-3">
              {exec.status === "rodando" ? (
                <Loader2 size={15} className="mt-0.5 shrink-0 text-aura-success motion-safe:animate-spin" />
              ) : exec.status === "erro" ? (
                <CircleAlert size={15} className="mt-0.5 shrink-0 text-aura-danger" />
              ) : (
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-aura-success" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-aura-graphite">{exec.resumo || (exec.status === "rodando" ? "Rodando agora…" : "Sem resumo.")}</p>
                <p className="mt-1 text-xs text-aura-graphite-soft">
                  {dataHora(exec.inicio)}
                  {exec.fim && ` · terminou ${haQuanto(exec.fim)}`}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-aura-graphite-soft">Ainda não rodou.</p>
          )}
        </Bloco>

        <Bloco titulo="Gasto de IA" icone={<Wallet size={12} />}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="tabular-nums text-aura-graphite">{dolar(mesa.custo30dUsd)} <span className="text-xs text-aura-graphite-soft">nos últimos 30 dias</span></span>
            <span className="text-xs text-aura-graphite-soft">
              teto/mês <EditorOrcamento mesa={mesa} podeEditar={souMestre && equipeAtiva} aoMudar={aoMudar} />
            </span>
          </div>
          <BarraOrcamento gasto={mesa.custo30dUsd} orcamento={mesa.orcamentoMensalUsd} className="mt-2" />
        </Bloco>

        <Bloco titulo="No escritório" icone={<MessagesSquare size={12} />}>
          {doAgente.length === 0 ? (
            <EstadoVazio titulo="Nada dito ainda" descricao="Quando este agente falar com a equipe, aparece aqui." className="py-6" />
          ) : (
            <ul className="space-y-2.5">
              {doAgente.map((f) => {
                const t = TIPOS_FALA[f.tipo] ?? TIPOS_FALA.relato;
                const enviou = f.de === mesa.id;
                return (
                  <li key={f.id} className="rounded-lg border border-aura-mist p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs text-aura-graphite-soft">
                      <Selo tom={t.tom}>{t.rotulo}</Selo>
                      <span>
                        {enviou ? `para ${f.para === "todos" ? "o mural" : f.paraNome ?? "a Diretora"}` : `de ${f.deNome}`}
                      </span>
                      <span className="ml-auto">{haQuanto(f.criadoEm)}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-aura-graphite">{f.texto}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </Bloco>
      </div>
    </Gaveta>
  );
}
