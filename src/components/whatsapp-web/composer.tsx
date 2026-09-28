"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, FileText, Headphones, Image as ImageIcon, Loader2, Mic, Plus, Send, Smile, Sparkles, Trash2, Video, X } from "lucide-react";
import { API, type WaMessage } from "./types";

interface Props {
  chatId: string;
  sugestao: string | null;
  onSent: () => void;
  arquivoArrastado: File | null;
  limparArrastado: () => void;
  respondendo?: WaMessage | null;
  onCancelarResposta?: () => void;
}

/** Como a mensagem citada aparece na barra acima do campo de texto. */
function resumoCitado(msg: WaMessage) {
  if (msg.text) return msg.text;
  switch (msg.type) {
    case "image":
      return "Foto";
    case "video":
      return "Vídeo";
    case "audio":
      return "Mensagem de voz";
    case "document":
      return msg.fileName ?? "Documento";
    case "sticker":
      return "Figurinha";
    default:
      return "Mensagem";
  }
}

function duracaoLegivel(segundos: number) {
  const m = Math.floor(segundos / 60);
  return `${m}:${String(segundos % 60).padStart(2, "0")}`;
}

/** O formato que este navegador consegue gravar. O servidor converte depois. */
function formatoDeGravacao() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const tipo of ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(tipo)) return tipo;
  }
  return null;
}

const EMOJIS = "😀 😃 😄 😁 😅 😂 🙂 😉 😊 😍 🥰 😘 🤩 🤗 🤔 😎 🙏 👍 👎 👏 🙌 🤝 💪 👌 ✌️ 👋 ❤️ 🔥 ✨ 🎉 ✅ ❌ ⭐ 📍 📞 📅 ⏰ 💰 🏠 🪵".split(" ");

