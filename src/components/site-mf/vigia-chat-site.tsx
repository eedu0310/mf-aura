"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { usarMeuAcesso } from "@/lib/usar-permissoes";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { EMPRESA_DO_SITE } from "@/lib/site-mf/tipos";

/**
 * Fica de olho no chat do site da MF em qualquer tela da AURA.
 *
 *  - avisa a AURA que esta pessoa está com o sistema aberto (presença), para
 *    o widget mostrar quem está online;
 *  - quando o cliente escreve no site, mostra um aviso no canto da tela;
 *  - mantém o número de mensagens não lidas, que o menu mostra no item
 *    "Site MF".
 *
 * Só funciona para quem é da MF e para o gestor mestre. Para todo o resto
 * não faz nada (nem consulta o servidor).
 */

const EVENTO = "aura:chat-site-nao-lidas";
let naoLidasAgora = 0;

function publicar(n: number) {
  naoLidasAgora = n;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENTO, { detail: n }));
}

/** Número de mensagens do site esperando resposta (para o menu). */
export function useNaoLidasDoSite(): number {
  const [n, setN] = useState(naoLidasAgora);
  useEffect(() => {
    const ouvir = (e: Event) => setN((e as CustomEvent<number>).detail ?? 0);
    window.addEventListener(EVENTO, ouvir);
    setN(naoLidasAgora);
    return () => window.removeEventListener(EVENTO, ouvir);
  }, []);
  return n;
}

export function VigiaChatSite() {
  const { profile } = useUserProfile();
  // Sem perfil (tela pública, login) não monta nada.
  if (!profile.empresa) return null;
  return <VigiaLogado empresa={profile.empresa} />;
}

interface Aviso {
  id: string;
  nome: string;
  texto: string;
}

const MINUTO = 60_000;

function VigiaLogado({ empresa }: { empresa: string }) {
  const acesso = usarMeuAcesso();
  const daEquipe = empresa === EMPRESA_DO_SITE || acesso.gestorMestre;
  const pathname = usePathname();
  const router = useRouter();
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [disponivel, setDisponivel] = useState(false);
  const caminho = useRef(pathname);
  useEffect(() => {
    caminho.current = pathname;
  }, [pathname]);

  const resumir = useCallback(async () => {
    try {
      const r = await fetch("/api/site/chat/equipe?resumo=1", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      publicar(Number(j.naoLidas) || 0);
      setDisponivel(Boolean(j.disponivel));
    } catch {
      // sem rede: tenta de novo no próximo ciclo
    }
  }, []);

  // Presença: um sinal por minuto enquanto a AURA estiver aberta.
  useEffect(() => {
    if (!daEquipe) return;
    const sinal = () => void fetch("/api/site/chat/equipe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "presenca" }) }).catch(() => {});
    sinal();
    void resumir();
    const t = window.setInterval(() => {
      sinal();
      void resumir();
    }, MINUTO);
    const voltar = () => document.visibilityState === "visible" && (sinal(), void resumir());
    document.addEventListener("visibilitychange", voltar);
    window.addEventListener("aura:chat-site-mudou", resumir);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", voltar);
      window.removeEventListener("aura:chat-site-mudou", resumir);
    };
  }, [daEquipe, resumir]);

  // Mensagem nova do cliente: aviso na hora (o banco só entrega para a equipe).
  useEffect(() => {
    if (!daEquipe) return;
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    const canal = sb
      .channel("aura-vigia-chat-site")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "site_mensagens" }, (payload) => {
        const m = payload.new as { id: string; autor: string; autor_nome: string | null; texto: string; conversa_id: string; anexo_tipo?: string | null };
        if (m.autor !== "visitante") return;
        void resumir();
        window.dispatchEvent(new CustomEvent("aura:chat-site-mensagem", { detail: m }));
        // Na própria tela do Site MF a conversa já aparece; o aviso sobra.
        if (caminho.current?.startsWith("/site-mf")) return;
        setAviso({
          id: m.conversa_id,
          nome: m.autor_nome || "Cliente do site",
          texto: m.texto || (m.anexo_tipo?.startsWith("audio/") ? "🎤 Mandou um áudio" : m.anexo_tipo?.startsWith("image/") ? "📷 Mandou uma foto" : "📎 Mandou um arquivo"),
        });
        tocar();
      })
      .subscribe();
    return () => {
      void sb.removeChannel(canal);
    };
  }, [daEquipe, resumir]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 20_000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  if (!daEquipe || !aviso || !disponivel) return null;
  return (
    <div
      role="status"
      className="fixed bottom-24 right-4 z-[90] flex w-[min(360px,calc(100vw-2rem))] items-start gap-3 rounded-2xl border border-aura-mist bg-white p-4 shadow-xl lg:bottom-6"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#CD1C1B] text-white">
        <MessageCircle size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-aura-graphite-soft">Chat do site da MF</p>
        <p className="truncate text-sm font-semibold text-aura-graphite">{aviso.nome}</p>
        <p className="line-clamp-2 text-sm text-aura-graphite-soft">{aviso.texto}</p>
        <button
          type="button"
          onClick={() => {
            setAviso(null);
            router.push(`/site-mf?conversa=${aviso.id}`);
          }}
          className="mt-2 min-h-9 rounded-full bg-aura-petrol-700 px-4 text-xs font-medium text-white hover:bg-aura-petrol-600"
        >
          Responder agora
        </button>
      </div>
      <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso" className="rounded-full p-1.5 text-aura-graphite-soft hover:bg-aura-bg">
        <X size={16} />
      </button>
    </div>
  );
}

/** Dois toques curtos. O navegador só deixa tocar depois que a pessoa clicou na página. */
function tocar() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.18].forEach((quando) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + quando);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + quando + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + quando + 0.14);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + quando);
      o.stop(ctx.currentTime + quando + 0.15);
    });
    window.setTimeout(() => void ctx.close(), 600);
  } catch {
    // sem som, segue só o aviso
  }
}
