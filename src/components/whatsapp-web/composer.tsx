"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Loader2, Paperclip, Send, Sparkles, X } from "lucide-react";
import { API } from "./types";

interface Props {
  chatId: string;
  sugestao: string | null;
  onSent: () => void;
  arquivoArrastado: File | null;
  limparArrastado: () => void;
}

export function Composer({ chatId, sugestao, onSent, arquivoArrastado, limparArrastado }: Props) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [legenda, setLegenda] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTexto("");
    setErro(null);
    setArquivo(null);
  }, [chatId]);

  useEffect(() => {
    if (arquivoArrastado) {
      escolher(arquivoArrastado);
      limparArrastado();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivoArrastado]);

  useEffect(() => {
    if (!arquivo || !(arquivo.type.startsWith("image/") || arquivo.type.startsWith("video/"))) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(arquivo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  // Textarea cresce com o texto, como no WhatsApp Web.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [texto]);

  function escolher(f: File) {
    setArquivo(f);
    setLegenda(texto);
    setMenu(false);
    setErro(null);
  }

  async function enviarTexto() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", to: chatId, text: t }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar");
      setTexto("");
      onSent();
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao enviar");
    } finally {
      setEnviando(false);
    }
  }

  async function enviarArquivo() {
    if (!arquivo || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const form = new FormData();
      form.append("file", arquivo);
      form.append("to", chatId);
      if (legenda.trim()) form.append("caption", legenda.trim());
      const res = await fetch(API, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar arquivo");
      setArquivo(null);
      setLegenda("");
      setTexto("");
      onSent();
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao enviar arquivo");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      {/* Pré-visualização do anexo (igual ao WhatsApp Web) */}
      {arquivo && (
        <div className="absolute inset-0 z-30 flex flex-col bg-[#e9edef]">
          <div className="flex items-center gap-4 bg-[#f0f2f5] px-4 py-3">
            <button type="button" onClick={() => setArquivo(null)} className="rounded-full p-1 text-[#54656f] hover:bg-black/5" aria-label="Cancelar">
              <X className="h-6 w-6" />
            </button>
            <p className="truncate text-[#111b21]">{arquivo.name}</p>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-hidden p-6">
            {previewUrl && arquivo.type.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Prévia" className="max-h-full max-w-full rounded-md object-contain shadow" />
            ) : previewUrl && arquivo.type.startsWith("video/") ? (
              <video src={previewUrl} controls className="max-h-full max-w-full rounded-md bg-black" />
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-lg bg-white px-10 py-8 shadow">
                <FileText className="h-16 w-16 text-[#e2574c]" />
                <p className="max-w-xs truncate text-sm text-[#111b21]">{arquivo.name}</p>
                <p className="text-xs text-[#667781]">{(arquivo.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 bg-[#f0f2f5] px-6 py-4">
            {!arquivo.type.startsWith("audio/") && (
              <input
                value={legenda}
                onChange={(e) => setLegenda(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enviarArquivo()}
                placeholder="Adicione uma legenda"
                className="flex-1 rounded-lg bg-white px-4 py-2.5 text-[15px] text-[#111b21] outline-none placeholder:text-[#667781]"
                autoFocus
              />
            )}
            <button
              type="button"
              onClick={enviarArquivo}
              disabled={enviando}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00a884] text-white shadow hover:bg-[#06cf9c] disabled:opacity-60"
              aria-label="Enviar arquivo"
            >
              {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
          {erro && <p className="bg-[#f0f2f5] px-6 pb-3 text-sm text-red-600">{erro}</p>}
        </div>
      )}

      <div className="relative z-10 bg-[#f0f2f5] px-4 py-2.5">
        {sugestao && !texto && (
          <button
            type="button"
            onClick={() => setTexto(sugestao)}
            className="mb-2 flex w-full items-start gap-2 rounded-lg border border-[#00a884]/30 bg-white px-3 py-2 text-left text-sm text-[#111b21] shadow-sm hover:bg-[#f7fdfb]"
            title="Clique para usar a sugestão"
          >
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#00a884]" />
            <span className="line-clamp-2">
              <span className="font-medium text-[#008069]">Sugestão da AURA: </span>
              {sugestao}
            </span>
          </button>
        )}
        {erro && !arquivo && <p className="mb-1 text-sm text-red-600">{erro}</p>}
        <div className="flex items-end gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              className={`rounded-full p-2 text-[#54656f] transition hover:bg-black/5 ${menu ? "rotate-45 bg-black/5" : ""}`}
              aria-label="Anexar"
            >
              <Paperclip className="h-6 w-6" />
            </button>
            {menu && (
              <div className="absolute bottom-12 left-0 w-56 overflow-hidden rounded-xl bg-white py-2 shadow-xl">
                <button type="button" onClick={() => docRef.current?.click()} className="flex w-full items-center gap-3 px-4 py-2.5 text-[15px] text-[#111b21] hover:bg-[#f5f6f6]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7f66ff]"><FileText className="h-4 w-4 text-white" /></span>
                  Documento
                </button>
                <button type="button" onClick={() => fotoRef.current?.click()} className="flex w-full items-center gap-3 px-4 py-2.5 text-[15px] text-[#111b21] hover:bg-[#f5f6f6]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#007bfc]"><ImageIcon className="h-4 w-4 text-white" /></span>
                  Fotos e vídeos
                </button>
              </div>
            )}
            <input ref={fotoRef} type="file" accept="image/*,video/*" hidden onChange={(e) => e.target.files?.[0] && escolher(e.target.files[0])} onClick={(e) => ((e.target as HTMLInputElement).value = "")} />
            <input ref={docRef} type="file" hidden onChange={(e) => e.target.files?.[0] && escolher(e.target.files[0])} onClick={(e) => ((e.target as HTMLInputElement).value = "")} />
          </div>
          <textarea
            ref={areaRef}
            rows={1}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviarTexto();
              }
            }}
            onPaste={(e) => {
              const f = Array.from(e.clipboardData.files)[0];
              if (f) {
                e.preventDefault();
                escolher(f);
              }
            }}
            placeholder="Digite uma mensagem"
            className="max-h-[140px] flex-1 resize-none rounded-lg bg-white px-3 py-[9px] text-[15px] leading-5 text-[#111b21] outline-none placeholder:text-[#667781]"
          />
          <button
            type="button"
            onClick={enviarTexto}
            disabled={enviando || !texto.trim()}
            className="rounded-full p-2 text-[#54656f] transition hover:bg-black/5 disabled:opacity-40"
            aria-label="Enviar"
          >
            {enviando ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-6 w-6" />}
          </button>
        </div>
      </div>
    </>
  );
}
