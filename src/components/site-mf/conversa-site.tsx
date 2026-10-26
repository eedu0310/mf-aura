"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRightLeft, CheckCircle2, Loader2, MapPin, MessageCircle, RotateCcw, Send, X, XCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Mensagem {
  id: string;
  autor: "visitante" | "equipe" | "sistema";
  autor_id: string | null;
  autor_nome: string | null;
  texto: string;
  created_at: string;
}

interface Conversa {
  id: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  status: "aberta" | "encerrada";
  atendente: string | null;
  visitante_visto_em: string | null;
  origem_url: string | null;
  created_at: string;
}

function hora(iso: string) {
  const d = new Date(iso);
  const hoje = new Date().toDateString() === d.toDateString();
  return hoje
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * A conversa do chat do site, do lado da equipe: lê, responde, encerra e
 * chama as ações do atendimento (atendido / transferir) que a tela de
 * Atendimento já tem.
 */
export function ConversaSite({
  conversaId,
  podeAgir,
  ocupado,
  onFechar,
  onAtendido,
  onTransferir,
}: {
  conversaId: string;
  podeAgir: boolean;
  ocupado: boolean;
  onFechar: () => void;
  onAtendido: () => void;
  onTransferir: () => void;
}) {
  const [conversa, setConversa] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const fim = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/site/chat/equipe?c=${encodeURIComponent(conversaId)}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || "Não consegui abrir a conversa.");
      setConversa(j.conversa);
      setMensagens(j.mensagens ?? []);
      setErro(null);
      window.dispatchEvent(new Event("aura:chat-site-mudou"));
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui abrir a conversa.");
    }
  }, [conversaId]);

  useEffect(() => {
    void carregar();
    const sb = getSupabaseBrowserClient();
    const canal = sb
      ?.channel(`aura-conversa-${conversaId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "site_mensagens", filter: `conversa_id=eq.${conversaId}` }, (payload) => {
        const m = payload.new as Mensagem;
        setMensagens((lista) => (lista.some((x) => x.id === m.id) ? lista : [...lista, m]));
        // Abrir a conversa já é ler: zera o contador do servidor.
        if (m.autor === "visitante") void fetch(`/api/site/chat/equipe?c=${encodeURIComponent(conversaId)}`, { cache: "no-store" }).then(() => window.dispatchEvent(new Event("aura:chat-site-mudou")));
      })
      .subscribe();
    // Se o tempo real cair, a conversa ainda se atualiza.
    const t = window.setInterval(() => {
      void carregar();
      setAgora(Date.now());
    }, 15_000);
    return () => {
      window.clearInterval(t);
      if (sb && canal) void sb.removeChannel(canal);
    };
  }, [conversaId, carregar]);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length]);

  async function responder() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    try {
      const r = await fetch("/api/site/chat/equipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "responder", c: conversaId, texto: t }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || "Não consegui enviar.");
      setTexto("");
      setMensagens((lista) => (lista.some((x) => x.id === j.mensagem.id) ? lista : [...lista, j.mensagem]));
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui enviar.");
    } finally {
      setEnviando(false);
    }
  }

  async function mudarStatus(acao: "encerrar" | "reabrir") {
    await fetch("/api/site/chat/equipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acao, c: conversaId }),
    });
    await carregar();
  }

  const noSite = conversa?.visitante_visto_em && agora - new Date(conversa.visitante_visto_em).getTime() < 60_000;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/30" onClick={onFechar}>
      <div
        role="dialog"
        aria-label={`Conversa com ${conversa?.nome ?? "cliente do site"}`}
        className="flex h-full w-full max-w-xl flex-col bg-aura-bg shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-aura-mist bg-white px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-semibold text-aura-graphite">{conversa?.nome ?? "Carregando…"}</p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-aura-graphite-soft">
              {conversa?.cidade && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} /> {conversa.cidade}
                </span>
              )}
              {conversa?.telefone && <span className="font-data">+{conversa.telefone}</span>}
              {conversa?.email && <span>{conversa.email}</span>}
            </p>
            <p className="mt-1 text-xs">
              {conversa?.status === "encerrada" ? (
                <span className="text-aura-graphite-soft">Conversa encerrada</span>
              ) : noSite ? (
                <span className="font-medium text-emerald-700">● Está no site agora</span>
              ) : (
                <span className="text-aura-graphite-soft">Saiu do site · a resposta fica esperando por ele lá</span>
              )}
              {conversa?.atendente ? <span className="text-aura-graphite-soft"> · atendendo: {conversa.atendente}</span> : null}
            </p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar conversa" className="rounded-full p-2 text-aura-graphite-soft hover:bg-aura-bg">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-aura-mist bg-white px-5 py-3">
          {conversa?.telefone && (
            <a
              href={`https://wa.me/${conversa.telefone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-aura-mist px-3 text-xs font-medium text-aura-graphite hover:border-aura-petrol-500/50"
            >
              <MessageCircle size={14} /> WhatsApp
            </a>
          )}
          {podeAgir && (
            <>
              <button
                type="button"
                disabled={ocupado}
                onClick={onAtendido}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-aura-mist px-3 text-xs font-medium text-aura-graphite hover:border-aura-petrol-500/50 disabled:opacity-60"
              >
                <CheckCircle2 size={14} /> Atendido · vai para o pipeline
              </button>
              <button
                type="button"
                onClick={onTransferir}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-aura-mist px-3 text-xs font-medium text-aura-graphite hover:border-aura-petrol-500/50"
              >
                <ArrowRightLeft size={14} /> Transferir
              </button>
            </>
          )}
          {conversa &&
            (conversa.status === "aberta" ? (
              <button
                type="button"
                onClick={() => void mudarStatus("encerrar")}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-aura-mist px-3 text-xs font-medium text-aura-graphite-soft hover:border-aura-petrol-500/50"
              >
                <XCircle size={14} /> Encerrar conversa
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void mudarStatus("reabrir")}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-aura-mist px-3 text-xs font-medium text-aura-graphite-soft hover:border-aura-petrol-500/50"
              >
                <RotateCcw size={14} /> Reabrir
              </button>
            ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!conversa && !erro && (
            <div className="flex justify-center py-16 text-aura-graphite-soft">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}
          <ul className="flex flex-col gap-2.5">
            {mensagens.map((m) =>
              m.autor === "sistema" ? (
                <li key={m.id} className="mx-auto max-w-[90%] rounded-xl bg-aura-mist/70 px-3 py-1.5 text-center text-xs text-aura-graphite-soft">
                  {m.texto}
                </li>
              ) : (
                <li key={m.id} className={`flex flex-col ${m.autor === "equipe" ? "items-end" : "items-start"}`}>
                  <span className="mb-0.5 px-1 text-[0.7rem] text-aura-graphite-soft">
                    {m.autor === "equipe" ? m.autor_nome || "Equipe" : conversa?.nome || "Cliente"} · {hora(m.created_at)}
                  </span>
                  <p
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                      m.autor === "equipe" ? "rounded-br-md bg-aura-petrol-700 text-white" : "rounded-bl-md border border-aura-mist bg-white text-aura-graphite"
                    }`}
                  >
                    {m.texto}
                  </p>
                </li>
              ),
            )}
          </ul>
          <div ref={fim} />
        </div>

        {erro && (
          <p role="alert" className="mx-5 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {erro}
          </p>
        )}

        <form
          className="flex items-end gap-2 border-t border-aura-mist bg-white px-4 py-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            void responder();
          }}
        >
          <textarea
            rows={2}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void responder();
              }
            }}
            placeholder="Responder ao cliente… (Enter envia, Shift+Enter quebra a linha)"
            aria-label="Resposta"
            className="max-h-40 min-h-11 flex-1 resize-y rounded-xl border border-aura-mist px-3 py-2 text-sm outline-none focus:border-aura-petrol-500"
          />
          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            aria-label="Enviar resposta"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-aura-petrol-700 text-white hover:bg-aura-petrol-600 disabled:opacity-50"
          >
            {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
}
