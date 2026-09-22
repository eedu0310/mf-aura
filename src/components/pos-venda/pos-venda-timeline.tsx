"use client";

import { useEffect, useState } from "react";
import { Send, MessageSquare } from "lucide-react";
import { listarNotas, adicionarNota, type NotaPosVenda } from "@/lib/supabase/pos-venda";
import { useUserProfile } from "@/lib/user-profile-context";

function formatarData(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function PosVendaTimeline({ posVendaId }: { posVendaId: string }) {
  const { profile } = useUserProfile();
  const [notas, setNotas] = useState<NotaPosVenda[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function carregar() {
    const lista = await listarNotas(posVendaId);
    setNotas(lista);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posVendaId]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    await adicionarNota(posVendaId, profile.nome, texto.trim());
    setTexto("");
    setEnviando(false);
    await carregar();
  }

  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-aura-graphite">
        <MessageSquare size={14} />
        Histórico de acompanhamento
      </label>

      {notas.length > 0 && (
        <ul className="mb-2 flex max-h-40 flex-col gap-2 overflow-y-auto rounded-xl border border-aura-mist bg-aura-bg p-3">
          {notas.map((n) => (
            <li key={n.id} className="text-xs">
              <span className="font-medium text-aura-graphite">{n.autorNome ?? "Alguém"}</span>{" "}
              <span className="text-aura-graphite-soft">· {formatarData(n.criadoEm)}</span>
              <p className="text-aura-graphite">{n.texto}</p>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={enviar} className="flex gap-2">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Adicionar anotação (ex.: ligou pra confirmar horário)"
          className="flex-1 rounded-xl border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
        />
        <button
          type="submit"
          disabled={enviando || !texto.trim()}
          aria-label="Adicionar anotação"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-aura-petrol-700 text-white hover:bg-aura-petrol-600 disabled:opacity-50"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
