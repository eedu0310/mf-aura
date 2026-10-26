"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import type { Tutorial } from "@/lib/site-mf/materiais";

/**
 * Vídeo do YouTube que só carrega quando a pessoa clica (a página abre
 * rápido mesmo com dez vídeos). Antes do clique, só a capa do vídeo.
 */
export function VideoTutorial({ tutorial }: { tutorial: Tutorial }) {
  const [tocando, setTocando] = useState(false);
  return (
    <article className="flex flex-col overflow-hidden rounded-md bg-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_0_0_1px_rgba(0,0,0,.05)]">
      <div className="relative aspect-video bg-neutral-900">
        {tocando ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${tutorial.video}?autoplay=1&rel=0`}
            title={tutorial.titulo}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button type="button" onClick={() => setTocando(true)} className="group absolute inset-0 h-full w-full" aria-label={`Assistir: ${tutorial.titulo}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${tutorial.video}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
            />
            <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#CD1C1B] text-white shadow-lg transition-transform group-hover:scale-110">
              <Play size={26} className="ml-1" fill="currentColor" aria-hidden />
            </span>
          </button>
        )}
      </div>
      <div className="p-4 sm:p-5">
        <h3 className="text-base font-bold uppercase leading-snug tracking-wide">{tutorial.titulo}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-600">{tutorial.texto}</p>
      </div>
    </article>
  );
}
