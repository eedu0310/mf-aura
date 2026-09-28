"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Check, CheckCheck, Clock, Download, FileText, ImageOff, MapPin, Mic, Pause, Play, Reply } from "lucide-react";
import { Avatar } from "./avatar";
import { API, formatHour, type WaMessage, type WaQuote } from "./types";

export const mediaUrl = (id: string) => `${API}?media=${encodeURIComponent(id)}`;

function Ticks({ status }: { status?: number }) {
  if (status === undefined) return null;
  if (status <= 1) return <Clock className="h-3.5 w-3.5 text-[#ffffff99]" />;
  if (status === 2) return <Check className="h-4 w-4 text-[#ffffff99]" />;
  return <CheckCheck className={`h-4 w-4 ${status >= 4 ? "text-[#53bdeb]" : "text-[#ffffff99]"}`} />;
}

/**
 * Telefone escrito no meio do texto.
 *
 * O cliente manda "o contato dele e 51995068865" e o vendedor tinha que
 * copiar, abrir "Nova conversa" e colar. Reconhecendo o numero ali mesmo,
 * um toque ja abre a conversa.
 *
 * Aceita de 10 a 13 digitos (fixo com DDD ate celular com o 55 na frente),
 * com ou sem espaco, parenteses, ponto ou traco. CPF e CNPJ escritos do
 * jeito deles ficam de fora — CPF tem os mesmos 11 digitos de um celular,
 * e so a pontuacao os separa.
 */
