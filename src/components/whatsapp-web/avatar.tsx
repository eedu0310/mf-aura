"use client";

import { useState } from "react";
import { API } from "./types";

const CORES = ["#00a884", "#53bdeb", "#ffbc38", "#ff7eb6", "#a791ff", "#02735e", "#e26b4b", "#1fa2a6"];

function iniciais(nome: string) {
  const limpo = nome.replace(/[^\p{L}\s]/gu, "").trim();
  if (!limpo) return "";
  const partes = limpo.split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ jid, name, size = 49 }: { jid?: string | null; name: string; size?: number }) {
  const [erro, setErro] = useState(false);
  const texto = iniciais(name);
  const cor = CORES[Math.abs([...(jid ?? name)].reduce((a, c) => a + c.charCodeAt(0), 0)) % CORES.length];

  if (jid && !erro) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`${API}?avatar=${encodeURIComponent(jid)}`}
        alt={name}
        loading="lazy"
        onError={() => setErro(true)}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full bg-[#dfe5e7] object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, backgroundColor: texto ? cor : "#dfe5e7", fontSize: size * 0.38 }}
      className="flex shrink-0 items-center justify-center rounded-full font-medium text-white"
    >
      {texto || (
        <svg viewBox="0 0 212 212" width={size} height={size} aria-hidden>
          <path fill="#dfe5e7" d="M106 0C47.5 0 0 47.5 0 106s47.5 106 106 106 106-47.5 106-106S164.5 0 106 0z" />
          <path fill="#fff" d="M173.6 180.7c-7.5-24-31.8-39.7-67.6-39.7s-60.1 15.7-67.6 39.7c18 17.1 42.3 27.3 67.6 27.3s49.6-10.2 67.6-27.3zM106 128c20.4 0 37-16.6 37-37s-16.6-37-37-37-37 16.6-37 37 16.6 37 37 37z" />
        </svg>
      )}
    </div>
  );
}
