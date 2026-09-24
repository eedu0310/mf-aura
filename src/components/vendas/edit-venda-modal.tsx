"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";

interface EditVendaModalProps {
  venda: {
    id: string;
    cliente: string;
    produto?: string;
    valor: number;
  };
  onClose: () => void;
}

export function EditVendaModal({ venda, onClose }: EditVendaModalProps) {
  const { updateVenda } = useAppData();
  const [cliente, setCliente] = useState(venda.cliente);
  const [produto, setProduto] = useState(venda.produto);
  const [valor, setValor] = useState(String(venda.valor));
  const [salvando, setSalvando] = useState(false);

  function salvar(e: React.FormEvent) {
    e.preventDefault();

    if (!cliente.trim() || !(produto || "").trim() || !valor.trim()) {
      alert("Preencha todos os campos antes de salvar.");
      return;
    }

    setSalvando(true);
    const valorNumerico = parseFloat(valor.replace(/\D/g, "")) / 100 || 0;

    updateVenda(venda.id, {
      cliente: cliente.trim(),
      produto: (produto || "").trim() || "Não especificado",
      valor: valorNumerico,
    });

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-aura-graphite">
            Editar Venda
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition hover:bg-aura-bg"
          >
            <X size={20} className="text-aura-graphite-soft" />
          </button>
        </div>

        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-aura-graphite mb-1">
              Cliente
            </label>
            <input
              type="text"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-aura-graphite mb-1">
              Produto
            </label>
            <input
              type="text"
              value={produto}
              onChange={(e) => setProduto(e.target.value)}
              className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-aura-graphite mb-1">
              Valor (R$)
            </label>
            <input
              type="text"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              className="w-full rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-aura-mist bg-white px-4 py-2 text-sm font-medium text-aura-graphite transition hover:bg-aura-bg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="flex-1 rounded-lg bg-aura-petrol-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-aura-petrol-700 disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}