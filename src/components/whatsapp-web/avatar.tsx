"use client";

import { useEffect, useState } from "react";
import { API } from "./types";

// Cache compartilhado: cada foto é pedida uma vez só por sessão da página.
const cache = new Map<string, Promise<string | null>>();

function buscarFoto(jid: string) {
  let p = cache.get(jid);
  if (!p) {
    p = fetch(`${API}?avatar=${encodeURIComponent(jid)}`)
      .then((r) => (r.ok ? r.json() : { url: null }))
      .then((d) => (d?.url as string) ?? null)
      .catch(() => null);
    cache.set(jid, p);
  }
  return p;
}

const CORES = ["#00a884", "#53bdeb", "#ffbc38", "#ff7eb6", "#a791ff", "#02735e", "#e26b4b", "#1fa2a6"];

function iniciais(nome: string) {
  const limpo = nome.replace(/[^\p{L}\s]/gu, "").trim();
  if (!limpo || limpo === "Contato") return "";
  const partes = limpo.split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

export function Avatar({ jid, name, size = 49 }: { jid?: string | null; name: string; size?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    setUrl(null);
    setErro(false);
    if (jid) buscarFoto(jid).then((u) => vivo && setUrl(u));
    return () => {
      vivo = false;
    };
  }, [jid]);

  if (url && !erro) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setErro(true)}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full bg-[#6b7c85] object-cover"
      />
    );
  }

  const texto = iniciais(name);
  const cor = CORES[Math.abs([...(jid ?? name)].reduce((a, c) => a + c.charCodeAt(0), 0)) % CORES.length];
  return (
    <div
      style={{ width: size, height: size, backgroundColor: texto ? "#103529" : "#6b7c85", color: cor, fontSize: size * 0.38 }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium"
    >
      {texto || (
        <svg viewBox="0 0 212 212" width={size} height={size} aria-hidden>
          <path fill="#6b7c85" d="M106 0C47.5 0 0 47.5 0 106s47.5 106 106 106 106-47.5 106-106S164.5 0 106 0z" />
          <path fill="#cfd4d6" d="M173.6 180.7c-7.5-24-31.8-39.7-67.6-39.7s-60.1 15.7-67.6 39.7c18 17.1 42.3 27.3 67.6 27.3s49.6-10.2 67.6-27.3zM106 128c20.4 0 37-16.6 37-37s-16.6-37-37-37-37 16.6-37 37 16.6 37 37 37z" />
        </svg>
      )}
    </div>
  );
}
