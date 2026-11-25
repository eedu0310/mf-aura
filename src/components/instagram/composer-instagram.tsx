"use client";

/**
 * O campo de resposta do direct do Instagram, como no Meta Business Suite:
 * texto com emoji, foto, GIF ou vídeo (com legenda), áudio gravado na hora,
 * a figurinha de coração e "responder" citando uma mensagem do cliente.
 *
 * O que a API do Instagram NÃO deixa uma empresa fazer, e por isso não tem
 * aqui: editar ou apagar mensagem já enviada, figurinhas além do coração,
 * busca de GIFs do próprio Instagram e ligação.
 *
 * A foto, o vídeo e o áudio vão para o servidor, que guarda o arquivo num
 * endereço público e manda para a Meta. O áudio é convertido para M4A no
 * servidor, o formato que o Instagram toca.
 */
import { useEffect, useRef, useState } from "react";
import { Heart, Loader2, Mic, Paperclip, Reply, Send, Smile, Square, Trash2, X } from "lucide-react";

const EMOJIS = "😀 😃 😄 😁 😅 😂 🙂 😉 😊 😍 🥰 😘 🤩 🤗 🤔 😎 🙏 👍 👏 🙌 🤝 💪 👌 ✌️ 👋 ❤️ 🔥 ✨ 🎉 ✅ ⭐ 📍 📞 📅 ⏰ 🏠 🪵 ❄️ ☕".split(" ");

function formatoDeGravacao() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const tipo of ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(tipo)) return tipo;
  }
  return null;
}

const relogio = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const LIMITE_MB = 25;

