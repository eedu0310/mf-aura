"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
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
    <div className="mx-auto w-full max-w-xl">
      {etapa === "tipo" && (
        <div className="rounded-2xl border border-aura-mist bg-white p-6 sm:p-8">
          <p className="text-center font-display text-xl font-semibold text-aura-graphite">
            O que você fez agora?
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TIPOS_ATIVIDADE.map((tipo) => {
              const Icon = tipo.icon;
              return (
                <button
                  key={tipo.id}
                  type="button"
                  onClick={() => selecionarTipo(tipo.id)}
                  className="flex flex-col items-center gap-2.5 rounded-xl border border-aura-mist bg-white px-3 py-5 transition hover:border-aura-petrol-500 hover:bg-aura-petrol-700/5"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-aura-petrol-700/10 text-aura-petrol-700">
                    <Icon size={20} />
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
        <div className="rounded-2xl border border-aura-mist bg-white p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEtapa("tipo")}
              aria-label="Voltar"
              className="flex h-8 w-8 items-center justify-center rounded-full text-aura-graphite-soft hover:bg-aura-bg hover:text-aura-graphite"
            >
              <ArrowLeft size={17} />
            </button>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-aura-petrol-700/10 text-aura-petrol-700">
              <tipoInfo.icon size={17} />
            </span>
            <p className="font-display text-lg font-semibold text-aura-graphite">
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
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-aura-mist bg-white p-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-aura-success/10 text-aura-success">
            <CheckCircle2 size={28} />
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
            <button
              type="button"
              onClick={registrarOutra}
              className="rounded-xl border border-aura-mist px-5 py-2.5 text-sm font-medium text-aura-graphite hover:bg-aura-bg"
            >
              Registrar outra atividade
            </button>
            <Link
              href="/meu-dia"
              className="rounded-xl bg-aura-petrol-700 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-aura-petrol-600"
            >
              Voltar para Meu Dia
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}