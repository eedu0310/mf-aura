"use client";

import { useState } from "react";
import { BellRing, CheckCircle2, ChevronDown } from "lucide-react";
import type { PosVenda } from "@/lib/supabase/pos-venda";
import { Botao, Selo } from "@/components/ui";
import { motivoDeAtencao, type Motivo } from "./regras";

const PRIORIDADE: Record<Motivo["chave"], number> = {
  atrasada: 0,
  reclamacao: 1,
  pendente: 2,
  sem_agendar: 3,
  sem_avaliacao: 4,
};

const ROTULO_GRUPO: Record<Motivo["chave"], string> = {
  atrasada: "atrasadas",
  reclamacao: "reclamações",
  pendente: "pendentes",
  sem_agendar: "sem agendar",
  sem_avaliacao: "sem avaliação",
};

const COR_PONTO: Record<Motivo["tom"], string> = {
  perigo: "bg-aura-danger",
  atencao: "bg-aura-warning",
  marca: "bg-aura-petrol-500",
};

/** Quantas linhas aparecem antes do "Ver todas". */
const LIMITE = 6;

/**
 * "Atenção agora": o que alguém precisa resolver hoje, do mais urgente para o
 * menos — instalação atrasada, reclamação aberta, instalação pendente, venda
 * parada sem agendamento e concluída sem pedido de avaliação. Cada linha abre
 * o pós-venda direto. Sem nada pendente, vira uma linha só.
 */
export function PosVendaAtencao({
  itens,
  hoje,
  mostrarLoja,
  aoAbrir,
}: {
  itens: PosVenda[];
  hoje: string;
  mostrarLoja: boolean;
  aoAbrir: (item: PosVenda) => void;
}) {
  const [aberto, setAberto] = useState(true);
  const [verTodas, setVerTodas] = useState(false);

  const pendencias = itens
    .map((item) => ({ item, motivo: motivoDeAtencao(item, hoje) }))
    .filter((p): p is { item: PosVenda; motivo: Motivo } => p.motivo !== null)
    .sort((a, b) => PRIORIDADE[a.motivo.chave] - PRIORIDADE[b.motivo.chave]);

  if (pendencias.length === 0) {
    return (
      <div className="aura-card flex items-center gap-3 px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-aura-success/10">
          <CheckCircle2 size={15} className="text-aura-success" />
        </span>
        <p className="text-sm text-aura-graphite">
          Tudo em dia: <span className="text-aura-graphite-soft">nenhuma instalação atrasada, reclamação aberta ou avaliação por pedir.</span>
        </p>
      </div>
    );
  }

  const contagem = new Map<Motivo["chave"], number>();
  for (const p of pendencias) contagem.set(p.motivo.chave, (contagem.get(p.motivo.chave) ?? 0) + 1);
  const urgentes = (contagem.get("atrasada") ?? 0) + (contagem.get("reclamacao") ?? 0);
  const visiveis = verTodas ? pendencias : pendencias.slice(0, LIMITE);

  return (
    <section className="aura-card overflow-hidden" aria-labelledby="pv-atencao-titulo">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls="pv-atencao-lista"
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-aura-sunken/50"
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${urgentes > 0 ? "bg-aura-danger/10" : "bg-aura-warning/12"}`}
        >
          <BellRing size={16} className={urgentes > 0 ? "text-aura-danger" : "text-aura-warning"} />
        </span>
        <span className="min-w-0 flex-1">
          <span id="pv-atencao-titulo" className="block text-sm font-semibold text-aura-graphite">
            Atenção agora
            <span className="ml-1.5 font-normal tabular-nums text-aura-graphite-soft">{pendencias.length}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-aura-graphite-soft">
            {[...contagem.entries()]
              .sort((a, b) => PRIORIDADE[a[0]] - PRIORIDADE[b[0]])
              .map(([chave, n]) => `${n} ${ROTULO_GRUPO[chave]}`)
              .join(" · ")}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-aura-graphite-soft transition-transform ${aberto ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {aberto && (
        <div id="pv-atencao-lista" className="border-t border-aura-mist">
          <ul className="divide-y divide-aura-mist">
            {visiveis.map(({ item, motivo }) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${COR_PONTO[motivo.tom]}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-aura-graphite">{item.cliente}</p>
                  <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                    <span className={motivo.tom === "perigo" ? "text-aura-danger" : "text-aura-graphite-soft"}>
                      {motivo.texto}
                    </span>
                    {mostrarLoja && <Selo>{item.empresa}</Selo>}
                  </p>
                </div>
                <Botao
                  tamanho="sm"
                  variante={motivo.tom === "perigo" ? "secundario" : "fantasma"}
                  onClick={() => aoAbrir(item)}
                  aria-label={`${motivo.acao}: ${item.cliente}`}
                >
                  {motivo.acao}
                </Botao>
              </li>
            ))}
          </ul>
          {pendencias.length > LIMITE && (
            <button
              type="button"
              onClick={() => setVerTodas((v) => !v)}
              className="w-full border-t border-aura-mist px-4 py-2 text-center text-xs font-medium text-aura-petrol-600 hover:bg-aura-sunken/50"
            >
              {verTodas ? "Mostrar menos" : `Ver todas as ${pendencias.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
