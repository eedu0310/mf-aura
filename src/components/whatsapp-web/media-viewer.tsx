"use client";

import { useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { Avatar } from "./avatar";
import { mediaUrl } from "./message-bubble";
import type { WaMessage } from "./types";

interface Props {
  mensagens: WaMessage[];
  abertoId: string;
  onTrocar: (id: string) => void;
  onFechar: () => void;
  contatoJid: string | null;
  contatoNome: string;
  meuJid: string | null;
  meuNome: string;
}

/** Visualizador de fotos/vídeos dentro do app — igual ao do WhatsApp Web. */
export function MediaViewer({ mensagens, abertoId, onTrocar, onFechar, contatoJid, contatoNome, meuJid, meuNome }: Props) {
  const midias = useMemo(() => mensagens.filter((m) => m.type === "image" || m.type === "video"), [mensagens]);
  const idx = Math.max(0, midias.findIndex((m) => m.id === abertoId));
  const atual = midias[idx];

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
      if (e.key === "ArrowLeft" && idx > 0) onTrocar(midias[idx - 1].id);
      if (e.key === "ArrowRight" && idx < midias.length - 1) onTrocar(midias[idx + 1].id);
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [idx, midias, onFechar, onTrocar]);

  if (!atual) return null;
  const quando = new Date(atual.timestamp).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0b141a]/[0.97]" onClick={onFechar}>
      <header className="flex h-[60px] shrink-0 items-center justify-between px-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <Avatar jid={atual.fromMe ? meuJid : contatoJid} name={atual.fromMe ? meuNome : contatoNome} size={40} />
          <div>
            <p className="text-[15px] text-[#e9edef]">{atual.fromMe ? "Você" : contatoNome}</p>
            <p className="text-xs text-[#8696a0]">{quando}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[#aebac1]">
          <a href={`${mediaUrl(atual.id)}&download=1`} className="rounded-full p-2 hover:bg-white/10" title="Baixar" download>
            <Download className="h-6 w-6" />
          </a>
          <button type="button" onClick={onFechar} className="rounded-full p-2 hover:bg-white/10" title="Fechar (Esc)">
            <X className="h-6 w-6" />
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-16 py-4">
        {idx > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTrocar(midias[idx - 1].id);
            }}
            className="absolute left-4 rounded-full bg-[#202c33] p-2 text-[#aebac1] hover:bg-[#2a3942]"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        )}
        <div className="flex max-h-full max-w-full flex-col items-center" onClick={(e) => e.stopPropagation()}>
          {atual.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={atual.id} src={mediaUrl(atual.id)} alt="Foto" className="max-h-[calc(100dvh-210px)] max-w-full object-contain shadow-2xl" />
          ) : (
            <video key={atual.id} src={mediaUrl(atual.id)} controls autoPlay className="max-h-[calc(100dvh-210px)] max-w-full bg-black shadow-2xl" />
          )}
          {atual.text && <p className="mt-3 max-w-2xl text-center text-[15px] text-[#e9edef]">{atual.text}</p>}
        </div>
        {idx < midias.length - 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTrocar(midias[idx + 1].id);
            }}
            className="absolute right-4 rounded-full bg-[#202c33] p-2 text-[#aebac1] hover:bg-[#2a3942]"
            aria-label="Próxima"
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        )}
      </div>

      {midias.length > 1 && (
        <div className="flex h-[90px] shrink-0 items-center justify-center gap-2 overflow-x-auto border-t border-[#222d34] px-4" onClick={(e) => e.stopPropagation()}>
          {midias.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onTrocar(m.id)}
              className={`h-[62px] w-[62px] shrink-0 overflow-hidden rounded ${m.id === atual.id ? "ring-4 ring-[#00a884]" : "opacity-60 hover:opacity-100"}`}
            >
              {m.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(m.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <video src={`${mediaUrl(m.id)}#t=0.5`} preload="metadata" muted className="h-full w-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
