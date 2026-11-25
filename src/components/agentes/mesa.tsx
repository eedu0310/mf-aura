"use client";

/**
 * Mesa de um agente na planta do escritório: avatar, nome e cargo, a luz de
 * status, um balão com o que ele está fazendo, quando rodou e quando roda de
 * novo, e os contadores de achados. Clicar abre a ficha (gaveta).
 */
import { CheckCircle2, CircleDot, Clock } from "lucide-react";
import type { MesaAgente } from "@/lib/agentes/tipos";
import { AvatarAgente, ESTADOS, LuzStatus, cx, haQuanto, numero, quandoVai } from "./comum";

export function Mesa({ mesa, aoAbrir }: { mesa: MesaAgente; aoAbrir: (id: string) => void }) {
  const parado = mesa.estado === "desligado" || mesa.estado === "aguardando_ativacao";
  const trabalhando = mesa.estado === "trabalhando";
  const balao =
    mesa.estado === "aguardando_ativacao"
      ? "Aguardando ativação."
      : mesa.estado === "desligado"
        ? "Desligado pelo gestor."
        : mesa.fazendoAgora || "Esperando a próxima rodada.";

  return (
    <button
      type="button"
      onClick={() => aoAbrir(mesa.id)}
      className={cx(
        "group flex w-full flex-col gap-3 rounded-xl border bg-aura-surface p-3.5 text-left transition",
        "hover:border-aura-petrol-500/40 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aura-petrol-500",
        parado ? "border-dashed border-aura-mist" : "border-aura-mist",
        trabalhando && "border-aura-success/35",
        mesa.estado === "com_erro" && "border-aura-danger/35",
      )}
      aria-label={`${mesa.nome}, ${mesa.cargo}. ${ESTADOS[mesa.estado]?.rotulo ?? ""}. Abrir ficha.`}
    >
      <div className="flex items-start gap-2.5">
        <AvatarAgente icone={mesa.icone} apagado={parado} />
        <div className="min-w-0 flex-1">
          <p className={cx("truncate text-sm font-medium", parado ? "text-aura-graphite-soft" : "text-aura-graphite")}>{mesa.nome}</p>
          <p className="truncate text-xs text-aura-graphite-soft">{mesa.cargo}</p>
        </div>
        <LuzStatus estado={mesa.estado} className="mt-1" />
      </div>

      {/* Balão de fala: o que está fazendo agora (ou fez por último). */}
      <div
        className={cx(
          "relative rounded-lg px-2.5 py-2 text-xs leading-relaxed",
          "before:absolute before:-top-1 before:left-4 before:h-2 before:w-2 before:rotate-45 before:content-['']",
          trabalhando
            ? "bg-aura-success/8 text-aura-graphite before:bg-aura-success/8"
            : "bg-aura-sunken text-aura-graphite-soft before:bg-aura-sunken",
        )}
      >
        <span className="line-clamp-2">{balao}</span>
        {trabalhando && (
          <span className="mt-1 flex gap-0.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1 w-1 rounded-full bg-aura-success/70 motion-safe:animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-aura-graphite-soft">
        <span className="inline-flex items-center gap-1" title="Última rodada">
          <Clock size={11} aria-hidden />
          {mesa.ultimaExecucao ? haQuanto(mesa.ultimaExecucao.fim ?? mesa.ultimaExecucao.inicio) : "nunca rodou"}
        </span>
        {!parado && mesa.proximaExecucao && <span title="Próxima rodada">próx. {quandoVai(mesa.proximaExecucao)}</span>}
        <span className="ml-auto inline-flex items-center gap-2.5">
          <span
            className={cx("inline-flex items-center gap-1 tabular-nums", mesa.achadosAbertos > 0 && "text-aura-gold-700")}
            title="Achados abertos"
          >
            <CircleDot size={11} aria-hidden />
            {numero(mesa.achadosAbertos)}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums" title="Resolvidos em 30 dias">
            <CheckCircle2 size={11} aria-hidden />
            {numero(mesa.achadosResolvidos30d)}
          </span>
        </span>
      </div>
    </button>
  );
}
