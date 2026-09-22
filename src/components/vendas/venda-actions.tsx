"use client";

import { useState } from "react";
import { Trash2, Download } from "lucide-react";
import { ConfirmacaoModal } from "@/components/shared/confirmacao-modal";
import { exportarParaExcel } from "@/lib/export-utils";
import type { Venda } from "@/lib/types";

interface VendaActionsProps {
  venda: Venda;
  onDelete: (id: string) => Promise<void>;
}

export function VendaActions({ venda, onDelete }: VendaActionsProps) {
  const [deletando, setDeletando] = useState(false);
  const [confirmarDelete, setConfirmarDelete] = useState(false);

  async function handleDelete() {
    setDeletando(true);
    try {
      await onDelete(venda.id);
      setConfirmarDelete(false);
    } finally {
      setDeletando(false);
    }
  }

  function exportarVenda() {
    exportarParaExcel(
      [
        {
          Cliente: venda.cliente,
          Produto: venda.produto,
          Valor: venda.valor,
          Data: new Date(venda.data).toLocaleDateString("pt-BR"),
          Status: venda.status,
        },
      ],
      `venda-${venda.cliente}`,
      "Venda"
    );
  }

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={exportarVenda}
          className="rounded-lg border border-aura-mist bg-white p-2 hover:bg-aura-bg transition"
          title="Exportar"
        >
          <Download size={16} />
        </button>
        <button
          onClick={() => setConfirmarDelete(true)}
          className="rounded-lg border border-red-200 bg-red-50 p-2 hover:bg-red-100 transition"
          title="Deletar"
        >
          <Trash2 size={16} className="text-red-600" />
        </button>
      </div>

      <ConfirmacaoModal
        aberto={confirmarDelete}
        tipo="danger"
        titulo="Deletar Venda"
        mensagem={`Tem certeza que deseja deletar a venda de ${venda.cliente}? Esta ação não pode ser desfeita.`}
        botaoPrimario="Deletar"
        onConfirmar={handleDelete}
        onCancelar={() => setConfirmarDelete(false)}
        carregando={deletando}
      />
    </>
  );
}