export function Composer({
  chatId,
  sugestao,
  onSent,
  arquivoArrastado,
  limparArrastado,
  respondendo,
  onCancelarResposta,
}: Props) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [emojis, setEmojis] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [legenda, setLegenda] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const gravadorRef = useRef<MediaRecorder | null>(null);
  const pedacosRef = useRef<BlobPart[]>([]);
  const cancelouRef = useRef(false);
  const relogioRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTexto("");
    setErro(null);
    setArquivo(null);
    setMenu(false);
    setEmojis(false);
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
        body: JSON.stringify({ action: "send", to: chatId, text: t, quotedId: respondendo?.id ?? null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar");
      setTexto("");
      setEmojis(false);
      onCancelarResposta?.();
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
      if (respondendo?.id) form.append("quotedId", respondendo.id);
      const res = await fetch(API, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar arquivo");
      setArquivo(null);
      setLegenda("");
      setTexto("");
      onCancelarResposta?.();
      onSent();
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao enviar arquivo");
    } finally {
      setEnviando(false);
    }
  }


  // ----------------------------------------------------------- voz
  useEffect(() => {
    return () => {
      if (relogioRef.current) clearInterval(relogioRef.current);
      gravadorRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function comecarAGravar() {
    if (gravando || enviando) return;
    const formato = formatoDeGravacao();
    if (!formato) {
      setErro("Este navegador não grava áudio. Use o Chrome no celular ou no computador.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const gravador = new MediaRecorder(stream, { mimeType: formato });
      pedacosRef.current = [];
      cancelouRef.current = false;
      gravador.ondataavailable = (e) => e.data.size && pedacosRef.current.push(e.data);
      gravador.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (relogioRef.current) clearInterval(relogioRef.current);
        setGravando(false);
        const blob = new Blob(pedacosRef.current, { type: formato });
        pedacosRef.current = [];
        if (cancelouRef.current || blob.size < 1200) return;
        void enviarVoz(blob, formato);
      };
      gravadorRef.current = gravador;
      gravador.start();
      setErro(null);
      setSegundos(0);
      setGravando(true);
      relogioRef.current = setInterval(() => setSegundos((v) => v + 1), 1000);
    } catch {
      // Negar o microfone e uma escolha da pessoa; o recado diz como desfazer.
      setErro("Preciso da permissão do microfone. Libere no cadeado ao lado do endereço e tente de novo.");
    }
  }

  function pararEEnviar() {
    cancelouRef.current = false;
    gravadorRef.current?.stop();
  }

  function cancelarGravacao() {
    cancelouRef.current = true;
    gravadorRef.current?.stop();
    setSegundos(0);
  }

  async function enviarVoz(blob: Blob, formato: string) {
    setEnviando(true);
    setErro(null);
    try {
      const extensao = formato.includes("ogg") ? "ogg" : formato.includes("mp4") ? "m4a" : "webm";
      const form = new FormData();
      form.append("file", new File([blob], `voz.${extensao}`, { type: formato }));
      form.append("to", chatId);
      form.append("ptt", "1");
      if (respondendo?.id) form.append("quotedId", respondendo.id);
      const res = await fetch(API, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar o áudio");
      onCancelarResposta?.();
      onSent();
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao enviar o áudio");
    } finally {
      setEnviando(false);
      setSegundos(0);
    }
  }

  const itensMenu = [
    { label: "Documento", cor: "#7f66ff", icone: <FileText className="h-4 w-4" />, ref: docRef },
    { label: "Fotos e vídeos", cor: "#007bfc", icone: <ImageIcon className="h-4 w-4" />, ref: fotoRef },
    { label: "Câmera", cor: "#ff2e74", icone: <Camera className="h-4 w-4" />, ref: camRef },
    { label: "Gravar vídeo", cor: "#25d366", icone: <Video className="h-4 w-4" />, ref: videoRef },
    { label: "Áudio", cor: "#ff8b1f", icone: <Headphones className="h-4 w-4" />, ref: audioRef },
  ];

  const limparInput = (e: React.MouseEvent<HTMLInputElement>) => ((e.target as HTMLInputElement).value = "");
  const aoEscolher = (e: React.ChangeEvent<HTMLInputElement>) => e.target.files?.[0] && escolher(e.target.files[0]);

  return (
    <>
      {arquivo && (
        <div className="absolute inset-0 z-30 flex flex-col bg-[#0b141a]">
          <div className="flex items-center gap-4 bg-[#202c33] px-4 py-3">
            <button type="button" onClick={() => setArquivo(null)} className="rounded-full p-1 text-[#aebac1] hover:bg-white/10" aria-label="Cancelar">
              <X className="h-6 w-6" />
            </button>
            <p className="truncate text-[#e9edef]">{arquivo.name}</p>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-hidden p-6">
            {previewUrl && arquivo.type.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Prévia" className="max-h-full max-w-full rounded-md object-contain shadow-2xl" />
            ) : previewUrl && arquivo.type.startsWith("video/") ? (
              <video src={previewUrl} controls className="max-h-full max-w-full rounded-md bg-black" />
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-lg bg-[#202c33] px-10 py-8">
                {arquivo.type.startsWith("audio/") ? <Headphones className="h-16 w-16 text-[#ff8b1f]" /> : <FileText className="h-16 w-16 text-[#f15c6d]" />}
                <p className="max-w-xs truncate text-sm text-[#e9edef]">{arquivo.name}</p>
                <p className="text-xs text-[#8696a0]">{(arquivo.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 bg-[#202c33] px-6 py-4">
            {!arquivo.type.startsWith("audio/") && (
              <input
                value={legenda}
                onChange={(e) => setLegenda(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enviarArquivo()}
                placeholder="Adicione uma legenda"
                className="flex-1 rounded-lg bg-[#2a3942] px-4 py-2.5 text-[15px] text-[#e9edef] outline-none placeholder:text-[#8696a0]"
                autoFocus
              />
            )}
            <button
              type="button"
              onClick={enviarArquivo}
              disabled={enviando}
              className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#00a884] text-[#111b21] shadow hover:bg-[#06cf9c] disabled:opacity-60"
              aria-label="Enviar arquivo"
            >
              {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
          {erro && <p className="bg-[#202c33] px-6 pb-3 text-sm text-[#f15c6d]">{erro}</p>}
        </div>
      )}

      <div className="relative z-10 bg-[#202c33] px-3 py-2">
        {sugestao && !texto && (
          <button
            type="button"
            onClick={() => setTexto(sugestao)}
            className="mb-2 flex w-full items-start gap-2 rounded-lg border border-[#00a884]/40 bg-[#111b21] px-3 py-2 text-left text-sm text-[#e9edef] hover:bg-[#0a332c]"
            title="Clique para usar a sugestão"
          >
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#00a884]" />
            <span className="line-clamp-2">
              <span className="font-medium text-[#00a884]">Sugestão da AURA: </span>
              {sugestao}
            </span>
          </button>
        )}
        {respondendo && (
          <div className="mb-2 flex items-stretch gap-2 overflow-hidden rounded-lg bg-[#1d282f]">
            <span aria-hidden className={`w-1 shrink-0 ${respondendo.fromMe ? "bg-[#00a884]" : "bg-[#53bdeb]"}`} />
            <div className="min-w-0 flex-1 py-2">
              <p className={`text-[13px] font-medium ${respondendo.fromMe ? "text-[#00a884]" : "text-[#53bdeb]"}`}>
                {respondendo.fromMe ? "Você" : "Cliente"}
              </p>
              <p className="line-clamp-2 text-[13px] leading-[18px] text-[#8696a0]">{resumoCitado(respondendo)}</p>
            </div>
            <button
              type="button"
              onClick={onCancelarResposta}
              aria-label="Cancelar resposta"
              className="shrink-0 self-start p-2 text-[#8696a0] hover:text-[#e9edef]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {erro && !arquivo && <p className="mb-1 text-sm text-[#f15c6d]">{erro}</p>}

        {emojis && (
          <div className="mb-2 grid grid-cols-10 gap-1 rounded-lg bg-[#111b21] p-2 sm:grid-cols-[repeat(20,minmax(0,1fr))]">
            {EMOJIS.map((em) => (
              <button key={em} type="button" onClick={() => setTexto((t) => t + em)} className="rounded p-1 text-xl hover:bg-white/10">
                {em}
              </button>
            ))}
          </div>
        )}

        {gravando ? (
          <div className="flex items-center gap-3 py-1">
            <button
              type="button"
              onClick={cancelarGravacao}
              aria-label="Descartar gravação"
              title="Descartar"
              className="rounded-full p-2 text-[#f15c6d] transition hover:bg-white/10"
            >
              <Trash2 className="h-6 w-6" />
            </button>
            <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-[#f15c6d]" aria-hidden />
            <span className="tabular-nums text-[15px] text-[#e9edef]">{duracaoLegivel(segundos)}</span>
            <span className="flex-1 text-sm text-[#8696a0]">Gravando… toque no verde para enviar</span>
            <button
              type="button"
              onClick={pararEEnviar}
              aria-label="Enviar mensagem de voz"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#00a884] text-[#111b21] shadow hover:bg-[#06cf9c]"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        ) : (
        <div className="flex items-end gap-1">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              className={`rounded-full p-2 text-[#aebac1] transition hover:bg-white/10 ${menu ? "rotate-45 bg-white/10" : ""}`}
              aria-label="Anexar"
            >
              <Plus className="h-6 w-6" />
            </button>
            {menu && (
              <div className="absolute bottom-12 left-0 w-56 overflow-hidden rounded-xl bg-[#233138] py-2 shadow-2xl">
                {itensMenu.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => item.ref.current?.click()}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-[15px] text-[#e9edef] hover:bg-[#182229]"
                  >
                    <span style={{ color: item.cor }}>{item.icone}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            )}
            <input ref={fotoRef} type="file" accept="image/*,video/*" hidden onChange={aoEscolher} onClick={limparInput} />
            <input ref={docRef} type="file" hidden onChange={aoEscolher} onClick={limparInput} />
            <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={aoEscolher} onClick={limparInput} />
            {/* capture="environment" abre a camera do celular direto na gravacao.
                No computador, vira um seletor de arquivo — que e o certo la. */}
            <input ref={videoRef} type="file" accept="video/*" capture="environment" hidden onChange={aoEscolher} onClick={limparInput} />
            <input ref={audioRef} type="file" accept="audio/*" hidden onChange={aoEscolher} onClick={limparInput} />
          </div>
          <button type="button" onClick={() => setEmojis((v) => !v)} className={`rounded-full p-2 transition hover:bg-white/10 ${emojis ? "text-[#00a884]" : "text-[#aebac1]"}`} aria-label="Emojis">
            <Smile className="h-6 w-6" />
          </button>
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
            className="mx-1 max-h-[140px] flex-1 resize-none rounded-lg bg-[#2a3942] px-3 py-[9px] text-[15px] leading-5 text-[#e9edef] outline-none placeholder:text-[#8696a0]"
          />
          {texto.trim() ? (
            <button
              type="button"
              onClick={enviarTexto}
              disabled={enviando}
              className="rounded-full p-2 text-[#aebac1] transition hover:bg-white/10 disabled:opacity-40"
              aria-label="Enviar"
            >
              {enviando ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-6 w-6" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={comecarAGravar}
              disabled={enviando}
              className="rounded-full p-2 text-[#aebac1] transition hover:bg-white/10 disabled:opacity-40"
              aria-label="Gravar mensagem de voz"
              title="Gravar mensagem de voz"
            >
              {enviando ? <Loader2 className="h-6 w-6 animate-spin" /> : <Mic className="h-6 w-6" />}
            </button>
          )}
        </div>
        )}
      </div>
    </>
  );
}