export function ComposerInstagram({
  conversa,
  empresa,
  onEnviado,
  respondendo,
  onCancelarResposta,
}: {
  conversa: string;
  empresa: string | null;
  onEnviado: () => void;
  respondendo?: { id: string; texto: string } | null;
  onCancelarResposta?: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [emojis, setEmojis] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [andamento, setAndamento] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const gravadorRef = useRef<MediaRecorder | null>(null);
  const pedacosRef = useRef<Blob[]>([]);
  const cancelouRef = useRef(false);
  const relogioRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Trocou de conversa: começa limpo.
  useEffect(() => {
    setTexto("");
    setArquivo(null);
    setErro(null);
    setEmojis(false);
  }, [conversa]);

  useEffect(() => {
    if (!arquivo || !arquivo.type.startsWith("image/")) {
      setPrevia(null);
      return;
    }
    const url = URL.createObjectURL(arquivo);
    setPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  useEffect(
    () => () => {
      if (relogioRef.current) clearInterval(relogioRef.current);
      gravadorRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  function porEmoji(em: string) {
    const el = campoRef.current;
    if (!el) {
      setTexto((t) => t + em);
      return;
    }
    const ini = el.selectionStart ?? texto.length;
    const fim = el.selectionEnd ?? texto.length;
    const novo = texto.slice(0, ini) + em + texto.slice(fim);
    setTexto(novo);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ini + em.length, ini + em.length);
    });
  }

  async function enviarArquivo(f: File, legenda: string) {
    if (f.size > LIMITE_MB * 1024 * 1024) {
      throw new Error(`Arquivo grande demais (${(f.size / 1048576).toFixed(0)} MB). O Instagram aceita até ${LIMITE_MB} MB: corte o vídeo e tente de novo.`);
    }
    setAndamento(
      f.type.startsWith("video/")
        ? "Preparando o vídeo para o Instagram… pode levar até um minuto."
        : f.type.startsWith("audio/")
          ? "Enviando o áudio…"
          : "Enviando…",
    );
    const form = new FormData();
    form.append("conversa", conversa);
    if (empresa) form.append("empresa", empresa);
    form.append("arquivo", f);
    if (legenda) form.append("texto", legenda);
    try {
      const res = await fetch("/api/meta/live", { method: "POST", body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.erro ?? (res.status === 413 ? `Arquivo grande demais (máximo ${LIMITE_MB} MB).` : "Não consegui enviar o arquivo."));
    } finally {
      setAndamento(null);
    }
  }

  async function mandarCoracao() {
    if (enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch("/api/meta/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "figurinha", conversa, empresa }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.erro ?? "Não consegui mandar a figurinha.");
      onEnviado();
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui mandar a figurinha.");
    } finally {
      setEnviando(false);
    }
  }

  async function enviar() {
    const t = texto.trim();
    if ((!t && !arquivo) || enviando) return;
    setEnviando(true);
    setErro(null);
    setEmojis(false);
    try {
      if (arquivo) {
        await enviarArquivo(arquivo, t);
        setArquivo(null);
      } else {
        const res = await fetch("/api/meta/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acao: "responder", conversa, texto: t, empresa, responder_a: respondendo?.id ?? null }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.erro ?? "Não consegui enviar.");
      }
      setTexto("");
      onCancelarResposta?.();
      onEnviado();
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui enviar.");
    } finally {
      setEnviando(false);
    }
  }

  async function comecarAGravar() {
    if (gravando || enviando) return;
    const formato = formatoDeGravacao();
    if (!formato) {
      setErro("Este navegador não grava áudio. Use o Chrome.");
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
        const ext = formato.includes("ogg") ? "ogg" : formato.includes("mp4") ? "m4a" : "webm";
        setEnviando(true);
        setErro(null);
        enviarArquivo(new File([blob], `audio.${ext}`, { type: formato }), "")
          .then(onEnviado)
          .catch((e) => setErro(e?.message ?? "Não consegui enviar o áudio."))
          .finally(() => setEnviando(false));
      };
      gravadorRef.current = gravador;
      gravador.start();
      setErro(null);
      setSegundos(0);
      setGravando(true);
      relogioRef.current = setInterval(() => setSegundos((v) => v + 1), 1000);
    } catch {
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

  const botao =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-graphite disabled:opacity-40 sm:h-10 sm:w-10";

  return (
    <div className="relative border-t border-aura-mist bg-aura-surface p-2.5 sm:p-3">
      {erro && (
        <p className="mb-2 rounded-lg border border-aura-danger/25 bg-aura-danger/10 px-3 py-1.5 text-xs text-aura-danger">
          {erro}
        </p>
      )}
      {andamento && (
        <p className="mb-2 flex items-center gap-2 rounded-lg bg-aura-sunken px-3 py-1.5 text-xs text-aura-graphite-soft">
          <Loader2 size={12} className="animate-spin text-aura-petrol-600" /> {andamento}
        </p>
      )}
      {respondendo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-aura-petrol-500 bg-aura-sunken px-3 py-1.5 text-xs">
          <Reply size={12} className="shrink-0 text-aura-petrol-600" />
          <span className="min-w-0 flex-1 truncate text-aura-graphite">
            Respondendo: <span className="text-aura-graphite-soft">{respondendo.texto || "mensagem"}</span>
          </span>
          <button type="button" onClick={onCancelarResposta} className="rounded-md p-1 text-aura-graphite-soft hover:bg-aura-surface hover:text-aura-graphite" aria-label="Cancelar a resposta">
            <X size={12} />
          </button>
        </div>
      )}

      {emojis && (
        <div className="absolute bottom-full left-2.5 z-10 mb-2 grid w-72 max-w-[calc(100%-1.25rem)] grid-cols-8 gap-1 rounded-xl border border-aura-mist bg-aura-surface p-2 shadow-lg">
          {EMOJIS.map((em) => (
            <button key={em} type="button" onClick={() => porEmoji(em)} className="rounded-md p-1 text-xl hover:bg-aura-sunken" aria-label={`Emoji ${em}`}>
              {em}
            </button>
          ))}
        </div>
      )}

      {arquivo && (
        <div className="mb-2 flex items-center gap-3 rounded-lg border border-aura-mist bg-aura-sunken p-2">
          {previa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previa} alt="" className="h-14 w-14 rounded-md object-cover" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-md border border-aura-mist bg-aura-surface text-xs text-aura-graphite-soft">
              {arquivo.type.startsWith("video/") ? "Vídeo" : "Arquivo"}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-xs text-aura-graphite">{arquivo.name}</span>
          <button type="button" onClick={() => setArquivo(null)} className={botao} aria-label="Tirar o arquivo">
            <X size={16} />
          </button>
        </div>
      )}

      {gravando ? (
        <div className="flex items-center gap-2">
          <button type="button" onClick={cancelarGravacao} className={botao} aria-label="Cancelar a gravação">
            <Trash2 size={18} />
          </button>
          <span className="flex flex-1 items-center gap-2 text-sm font-medium tabular-nums text-aura-danger">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-aura-danger" aria-hidden />
            Gravando {relogio(segundos)}
          </span>
          <button
            type="button"
            onClick={pararEEnviar}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-aura-petrol-600 text-white shadow-sm transition hover:bg-aura-petrol-700 sm:h-10 sm:w-10"
            aria-label="Parar e enviar o áudio"
          >
            <Square size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-1 sm:gap-1.5">
          <button type="button" onClick={() => setEmojis((v) => !v)} className={botao} aria-label="Emojis" aria-expanded={emojis}>
            <Smile size={20} />
          </button>
          <button type="button" onClick={() => arquivoRef.current?.click()} className={botao} aria-label="Mandar foto, GIF ou vídeo" title="Foto, GIF ou vídeo" disabled={enviando}>
            <Paperclip size={19} />
          </button>
          <button type="button" onClick={() => void mandarCoracao()} className={`${botao} hover:text-aura-danger`} aria-label="Mandar figurinha de coração" title="Figurinha ❤️" disabled={enviando}>
            <Heart size={19} />
          </button>
          <input
            ref={arquivoRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setArquivo(f);
              e.target.value = "";
            }}
          />
          <textarea
            ref={campoRef}
            rows={1}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void enviar();
              }
            }}
            onPaste={(e) => {
              const f = Array.from(e.clipboardData.files ?? []).find((x) => x.type.startsWith("image/"));
              // Só vira anexo quando não veio texto junto (texto ganha, como no WhatsApp).
              if (f && !e.clipboardData.getData("text")) {
                e.preventDefault();
                setArquivo(f);
              }
            }}
            placeholder={arquivo ? "Legenda (opcional)…" : "Responder…"}
            aria-label="Mensagem"
            className="aura-input max-h-32 min-h-9 min-w-0 flex-1 resize-none sm:min-h-10"
          />
          <button
            type="button"
            onClick={() => void comecarAGravar()}
            disabled={enviando}
            aria-label="Gravar áudio"
            title="Gravar áudio"
            className={botao}
          >
            <Mic size={19} />
          </button>
          <button
            type="button"
            onClick={() => void enviar()}
            disabled={enviando || (!texto.trim() && !arquivo)}
            aria-label="Enviar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aura-petrol-600 text-white shadow-sm transition enabled:hover:bg-aura-petrol-700 disabled:opacity-40 sm:h-10 sm:w-10"
          >
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      )}
    </div>
  );
}
