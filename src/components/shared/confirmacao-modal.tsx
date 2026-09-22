"use client";

import { AlertCircle } from "lucide-react";

interface ConfirmacaoModalProps {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  botaoPrimario: string;
  botaoSecundario?: string;
  tipo?: "danger" | "warning" | "info";
  onConfirmar: () => void;
  onCancelar: () => void;
  carregando?: boolean;
}

export function ConfirmacaoModal({
  aberto,
  titulo,
  mensagem,
  botaoPrimario,
  botaoSecundario = "Cancelar",
  tipo = "warning",
  onConfirmar,
  onCancelar,
  carregando = false,
}: ConfirmacaoModalProps) {
  if (!aberto) return null;

  const corTipo = {
    danger: "bg-red-100 text-red-700",
    warning: "bg-yellow-100 text-yellow-700",
    info: "bg-blue-100 text-blue-700",
  };

  const corBotao = {
    danger: "bg-red-600 hover:bg-red-700",
    warning: "bg-yellow-600 hover:bg-yellow-700",
    info: "bg-blue-600 hover:bg-blue-700",
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onCancelar} />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-aura-mist bg-white p-6 shadow-xl">
        {/* Ícone */}
        <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${corTipo[tipo]}`}>
          <AlertCircle size={24} />
        </div>

        {/* Título */}
        <h2 className="mb-2 text-center font-display text-lg font-bold text-aura-graphite">
          {titulo}
        </h2>

        {/* Mensagem */}
        <p className="mb-6 text-center text-sm text-aura-graphite-soft">
          {mensagem}
        </p>

        {/* Botões */}
        <div className="flex gap-3">
          <button
            onClick={onCancelar}
            disabled={carregando}
            className="flex-1 rounded-lg border border-aura-mist bg-white px-4 py-2.5 text-sm font-medium text-aura-graphite transition hover:bg-aura-bg disabled:opacity-50"
          >
            {botaoSecundario}
          </button>
          <button
            onClick={onConfirmar}
            disabled={carregando}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 ${corBotao[tipo]}`}
          >
            {carregando ? "Processando..." : botaoPrimario}
          </button>
        </div>
      </div>
    </>
  );
}