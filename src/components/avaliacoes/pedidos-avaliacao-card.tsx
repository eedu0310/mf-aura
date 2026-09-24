"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Send, Star } from "lucide-react";

export interface Pedido {
  id: string;
  empresa: string;
  cliente: string | null;
  telefone: string | null;
  token: string;
  canal: string;
  enviado_em: string | null;
  aberto_em: string | null;
  confirmado_em: string | null;
}

interface Config {
  empresa: string;
  link_google: string | null;
  mensagem_padrao: string | null;
}

/**
 * A cobrança do link de avaliação, na tela do vendedor.
 *
 * O botão abre o WhatsApp com a mensagem pronta e já marca o envio — o
 * vendedor não precisa lembrar de nada além de apertar.
 */
export function PedidosAvaliacaoCard({ className = "" }: { className?: string }) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [config, setConfig] = useState<Config[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/avaliacoes?pendentes=1", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) {
        setPedidos(json.pedidos ?? []);
        setConfig(json.config ?? []);
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function enviar(p: Pedido) {
    const c = config.find((x) => x.empresa === p.empresa);

    if (!c?.link_google) {
      setAviso(
        "O gestor ainda não cadastrou o link de avaliação desta loja. Peça para ele configurar em Painel do Gestor → Avaliações.",
      );
      return;
    }

    setAviso("");
    setEnviando(p.id);

    const link = `${window.location.origin}/av/${p.token}`;
    const texto = (c.mensagem_padrao ?? "Oi {cliente}! Se puder deixar sua avaliação, ajuda muito: {link}")
      .replace("{cliente}", p.cliente ?? "")
      .replace("{link}", link);

    const numero = (p.telefone ?? "").replace(/\D/g, "");
    const url = numero
      ? `https://wa.me/55${numero.replace(/^55/, "")}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`;

    window.open(url, "_blank", "noopener");

    await fetch("/api/avaliacoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, enviado: true }),
    });
    await carregar();
    setEnviando(null);
  }

  if (carregando || !pedidos.length) return null;

  return (
    <section
      className={`rounded-2xl border border-aura-gold/40 bg-aura-gold/5 p-4 sm:p-5 ${className}`}
      aria-label="Avaliações pendentes"
    >
      <div className="flex items-start gap-2.5">
        <Star className="mt-0.5 h-5 w-5 shrink-0 text-aura-gold" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-aura-graphite">
            {pedidos.length === 1
              ? "Falta pedir a avaliação de 1 cliente"
              : `Faltam pedir a avaliação de ${pedidos.length} clientes`}
          </h3>
          <p className="mt-0.5 text-xs text-aura-graphite-soft">
            Vale ponto no ranking. Quanto mais perto da entrega você pede, mais gente responde.
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {pedidos.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-aura-graphite">
                {p.cliente ?? "Cliente"}
              </p>
              <p className="text-xs text-aura-graphite-soft">{p.empresa}</p>
            </div>
            <button
              type="button"
              onClick={() => void enviar(p)}
              disabled={enviando === p.id}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-aura-navy-950 px-3 py-2 text-xs font-medium text-aura-gold disabled:opacity-60"
            >
              {enviando === p.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Pedir avaliação
            </button>
          </li>
        ))}
      </ul>

      {aviso && (
        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-aura-warning">{aviso}</p>
      )}
    </section>
  );
}

/** Marca visual do estágio do pedido — usada nas listas do gestor. */
export function SeloAvaliacao({ pedido }: { pedido: Pedido }) {
  if (pedido.confirmado_em) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-aura-success">
        <Check size={12} /> Avaliou
      </span>
    );
  }
  if (pedido.aberto_em) return <span className="text-xs text-aura-petrol-700">Abriu o link</span>;
  if (pedido.enviado_em) return <span className="text-xs text-aura-graphite-soft">Link enviado</span>;
  return <span className="text-xs text-aura-warning">Não pediu ainda</span>;
}
