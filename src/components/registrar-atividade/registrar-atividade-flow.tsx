"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { BotaoLink, classeBotao } from "@/components/ui";
import { TIPOS_ATIVIDADE, type ActivityTypeId } from "./activity-types";
import { VisitaForm } from "./visita-form";
import { VendaForm } from "./venda-form";
import { ReuniaoForm } from "./reuniao-form";
import { GenericActivityForm } from "./generic-activity-form";

type Etapa = "tipo" | "form" | "concluido";

export function RegistrarAtividadeFlow() {
  const [etapa, setEtapa] = useState<Etapa>("tipo");
  const [tipoSelecionado, setTipoSelecionado] = useState<ActivityTypeId | null>(null);

  function selecionarTipo(id: ActivityTypeId) {
    setTipoSelecionado(id);
    setEtapa("form");
  }

  function concluirAtividade() {
    setEtapa("concluido");
  }

  function registrarOutra() {
    setTipoSelecionado(null);
    setEtapa("tipo");
  }

  const tipoInfo = TIPOS_ATIVIDADE.find((t) => t.id === tipoSelecionado);

  return (
    <div className="w-full">
      {etapa === "tipo" && (
        <div className="aura-card p-5 sm:p-6">
          <p className="text-base font-semibold text-aura-graphite">
            O que você fez agora?
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {TIPOS_ATIVIDADE.map((tipo) => {
              const Icon = tipo.icon;
              return (
                <button
                  key={tipo.id}
                  type="button"
                  onClick={() => selecionarTipo(tipo.id)}
                  className="aura-card aura-card-interativo group flex flex-col items-center gap-2.5 px-3 py-5 focus-visible:outline-2 focus-visible:outline-aura-petrol-500"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-aura-sunken text-aura-graphite-soft transition group-hover:bg-aura-petrol-500/10 group-hover:text-aura-petrol-600">
                    <Icon size={18} />
                  </span>
                  <span className="text-sm font-medium text-aura-graphite">
                    {tipo.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {etapa === "form" && tipoInfo && (
        <div className="aura-card p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3 border-b border-aura-mist pb-4">
            <button
              type="button"
              onClick={() => setEtapa("tipo")}
              aria-label="Voltar"
              className={classeBotao("fantasma", "sm", "w-8 px-0")}
            >
              <ArrowLeft size={16} />
            </button>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-aura-petrol-500/10 text-aura-petrol-600">
              <tipoInfo.icon size={16} />
            </span>
            <p className="text-base font-semibold text-aura-graphite">
              {tipoInfo.label}
            </p>
          </div>

          {tipoSelecionado === "visita" && <VisitaForm onConcluir={concluirAtividade} />}
          {tipoSelecionado === "venda" && <VendaForm onConcluir={concluirAtividade} />}
          {tipoSelecionado === "reuniao" && <ReuniaoForm onConcluir={concluirAtividade} />}
          {tipoSelecionado !== "visita" &&
            tipoSelecionado !== "venda" &&
            tipoSelecionado !== "reuniao" && (
              <GenericActivityForm tipoLabel={tipoInfo.label} onConcluir={concluirAtividade} />
            )}
        </div>
      )}

      {etapa === "concluido" && tipoInfo && (
        <div className="aura-card flex flex-col items-center gap-4 p-8 text-center sm:p-10">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-aura-success/10 text-aura-success">
            <CheckCircle2 size={24} />
          </span>
          <div>
            <p className="font-display text-lg font-semibold text-aura-graphite">
              Atividade concluída!
            </p>
            <p className="mt-1 text-sm text-aura-graphite-soft">
              Seu registro de {tipoInfo.label.toLowerCase()} foi salvo e já está
              refletido no seu DNA Score.
            </p>
          </div>
          <div className="mt-2 flex flex-col gap-2.5 sm:flex-row">
            <button type="button" onClick={registrarOutra} className={classeBotao("secundario")}>
              Registrar outra atividade
            </button>
            <BotaoLink href="/meu-dia" variante="primario">
              Voltar para Meu Dia
            </BotaoLink>
          </div>
        </div>
      )}
    </div>
  );
}
