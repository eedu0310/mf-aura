"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type TipoToast = "sucesso" | "erro" | "aviso" | "info";

interface ToastProps {
  tipo: TipoToast;
  titulo: string;
  mensagem?: string;
  duracao?: number;
  onFechar: () => void;
}

const CONFIGS = {
  sucesso: {
    bg: "bg-green-50 border-green-200",
    icon: CheckCircle2,
    cor: "text-green-700",
  },
  erro: {
    bg: "bg-red-50 border-red-200",
    icon: AlertCircle,
    cor: "text-red-700",
  },
  aviso: {
    bg: "bg-yellow-50 border-yellow-200",
    icon: AlertCircle,
    cor: "text-yellow-700",
  },
  info: {
    bg: "bg-blue-50 border-blue-200",
    icon: Info,
    cor: "text-blue-700",
  },
};

export function Toast({ tipo, titulo, mensagem, duracao = 4000, onFechar }: ToastProps) {
  const [visivel, setVisivel] = useState(true);
  const config = CONFIGS[tipo];
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisivel(false);
      onFechar();
    }, duracao);

    return () => clearTimeout(timer);
  }, [duracao, onFechar]);

  if (!visivel) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-lg border p-4 ${config.bg} animate-in slide-in-from-right-5`}
    >
      <Icon size={20} className={config.cor} />
      <div className="flex-1">
        <p className={`font-medium ${config.cor}`}>{titulo}</p>
        {mensagem && <p className="text-sm text-gray-600">{mensagem}</p>}
      </div>
      <button
        onClick={() => {
          setVisivel(false);
          onFechar();
        }}
        className="text-gray-400 hover:text-gray-600"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// ========== GERENCIADOR DE TOASTS ==========
export function useToast() {
  const [toasts, setToasts] = useState<Array<ToastProps & { id: string }>>([]);

  const adicionar = (props: Omit<ToastProps, "onFechar">) => {
    const id = Math.random().toString(36).substr(2, 9);
    const toast: ToastProps & { id: string } = {
      ...props,
      id,
      onFechar: () => remover(id),
    };
    setToasts((prev) => [...prev, toast]);
  };

  const remover = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, adicionar, remover };
}