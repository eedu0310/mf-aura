"use client";

import { X } from "lucide-react";
import { classeBotao } from "@/components/ui";
import { VendaForm } from "@/components/registrar-atividade/venda-form";
import type { Venda } from "@/lib/types";

/**
 * "Completar venda": a venda que o pipeline abriu sozinho (card arrastado
 * para Fechamento, ou a IA no WhatsApp) com o valor estimado do card, e que
 * o vendedor agora completa com o valor real, pagamento, origem e relato.
 * Usa o mesmo formulário de "Registrar venda" — só que atualiza a pendente
 * em vez de criar outra.
 */
export function CompletarVendaModal({ venda, onClose }: { venda: Venda; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center">
      <div className="aura-card my-4 w-full max-w-2xl rounded-xl p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-aura-graphite">Completar venda</h2>
            <p className="text-xs text-aura-graphite-soft">
              {venda.cliente} · confira o valor real, a forma de pagamento e conte como foi o fechamento.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className={classeBotao("fantasma", "sm", "h-8 w-8 shrink-0 px-0")}
          >
            <X size={18} />
          </button>
        </div>
        <VendaForm pendente={venda} onConcluir={onClose} />
      </div>
    </div>
  );
}
