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
        <ul className="mb-2 flex max-h-40 flex-col gap-2 overflow-y-auto rounded-lg border border-aura-mist bg-aura-sunken/50 p-3">
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
          className="aura-input flex-1"
        />
        <button
          type="submit"
          disabled={enviando || !texto.trim()}
          aria-label="Adicionar anotação"
          className="aura-btn aura-btn-primario h-[2.375rem] w-[2.375rem] shrink-0 px-0"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
