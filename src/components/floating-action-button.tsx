"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { classeBotao } from "@/components/ui";

// Botão flutuante: o primário do sistema, em formato de pílula e com sombra
// (flutua sobre o conteúdo, então a sombra aqui é de propósito).
const FLUTUANTE = "!rounded-full shadow-lg shadow-aura-navy-950/15";

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
          className={classeBotao("primario", "lg", `${FLUTUANTE} sm:hidden`)}
        >
          Registrar atividade
        </Link>
      )}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={aberto ? "Fechar ações" : "Abrir ações"}
        className={classeBotao("primario", "lg", `${FLUTUANTE} !h-12 !w-12 !px-0 sm:hidden`)}
      >
        {aberto ? <X size={18} /> : <Plus size={18} />}
      </button>

      {/* Computador: o botão já leva direto para a tela */}
      <Link
        href="/registrar-atividade"
        className={classeBotao("primario", "lg", `${FLUTUANTE} !hidden !px-5 sm:!inline-flex`)}
      >
        <Plus size={16} />
        Registrar atividade
      </Link>
    </div>
  );
}
