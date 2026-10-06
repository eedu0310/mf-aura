"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { useDitado } from "@/lib/voz/use-ditado";

/**
 * O botão de falar, para colar ao lado de qualquer campo de texto.
 *
 * Mostra três estados, porque os três significam coisas diferentes para quem
 * está falando: ouvindo (pode falar), transcrevendo (já parou, espera) e erro
 * (o microfone não deixou). Enquanto a pessoa fala, o balão mostra o trecho
 * parcial — é o que prova, na hora, que o microfone está pegando.
 */
export function BotaoMicrofone({
  aoTexto,
  titulo = "Falar em vez de digitar",
  classe = "",
}: {
  aoTexto: (trecho: string) => void;
  titulo?: string;
  classe?: string;
}) {
  const voz = useDitado({ aoTexto });

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={() => (voz.ouvindo ? voz.parar() : voz.comecar())}
        disabled={voz.ocupado}
        title={voz.erro ?? titulo}
        aria-label={voz.ouvindo ? "Parar de gravar" : titulo}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:opacity-60 ${
          voz.ouvindo
            ? "bg-aura-danger text-white"
            : voz.erro
              ? "bg-aura-danger/10 text-aura-danger"
              : "bg-aura-mist/60 text-aura-petrol-600 hover:bg-aura-mist"
        } ${classe}`}
      >
        {voz.ocupado ? (
          <Loader2 size={15} className="animate-spin" />
        ) : voz.ouvindo ? (
          <Square size={12} />
        ) : (
          <Mic size={15} />
        )}
      </button>

      {(voz.ouvindo || voz.ocupado || voz.erro) && (
        <span
          role="status"
          className={`pointer-events-none absolute bottom-full left-1/2 mb-2 w-max max-w-[16rem] -translate-x-1/2 rounded-lg px-2.5 py-1.5 text-xs leading-snug shadow-sm ${
            voz.erro ? "bg-aura-danger text-white" : "bg-aura-navy-950 text-white"
          }`}
        >
          {voz.erro
            ? voz.erro
            : voz.ocupado
              ? "Transcrevendo..."
              : voz.parcial
                ? voz.parcial
                : "Pode falar. Toque de novo para parar."}
        </span>
      )}
    </div>
  );
}
