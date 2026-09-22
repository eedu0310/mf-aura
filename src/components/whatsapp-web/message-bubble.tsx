"use client";

import { useState } from "react";
import { Check, CheckCheck, Clock, Download, FileText, ImageOff, MapPin } from "lucide-react";
import { API, formatHour, type WaMessage } from "./types";

function Ticks({ status }: { status?: number }) {
  if (status === undefined) return null;
  if (status <= 1) return <Clock className="h-3.5 w-3.5 text-[#667781]" />;
  if (status === 2) return <Check className="h-4 w-4 text-[#667781]" />;
  return <CheckCheck className={`h-4 w-4 ${status >= 4 ? "text-[#53bdeb]" : "text-[#667781]"}`} />;
}

function linkify(texto: string) {
  const partes = texto.split(/(https?:\/\/[^\s]+)/g);
  return partes.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all text-[#027eb5] hover:underline">
        {p}
      </a>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function Midia({ msg }: { msg: WaMessage }) {
  const [erro, setErro] = useState(false);
  const url = `${API}?media=${encodeURIComponent(msg.id)}`;

  if (erro) {
    return (
      <div className="mb-1 flex items-center gap-2 rounded-md bg-black/5 px-3 py-4 text-sm text-[#667781]">
        <ImageOff className="h-4 w-4" /> Mídia indisponível
      </div>
    );
  }
  switch (msg.type) {
    case "image":
      return (
        <a href={url} target="_blank" rel="noreferrer" className="mb-1 block overflow-hidden rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Foto" loading="lazy" onError={() => setErro(true)} className="max-h-[330px] w-full min-w-[200px] object-cover" />
        </a>
      );
    case "sticker":
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={url} alt="Figurinha" loading="lazy" onError={() => setErro(true)} className="h-32 w-32 object-contain" />;
    case "video":
      return <video src={url} controls preload="metadata" onError={() => setErro(true)} className="mb-1 max-h-[330px] w-full min-w-[220px] rounded-md bg-black" />;
    case "audio":
      return <audio src={url} controls preload="none" onError={() => setErro(true)} className="mb-1 w-[260px] max-w-full" />;
    case "document":
      return (
        <a
          href={`${url}&download=1`}
          className="mb-1 flex min-w-[240px] items-center gap-3 rounded-md bg-black/5 px-3 py-3 hover:bg-black/10"
        >
          <FileText className="h-8 w-8 shrink-0 text-[#e2574c]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-[#111b21]">{msg.fileName ?? "Documento"}</p>
            <p className="text-xs uppercase text-[#667781]">{msg.mimetype?.split("/")[1]?.split(";")[0] ?? "arquivo"}</p>
          </div>
          <Download className="h-5 w-5 shrink-0 text-[#667781]" />
        </a>
      );
    default:
      return null;
  }
}

export function MessageBubble({ msg, primeiraDoGrupo }: { msg: WaMessage; primeiraDoGrupo: boolean }) {
  const sticker = msg.type === "sticker";
  const cor = msg.fromMe ? "bg-[#d9fdd3]" : "bg-white";
  return (
    <div className={`flex ${msg.fromMe ? "justify-end" : "justify-start"} ${primeiraDoGrupo ? "mt-3" : "mt-0.5"} px-[4%] md:px-[7%]`}>
      <div
        className={`relative max-w-[85%] md:max-w-[65%] ${sticker ? "" : `${cor} rounded-lg px-2 pb-1.5 pt-1.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]`} ${
          primeiraDoGrupo && !sticker ? (msg.fromMe ? "rounded-tr-none" : "rounded-tl-none") : ""
        }`}
      >
        {primeiraDoGrupo && !sticker && (
          <span
            aria-hidden
            className={`absolute top-0 h-3 w-2 ${msg.fromMe ? "-right-2 bg-[#d9fdd3]" : "-left-2 bg-white"}`}
            style={{ clipPath: msg.fromMe ? "polygon(0 0, 100% 0, 0 100%)" : "polygon(0 0, 100% 0, 100% 100%)" }}
          />
        )}
        {msg.hasMedia && <Midia msg={msg} />}
        {msg.type === "location" && <MapPin className="mb-1 h-5 w-5 text-[#667781]" />}
        {msg.text && (
          <p className="whitespace-pre-wrap break-words px-1 text-[14.2px] leading-[19px] text-[#111b21]">
            {linkify(msg.text)}
            <span className="inline-block w-[70px]" aria-hidden />
          </p>
        )}
        <div className={`flex items-center justify-end gap-1 ${msg.text ? "-mt-3.5" : ""} px-1`}>
          <span className="text-[11px] text-[#667781]">{formatHour(msg.timestamp)}</span>
          {msg.fromMe && <Ticks status={msg.status} />}
        </div>
      </div>
    </div>
  );
}
