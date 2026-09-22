import { useState, useCallback } from "react";

export interface Toast {
  id: string;
  tipo: "sucesso" | "erro" | "alerta" | "info";
  titulo: string;
  mensagem: string;
}

export function useNotificationToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const mostrar = useCallback((
    tipo: Toast["tipo"],
    titulo: string,
    mensagem: string,
    duracao = 5000
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    const novoToast: Toast = { id, tipo, titulo, mensagem };

    setToasts((prev) => [...prev, novoToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duracao);
  }, []);

  return { toasts, mostrar };
}