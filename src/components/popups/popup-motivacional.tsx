"use client";

import { Sparkles, X } from "lucide-react";
import { useState, useEffect } from "react";
import { classeBotao } from "@/components/ui";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-aura-navy-950/50 p-4 backdrop-blur-[2px]">
      <div className="relative w-full max-w-md rounded-xl border border-aura-mist bg-aura-surface p-7 shadow-xl">
        <button
          onClick={() => setAberto(false)}
          aria-label="Fechar"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-graphite"
        >
          <X size={17} />
        </button>

        <div className="flex flex-col items-center space-y-4 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-aura-gold/15 ring-1 ring-inset ring-aura-gold/25">
            <Sparkles size={18} className="text-aura-gold-700" />
          </span>
          <p className="aura-rotulo">
            Inspiração do Dia
          </p>
          <p className="font-display text-xl font-semibold leading-snug text-aura-graphite">
            {frase}
          </p>
          <p className="text-sm text-aura-graphite-soft">
            Você é capaz de grandes coisas. Acredite em você.
          </p>
        </div>

        <button
          onClick={() => setAberto(false)}
          className={classeBotao("primario", "lg", "mt-6 w-full")}
        >
          Vamos Lá!
        </button>
      </div>
    </div>
  );
}