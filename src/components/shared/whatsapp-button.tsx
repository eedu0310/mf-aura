"use client";

import { MessageCircle } from "lucide-react";

interface WhatsAppButtonProps {
  numero: string;
  mensagem?: string;
  texto?: string;
}

export function WhatsAppButton({ numero, mensagem = "", texto = "WhatsApp" }: WhatsAppButtonProps) {
  function abrirWhatsApp() {
    const numeroLimpo = numero.replace(/\D/g, "");
    const url = `https://wa.me/${numeroLimpo}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, "_blank");
  }

  return (
    <button
      onClick={abrirWhatsApp}
      className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition"
    >
      <MessageCircle size={16} />
      {texto}
    </button>
  );
}