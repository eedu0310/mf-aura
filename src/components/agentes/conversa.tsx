"use client";

/**
 * "Mural da equipe": as falas do escritório como um chat de time — quem
 * falou, para quem (o mural é "todos"; sem destinatário vai para a Diretora),
 * o tipo da fala, o texto e a hora. Mais nova em cima, com filtro por tipo e
 * por agente. Quem atualiza é o escritório (a cada 20 s, com a aba visível).
 *
 * O gestor também aparece aqui: as ideias que ele manda para a Diretora (e
 * a resposta dela) vêm como falas de "gestor:<id>", com o nome da pessoa e
 * um ícone de gente no lugar do ícone de agente.
 */
import { useMemo, useState } from "react";
import { ArrowRight, MessagesSquare, UserRound } from "lucide-react";
import type { FalaEscritorio, MesaAgente } from "@/lib/agentes/tipos";
import { Card, CardHeader, EstadoVazio, Segmentado, Selo } from "@/components/ui";
import { gestorDaFala } from "@/lib/agentes/util";
import { AvatarAgente, Esqueleto, TIPOS_FALA, haQuanto } from "./comum";

type FiltroTipo = "todos" | FalaEscritorio["tipo"];

export function ConversaEquipe({
  falas,
  mesas,
  carregando,
  equipeAtiva,
  aoAbrirAgente,
}: {
  falas: FalaEscritorio[];
  mesas: MesaAgente[];
  carregando: boolean;
  equipeAtiva: boolean;
  aoAbrirAgente: (id: string) => void;
}) {
  const [tipo, setTipo] = useState<FiltroTipo>("todos");
  const [agente, setAgente] = useState<string>("");

  const iconePorId = useMemo(() => new Map(mesas.map((m) => [m.id, m.icone])), [mesas]);

  const ordenadas = useMemo(() => [...falas].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)), [falas]);
  const visiveis = ordenadas.filter(
    (f) => (tipo === "todos" || f.tipo === tipo) && (!agente || f.de === agente || f.para === agente),
  );

  // Só oferece no filtro os tipos que apareceram (menos botão sem efeito).
  const contagem = new Map<string, number>();
  for (const f of falas) contagem.set(f.tipo, (contagem.get(f.tipo) ?? 0) + 1);
  const opcoesTipo: Array<{ valor: FiltroTipo; rotulo: string; contagem?: number }> = [
    { valor: "todos", rotulo: "Tudo" },
    ...(Object.keys(TIPOS_FALA) as Array<FalaEscritorio["tipo"]>)
      .filter((t) => contagem.has(t) || t === tipo)
      .map((t) => ({ valor: t, rotulo: TIPOS_FALA[t].rotulo, contagem: contagem.get(t) ?? 0 })),
  ];

  const quemFalou = useMemo(() => {
    const ids = new Set(falas.flatMap((f) => [f.de, typeof f.para === "string" && f.para !== "todos" ? f.para : ""]));
    return mesas.filter((m) => ids.has(m.id)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [falas, mesas]);

  return (
    <Card className="flex flex-col lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
      <CardHeader
        icone={MessagesSquare}
        titulo="Mural da equipe"
        descricao={equipeAtiva ? "Atualiza sozinha a cada 20 segundos" : "Começa quando a equipe for ativada"}
        acoes={
          equipeAtiva ? (
            <span className="relative inline-flex h-2 w-2" title="Ao vivo" aria-label="Ao vivo" role="img">
              <span className="absolute inline-flex h-full w-full rounded-full bg-aura-success opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-aura-success" />
            </span>
          ) : undefined
        }
      />

      {falas.length > 0 && (
        <div className="mb-3 space-y-2">
          <Segmentado opcoes={opcoesTipo} valor={tipo} aoMudar={setTipo} rotulo="Filtrar por tipo de fala" className="w-full" />
          {quemFalou.length > 1 && (
            <select
              value={agente}
              onChange={(e) => setAgente(e.target.value)}
              className="aura-input !h-8 text-xs"
              aria-label="Filtrar por agente"
            >
              <option value="">Todos os agentes</option>
              {quemFalou.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {carregando && falas.length === 0 ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-2.5">
                <Esqueleto className="h-7 w-7 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Esqueleto className="h-3 w-1/2" />
                  <Esqueleto className="h-10 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : visiveis.length === 0 ? (
          <EstadoVazio
            icone={MessagesSquare}
            titulo={falas.length === 0 ? "Ninguém falou ainda" : "Nada com esse filtro"}
            descricao={
              falas.length === 0
                ? equipeAtiva
                  ? "Os relatos, pedidos e ideias dos agentes aparecem aqui conforme eles trabalham."
                  : "Quando a equipe estiver ativa, os agentes conversam entre si aqui."
                : "Tente outro tipo ou outro agente."
            }
            className="py-8"
          />
        ) : (
          <ol className="space-y-1" aria-live="polite" aria-relevant="additions">
            {visiveis.map((f) => (
              <Fala key={f.id} fala={f} icone={iconePorId.get(f.de)} aoAbrirAgente={aoAbrirAgente} />
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
}

function Fala({
  fala,
  icone,
  aoAbrirAgente,
}: {
  fala: FalaEscritorio;
  icone: string | undefined;
  aoAbrirAgente: (id: string) => void;
}) {
  const t = TIPOS_FALA[fala.tipo] ?? TIPOS_FALA.relato;
  const destino = fala.para === "todos" ? "Mural" : fala.para === null ? "Diretora" : fala.paraNome ?? fala.para;
  return (
    <li className="flex gap-2.5 rounded-lg px-1.5 py-2 transition hover:bg-aura-sunken/60">
      {gestorDaFala(fala.de) ? (
        // Uma pessoa (o gestor), não um agente: não tem ficha para abrir.
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-aura-petrol-500/25 bg-aura-petrol-500/10 text-aura-petrol-600"
          title="Gestor"
          aria-hidden
        >
          <UserRound size={14} />
        </span>
      ) : (
        <button type="button" onClick={() => aoAbrirAgente(fala.de)} className="shrink-0 rounded-md" aria-label={`Abrir ${fala.deNome}`}>
          <AvatarAgente icone={icone} tamanho="sm" destaque={fala.tipo === "plano"} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
          <span className="font-medium text-aura-graphite">{fala.deNome}</span>
          <ArrowRight size={11} className="text-aura-graphite-soft" aria-label="para" />
          <span className="text-aura-graphite-soft">{destino}</span>
          <Selo tom={t.tom} className="!px-1.5 !py-0 text-[0.625rem]">
            {t.rotulo}
          </Selo>
          <time className="ml-auto shrink-0 text-[0.6875rem] text-aura-graphite-soft" dateTime={fala.criadoEm}>
            {haQuanto(fala.criadoEm)}
          </time>
        </div>
        <p className="mt-0.5 whitespace-pre-line break-words text-[0.8125rem] leading-relaxed text-aura-graphite">{fala.texto}</p>
      </div>
    </li>
  );
}
