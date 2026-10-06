"use client";

import { useEffect } from "react";
import { useAppData } from "@/lib/app-data-context";
import { useToast, Toast } from "./toast-notificacao";
import { ehGanho } from "@/lib/funil";

export function NotificacoesRealtime() {
  const { toasts, adicionar } = useToast();
  const { vendas, oportunidades, atividades, funil } = useAppData();

  // Notificar quando uma venda é criada
  useEffect(() => {
    if (vendas && vendas.length > 0) {
      const ultimaVenda = vendas[vendas.length - 1];
      if (ultimaVenda) {
        adicionar({
          tipo: "sucesso",
          titulo: "🎉 Nova Venda!",
          mensagem: `Venda de ${ultimaVenda.cliente} registrada com sucesso!`,
          duracao: 5000,
        });
      }
    }
  }, [vendas?.length]);

  // Notificar quando uma oportunidade muda de etapa
  useEffect(() => {
    if (oportunidades && oportunidades.length > 0) {
      const ultimaOpp = oportunidades[oportunidades.length - 1];
      if (ehGanho(ultimaOpp?.etapa, funil)) {
        adicionar({
          tipo: "sucesso",
          titulo: "✅ Oportunidade Fechada!",
          mensagem: `${ultimaOpp.cliente} foi fechada com sucesso!`,
          duracao: 5000,
        });
      }
    }
  }, [oportunidades?.length]);

  // Notificar quando uma atividade é criada
  useEffect(() => {
    if (atividades && atividades.length > 0) {
      const ultimaAtividade = atividades[atividades.length - 1];
      if (ultimaAtividade) {
        adicionar({
          tipo: "info",
          titulo: "📝 Atividade Registrada",
          mensagem: `${ultimaAtividade.titulo} foi adicionada ao calendário`,
          duracao: 4000,
        });
      }
    }
  }, [atividades?.length]);

  return (
    <>
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </>
  );
}