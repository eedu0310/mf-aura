"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, X } from "lucide-react";
import { useState } from "react";

// Nessas rotas o botão atrapalha: já está na própria tela de registrar
// atividade, ou tem um campo de digitar embaixo (chat, formulários longos).
const ROTAS_SEM_BOTAO = ["/registrar-atividade", "/aura-coach", "/whatsapp"];

export function FloatingActionButton() {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  if (ROTAS_SEM_BOTAO.includes(pathname)) return null;

  return (
    <div
      data-imprimir="esconder"
      className="fixed bottom-5 right-4 z-30 flex flex-col items-end gap-2 sm:bottom-6 sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
    >
      {/* Celular: o "+" abre o atalho */}
      {aberto && (
        <Link
          href="/registrar-atividade"
          onClick={() => setAberto(false)}
          className="rounded-full bg-aura-navy-950 px-4 py-3 text-xs font-semibold tracking-wide text-aura-gold shadow-lg sm:hidden"
        >
          REGISTRAR ATIVIDADE
        </Link>
      )}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={aberto ? "Fechar ações" : "Abrir ações"}
        className="flex items-center gap-2 rounded-full bg-aura-navy-950 px-4 py-3.5 text-sm font-semibold tracking-wide text-aura-gold shadow-lg shadow-black/20 transition hover:bg-aura-navy-900 sm:hidden"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-aura-gold/60">
          {aberto ? <X size={13} /> : <Plus size={13} />}
        </span>
      </button>

      {/* Computador: o botão já leva direto para a tela */}
      <Link
        href="/registrar-atividade"
        className="hidden items-center gap-2 rounded-full bg-aura-navy-950 px-6 py-3.5 text-sm font-semibold tracking-wide text-aura-gold shadow-lg shadow-black/20 transition hover:bg-aura-navy-900 sm:flex"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-aura-gold/60">
          <Plus size={13} />
        </span>
        REGISTRAR ATIVIDADE
      </Link>
    </div>
  );
}