const TELEFONE = /(\+?\(?\d[\d\s().-]{8,16}\d)/g;
const CPF_OU_CNPJ = /^\d{2,3}\.\d{3}\.\d{3}([/-]\d{2,4})?-?\d{0,2}$/;

export function ehTelefone(trecho: string) {
  const t = trecho.trim();
  if (CPF_OU_CNPJ.test(t)) return false;
  const digitos = t.replace(/\D/g, "");
  if (digitos.length < 10 || digitos.length > 13) return false;
  if (digitos.length === 13 && !digitos.startsWith("55")) return false;
  if (digitos.length === 12 && !digitos.startsWith("55") && !/^\d{2}\d{10}$/.test(digitos)) return false;
  return true;
}

function linkify(texto: string, onAbrirNumero?: (numero: string) => void) {
  return texto.split(/(https?:\/\/[^\s]+)/g).flatMap((parte, i) => {
    if (/^https?:\/\//.test(parte)) {
      return [
        <a key={`l${i}`} href={parte} target="_blank" rel="noreferrer" className="break-all text-[#53bdeb] hover:underline">
          {parte}
        </a>,
      ];
    }
    return parte.split(TELEFONE).map((trecho, j) => {
      const chave = `${i}-${j}`;
      if (onAbrirNumero && trecho && ehTelefone(trecho)) {
        return (
          <button
            key={`t${chave}`}
            type="button"
            onClick={() => onAbrirNumero(trecho.replace(/\D/g, ""))}
            title="Abrir conversa com este número"
            className="font-medium text-[#53bdeb] underline decoration-dotted underline-offset-2 hover:text-[#8ad4f5]"
          >
            {trecho}
          </button>
        );
      }
      return <span key={`s${chave}`}>{trecho}</span>;
    });
  });
}

function fmtSeg(s: number) {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

// Barras "de onda" fixas por mensagem (visual igual à nota de voz do WhatsApp).
function barras(id: string) {
  let seed = [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
  return Array.from({ length: 38 }, () => {
    seed = (seed * 16807) % 2147483647;
    return 25 + (seed % 75);
  });
}

function NotaDeVoz({ msg, avatarJid, avatarNome }: { msg: WaMessage; avatarJid: string | null; avatarNome: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [atual, setAtual] = useState(0);
  const [duracao, setDuracao] = useState(0);
  const [erro, setErro] = useState(false);
  // As barras são sempre as mesmas para a mesma mensagem, então basta calcular
  // uma vez por id — ler .current durante a renderização é proibido pelo React.
  const ondas = useMemo(() => barras(msg.id), [msg.id]);
  const progresso = duracao ? atual / duracao : 0;

  useEffect(() => () => ref.current?.pause(), []);

  function alternar() {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      document.querySelectorAll("audio").forEach((el) => el !== a && el.pause());
      a.play().catch(() => setErro(true));
    } else a.pause();
  }

  function pular(e: React.MouseEvent<HTMLDivElement>) {
    const a = ref.current;
    if (!a || !duracao) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - r.left) / r.width) * duracao;
  }

  return (
    <div className="flex w-[300px] max-w-full items-center gap-3 py-1 pl-1 pr-2">
      <div className="relative">
        <Avatar jid={avatarJid} name={avatarNome} size={52} />
        <Mic className={`absolute -bottom-0.5 -right-1 h-5 w-5 ${msg.fromMe ? "text-[#53bdeb]" : "text-[#00a884]"}`} />
      </div>
      <button type="button" onClick={alternar} disabled={erro} className="text-[#aebac1] disabled:opacity-40" aria-label={tocando ? "Pausar" : "Tocar"}>
        {tocando ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
      </button>
      <div className="flex-1">
        <div className="relative flex h-7 cursor-pointer items-center gap-[2px]" onClick={pular}>
          {ondas.map((h, i) => (
            <span
              key={i}
              style={{ height: `${h}%` }}
              className={`w-[3px] rounded-full ${i / ondas.length <= progresso ? (msg.fromMe ? "bg-[#53bdeb]" : "bg-[#00a884]") : "bg-[#ffffff4d]"}`}
            />
          ))}
        </div>
        <p className="mt-0.5 text-[11px] text-[#ffffff99]">{erro ? "Áudio indisponível" : fmtSeg(tocando || atual ? atual : duracao)}</p>
      </div>
      <audio
        ref={ref}
        src={mediaUrl(msg.id)}
        preload="metadata"
        onLoadedMetadata={(e) => setDuracao(e.currentTarget.duration)}
        onTimeUpdate={(e) => setAtual(e.currentTarget.currentTime)}
        onPlay={() => setTocando(true)}
        onPause={() => setTocando(false)}
        onEnded={() => {
          setTocando(false);
          setAtual(0);
        }}
        onError={() => setErro(true)}
        hidden
      />
    </div>
  );
}

function Midia({ msg, onAbrir }: { msg: WaMessage; onAbrir: () => void }) {
  const [erro, setErro] = useState(false);
  const url = mediaUrl(msg.id);

  if (erro) {
    return (
      <div className="mb-1 flex items-center gap-2 rounded-md bg-black/20 px-3 py-4 text-sm text-[#8696a0]">
        <ImageOff className="h-4 w-4" /> Mídia indisponível
      </div>
    );
  }
  switch (msg.type) {
    case "image":
      return (
        <button type="button" onClick={onAbrir} className="mb-1 block overflow-hidden rounded-md" aria-label="Abrir foto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Foto" loading="lazy" onError={() => setErro(true)} className="max-h-[330px] w-full min-w-[220px] object-cover" />
        </button>
      );
    case "sticker":
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={url} alt="Figurinha" loading="lazy" onError={() => setErro(true)} className="h-36 w-36 object-contain" />;
    case "video":
      return (
        <button type="button" onClick={onAbrir} className="relative mb-1 block overflow-hidden rounded-md bg-black" aria-label="Abrir vídeo">
          <video src={`${url}#t=0.5`} preload="metadata" muted onError={() => setErro(true)} className="max-h-[330px] w-full min-w-[240px]" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50">
              <Play className="h-7 w-7 fill-white text-white" />
            </span>
          </span>
        </button>
      );
    case "document":
      return (
        <a href={`${url}&download=1`} className="mb-1 flex min-w-[240px] items-center gap-3 rounded-md bg-black/20 px-3 py-3 hover:bg-black/30">
          <FileText className="h-9 w-9 shrink-0 text-[#f15c6d]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-[#e9edef]">{msg.fileName ?? "Documento"}</p>
            <p className="text-xs uppercase text-[#8696a0]">{msg.mimetype?.split("/")[1]?.split(";")[0] ?? "arquivo"}</p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#8696a0]/50">
            <Download className="h-4 w-4 text-[#8696a0]" />
          </span>
        </a>
      );
    default:
      return null;
  }
}

/** Resumo de uma mídia citada, já que a citação não traz o arquivo. */
function resumoDaCitacao(q: WaQuote) {
  if (q.text) return q.text;
  switch (q.type) {
    case "image":
      return "Foto";
    case "video":
      return "Vídeo";
    case "audio":
      return "Mensagem de voz";
    case "document":
      return "Documento";
    case "sticker":
      return "Figurinha";
    default:
      return "Mensagem";
  }
}

/** O bloco cinza que o WhatsApp mostra acima do texto, com a mensagem citada. */
function Citacao({ quote, nomeDoOutro, onIr }: { quote: WaQuote; nomeDoOutro: string; onIr?: () => void }) {
  return (
    <button
      type="button"
      onClick={onIr}
      className="mb-1 flex w-full items-stretch gap-2 overflow-hidden rounded-md bg-black/25 text-left hover:bg-black/35"
      title="Ver a mensagem respondida"
    >
      <span aria-hidden className={`w-1 shrink-0 ${quote.fromMe ? "bg-[#00a884]" : "bg-[#53bdeb]"}`} />
      <span className="min-w-0 flex-1 py-1.5 pr-2">
        <span className={`block text-[13px] font-medium ${quote.fromMe ? "text-[#00a884]" : "text-[#53bdeb]"}`}>
          {quote.fromMe ? "Você" : nomeDoOutro}
        </span>
        <span className="line-clamp-2 block text-[13px] leading-[18px] text-[#ffffffb3]">{resumoDaCitacao(quote)}</span>
      </span>
    </button>
  );
}

interface Props {
  msg: WaMessage;
  primeiraDoGrupo: boolean;
  onAbrirMidia: (id: string) => void;
  avatarJid: string | null;
  avatarNome: string;
  onResponder?: (msg: WaMessage) => void;
  onIrPara?: (id: string) => void;
  onAbrirNumero?: (numero: string) => void;
  nomeDoOutro?: string;
}

export function MessageBubble({
  msg,
  primeiraDoGrupo,
  onAbrirMidia,
  avatarJid,
  avatarNome,
  onResponder,
  onIrPara,
  onAbrirNumero,
  nomeDoOutro,
}: Props) {
  const sticker = msg.type === "sticker";
  const cor = msg.fromMe ? "bg-[#005c4b]" : "bg-[#202c33]";
  const corCauda = msg.fromMe ? "#005c4b" : "#202c33";
  return (
    <div id={`msg-${msg.id}`} className={`group flex items-center gap-1 ${msg.fromMe ? "justify-end" : "justify-start"} ${primeiraDoGrupo ? "mt-3" : "mt-0.5"} px-[4%] md:px-[6%]`}>
      {msg.fromMe && onResponder && (
        <button
          type="button"
          onClick={() => onResponder(msg)}
          aria-label="Responder esta mensagem"
          title="Responder"
          className="order-2 ml-1 rounded-full p-1.5 text-[#8696a0] opacity-0 transition hover:bg-white/10 hover:text-[#e9edef] focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Reply className="h-4 w-4" />
        </button>
      )}
      <div
        className={`relative max-w-[85%] md:max-w-[65%] ${sticker ? "" : `${cor} rounded-lg px-1.5 pb-1 pt-1.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]`} ${
          primeiraDoGrupo && !sticker ? (msg.fromMe ? "rounded-tr-none" : "rounded-tl-none") : ""
        }`}
      >
        {primeiraDoGrupo && !sticker && (
          <span
            aria-hidden
            className={`absolute top-0 h-3 w-2 ${msg.fromMe ? "-right-2" : "-left-2"}`}
            style={{ backgroundColor: corCauda, clipPath: msg.fromMe ? "polygon(0 0, 100% 0, 0 100%)" : "polygon(0 0, 100% 0, 100% 100%)" }}
          />
        )}
        {msg.quoted && (
          <Citacao
            quote={msg.quoted}
            nomeDoOutro={nomeDoOutro ?? avatarNome}
            onIr={msg.quoted.id && onIrPara ? () => onIrPara(msg.quoted!.id) : undefined}
          />
        )}
        {msg.type === "audio" ? (
          <NotaDeVoz msg={msg} avatarJid={avatarJid} avatarNome={avatarNome} />
        ) : (
          msg.hasMedia && <Midia msg={msg} onAbrir={() => onAbrirMidia(msg.id)} />
        )}
        {msg.type === "location" && <MapPin className="mb-1 ml-1 h-5 w-5 text-[#8696a0]" />}
        {msg.text && (
          <p className="whitespace-pre-wrap break-words px-1.5 text-[14.2px] leading-[19px] text-[#e9edef]">
            {linkify(msg.text, onAbrirNumero)}
            <span className="inline-block w-[68px]" aria-hidden />
          </p>
        )}
        <div className={`flex items-center justify-end gap-1 px-1.5 ${msg.text ? "-mt-3.5" : msg.type === "audio" ? "-mt-4" : ""}`}>
          <span className="text-[11px] text-[#ffffff99]">{formatHour(msg.timestamp)}</span>
          {msg.fromMe && <Ticks status={msg.status} />}
        </div>
      </div>
      {!msg.fromMe && onResponder && (
        <button
          type="button"
          onClick={() => onResponder(msg)}
          aria-label="Responder esta mensagem"
          title="Responder"
          className="ml-1 rounded-full p-1.5 text-[#8696a0] opacity-0 transition hover:bg-white/10 hover:text-[#e9edef] focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Reply className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
