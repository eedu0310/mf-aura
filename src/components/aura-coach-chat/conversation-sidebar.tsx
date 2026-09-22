"use client";

import { Plus, MessageSquare, Trash2 } from "lucide-react";
import type { ConversaSalva } from "@/lib/supabase/coach-messages";

export function ConversationSidebar({
  conversas,
  conversaAtualId,
  onSelecionar,
  onNovaConversa,
  onApagar,
}: {
  conversas: ConversaSalva[];
  conversaAtualId: string | null;
  onSelecionar: (id: string) => void;
  onNovaConversa: () => void;
  onApagar: (id: string) => void;
}) {
  return (
    <div className="hidden w-60 shrink-0 flex-col rounded-2xl border border-aura-mist bg-white sm:flex">
      <div className="border-b border-aura-mist p-3">
        <button
          type="button"
          onClick={onNovaConversa}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-aura-petrol-700 py-2 text-sm font-medium text-white hover:bg-aura-petrol-600"
        >
          <Plus size={15} />
          Nova conversa
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {conversas.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-aura-graphite-soft">
            Nenhuma conversa ainda.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {conversas.map((c) => {
              const ativa = c.id === conversaAtualId;
              return (
                <li key={c.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelecionar(c.id)}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 pr-8 text-left text-sm transition ${
                      ativa
                        ? "bg-aura-petrol-700/8 text-aura-graphite"
                        : "text-aura-graphite-soft hover:bg-aura-bg hover:text-aura-graphite"
                    }`}
                  >
                    <MessageSquare size={14} className="shrink-0" />
                    <span className="truncate">{c.titulo}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Apagar esta conversa?")) onApagar(c.id);
                    }}
                    aria-label="Apagar conversa"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-aura-graphite-soft opacity-0 hover:text-aura-danger group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
