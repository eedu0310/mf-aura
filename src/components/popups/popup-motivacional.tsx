"use client";

import { X } from "lucide-react";
import { useState, useEffect } from "react";

const FRASES_MOTIVACIONAIS = [
  "Alta performance não acontece por acaso. Ela é construída todos os dias.",
  "Cada ligação é uma oportunidade. Cada conversa é um passo mais perto da meta.",
  "Os melhores vendedores não desistem. Eles persistem.",
  "Você está mais perto do seu objetivo do que pensa.",
  "A consistência vence a falta de talento. O talento sem consistência é promessa não cumprida.",
  "Não é sobre quanto você vende. É sobre quantas vidas você muda.",
  "O sucesso é 1% inspiração e 99% transpiração.",
  "Você tem tudo que precisa para vencer. Comece agora.",
];

export function PopupMotivacional() {
  const [aberto, setAberto] = useState(false);
  const [frase, setFrase] = useState("");

  useEffect(() => {
    // Mostrar pop-up apenas uma vez por dia
    const ultimaExibicao = localStorage.getItem("ultimoPopupMotivacional");
    const agora = new Date().toDateString();

    if (ultimaExibicao !== agora) {
      const fraseAleatoria = FRASES_MOTIVACIONAIS[
        Math.floor(Math.random() * FRASES_MOTIVACIONAIS.length)
      ];
      setFrase(fraseAleatoria);
      setAberto(true);
      localStorage.setItem("ultimoPopupMotivacional", agora);
    }
  }, []);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-gradient-to-br from-aura-petrol-600 to-aura-petrol-700 p-8 text-white">
        <button
          onClick={() => setAberto(false)}
          className="absolute right-4 top-4 rounded-lg p-1 transition hover:bg-white/20"
        >
          <X size={20} />
        </button>

        <div className="space-y-4 text-center">
          <p className="text-sm font-medium uppercase tracking-widest opacity-90">
            💡 Inspiração do Dia
          </p>
          <p className="font-display text-2xl font-bold leading-tight">
            {frase}
          </p>
          <p className="text-sm opacity-80">
            Você é capaz de grandes coisas. Acredite em você.
          </p>
        </div>

        <button
          onClick={() => setAberto(false)}
          className="mt-6 w-full rounded-lg bg-white px-4 py-3 font-medium text-aura-petrol-700 transition hover:bg-opacity-90"
        >
          Vamos Lá! 🚀
        </button>
      </div>
    </div>
  );
}