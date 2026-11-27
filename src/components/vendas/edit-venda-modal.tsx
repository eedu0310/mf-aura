"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { classeBotao } from "@/components/ui";
import { moedaParaNumero } from "@/components/registrar-atividade/activity-date";

interface EditVendaModalProps {
  venda: {
    id: string;
    cliente: string;
    produto?: string;
    valor: number;
    /** O que as telas mostram; é o valor que o vendedor corrige. */
    valorFechado?: number;
  };
  onClose: () => void;
}

export function EditVendaModal({ venda, onClose }: EditVendaModalProps) {
  const { updateVenda } = useAppData();
  const [cliente, setCliente] = useState(venda.cliente);
  const [produto, setProduto] = useState(venda.produto);
  // Começa no valor que as telas mostram, escrito como o vendedor escreve.
  const [valor, setValor] = useState(
    (venda.valorFechado ?? venda.valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  );
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();

    if (!cliente.trim() || !(produto || "").trim() || !valor.trim()) {
      alert("Preencha todos os campos antes de salvar.");
      return;
    }

    setSalvando(true);
    // Antes: tirava tudo que não era dígito e dividia por 100 — "12900"
    // (como o campo abria) virava R$ 129 ao salvar sem mexer (27/11/2026).
    const valorNumerico = moedaParaNumero(valor);
    if (!(valorNumerico > 0)) {
      alert("Informe um valor válido.");
      setSalvando(false);
      return;
    }

    try {
      await updateVenda(venda.id, {
        cliente: cliente.trim(),
        produto: (produto || "").trim() || "Não especificado",
        valor: valorNumerico,
      });
      onClose();
    } catch (erro: any) {
      alert(erro?.message ?? "Não consegui salvar a venda.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="aura-card w-full max-w-md rounded-xl p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-aura-graphite">
            Editar Venda
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className={classeBotao("fantasma", "sm", "h-8 w-8 px-0")}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={(e) => void salvar(e)} className="space-y-4">
          <div>
            <label className="aura-label">
              Cliente
            </label>
            <input
              type="text"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className="aura-input"
            />
          </div>

          <div>
            <label className="aura-label">
              Produto
            </label>
            <input
              type="text"
              value={produto}
              onChange={(e) => setProduto(e.target.value)}
              className="aura-input"
            />
          </div>

          <div>
            <label className="aura-label">
              Valor (R$)
            </label>
            <input
              type="text"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              className="aura-input"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className={classeBotao("secundario", "md", "flex-1")}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className={classeBotao("primario", "md", "flex-1")}
            >
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}