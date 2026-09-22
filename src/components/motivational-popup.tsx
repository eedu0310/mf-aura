"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface MotivationalPopupProps {
  nome: string;
  onClose: () => void;
  aberto?: boolean;
}

export function MotivationalPopup({
  nome,
  onClose,
  aberto = true,
}: MotivationalPopupProps) {
  const [isOpen, setIsOpen] = useState(aberto);

  if (!isOpen) return null;

  const mensagens = [
    "Você é capaz de mais do que imagina! 💪",
    "Cada dia é uma nova oportunidade! 🌟",
    "Seu potencial é infinito! 🚀",
    "Faça hoje melhor que ontem! 📈",
    "Você merece o sucesso! ✨",
  ];

  const mensagem = mensagens[Math.floor(Math.random() * mensagens.length)];

  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-br from-blue-500 to-purple-600 p-8 shadow-2xl text-white">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full bg-white/20 p-2 hover:bg-white/30 transition"
        >
          <X size={20} />
        </button>

        <div className="text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h2 className="text-3xl font-bold mb-2">Bom dia, {nome}!</h2>
          <p className="text-lg mb-6 opacity-90">{mensagem}</p>
          <p className="text-sm mb-8 opacity-75">
            Você tem um grande dia pela frente!
          </p>

          <button
            onClick={handleClose}
            className="w-full rounded-lg bg-white text-blue-600 py-3 font-bold hover:shadow-lg transition duration-300"
          >
            OK, entendi! 💪
          </button>
        </div>
      </div>
    </div>
  );
}