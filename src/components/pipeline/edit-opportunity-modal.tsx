"use client";

import { useState } from "react";
import { X, Check } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import type { Oportunidade, Probabilidade } from "@/lib/types";

const PROBABILIDADES: Probabilidade[] = ["Baixa", "Média", "Alta"];

export function EditOpportunityModal({
  oportunidade: o,
  onClose,
}: {
  oportunidade: Oportunidade;
  onClose: () => void;
}) {
  const { updateOportunidade } = useAppData();
  const [cliente, setCliente] = useState(o.cliente);
  const [produto, setProduto] = useState(o.produto);
  const [valor, setValor] = useState(String(o.valor));
  const [probabilidade, setProbabilidade] = useState<Probabilidade>(o.probabilidade);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const valorNumerico = Number(valor.replace(/\D/g, ""));
    if (!cliente.trim() || !valorNumerico) return;

    updateOportunidade(o.id, {
      cliente: cliente.trim(),
      produto: (produto || "").trim() || "Não especificado",
      valor: valorNumerico,
      probabilidade,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <p className="font-display text-lg font-semibold text-aura-graphite">
            Editar oportunidade
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-aura-graphite-soft hover:text-aura-graphite"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={salvar} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">Cliente</label>
            <input
              type="text"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">Produto</label>
            <input
              type="text"
              value={produto}
              onChange={(e) => setProduto(e.target.value)}
              className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
              Valor estimado
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-full rounded-xl border border-aura-mist bg-white px-4 py-2.5 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-aura-graphite">
              Probabilidade
            </label>
            <div className="flex flex-wrap gap-2">
              {PROBABILIDADES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProbabilidade(p)}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    probabilidade === p
                      ? "border-aura-petrol-700 bg-aura-petrol-700 text-white"
                      : "border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-500/50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-aura-petrol-700 py-2.5 text-sm font-semibold text-white hover:bg-aura-petrol-600"
          >
            <Check size={14} />
            Salvar alterações
          </button>
        </form>
      </div>
    </div>
  );
}
