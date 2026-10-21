"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Mantém o navegador na versão que está no ar.
 *
 * Por quê: quem deixa o AURA aberto dias seguidos (o MacBook do Alexandre,
 * 21/10) continuava rodando a versão do dia em que abriu a aba — várias
 * atualizações para trás, sem as telas novas e com dados velhos.
 *
 * Como: pergunta ao servidor qual build está no ar ao voltar para a aba, a
 * cada 5 minutos e ao abrir. Se mudou:
 *   - aba estava escondida (ele voltou agora) → recarrega sozinho;
 *   - aba visível, pessoa usando → mostra a faixa "Nova versão", para não
 *     apagar um formulário pela metade.
 * Também pede ao navegador para buscar o service worker novo.
 */
const MINHA_VERSAO = process.env.NEXT_PUBLIC_VERSAO ?? "";
const CINCO_MINUTOS = 5 * 60 * 1000;

async function versaoNoAr(): Promise<string | null> {
  try {
    const res = await fetch("/api/versao", { cache: "no-store" });
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j.versao === "string" ? j.versao : null;
  } catch {
    return null;
  }
}

export function AtualizadorDeVersao() {
  const [novaVersao, setNovaVersao] = useState(false);
  const escondidaDesde = useRef<number | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !MINHA_VERSAO) return;

    async function conferir(podeRecarregarSozinho: boolean) {
      void navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
      const noAr = await versaoNoAr();
      if (!noAr || noAr === MINHA_VERSAO) return;
      if (podeRecarregarSozinho) window.location.reload();
      else setNovaVersao(true);
    }

    function aoMudarVisibilidade() {
      if (document.visibilityState === "hidden") {
        escondidaDesde.current = Date.now();
        return;
      }
      // Voltou para a aba depois de um tempo fora: recarregar não interrompe ninguém.
      const fora = escondidaDesde.current ? Date.now() - escondidaDesde.current : 0;
      escondidaDesde.current = null;
      void conferir(fora > 60_000);
    }

    void conferir(false);
    const relogio = window.setInterval(() => void conferir(document.visibilityState === "hidden"), CINCO_MINUTOS);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => {
      window.clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, []);

  if (!novaVersao) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-3 bg-aura-petrol-700 px-4 py-2 text-sm text-white shadow-lg">
      <span>Saiu uma versão nova do AURA.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-aura-petrol-700"
      >
        <RefreshCw size={13} /> Atualizar agora
      </button>
    </div>
  );
}
