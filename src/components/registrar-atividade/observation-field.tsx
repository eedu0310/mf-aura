"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, AlertCircle, Keyboard } from "lucide-react";

type Estado = "ocioso" | "ditando" | "gravando" | "transcrevendo" | "erro";

/** O navegador do Chrome/Edge transcreve ao vivo, sem custo e sem chave. */
function criarDitado(): any | null {
  if (typeof window === "undefined") return null;
  const Rec = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  if (!Rec) return null;
  const rec = new Rec();
  rec.lang = "pt-BR";
  rec.continuous = true;
  rec.interimResults = true;
  return rec;
}

export function ObservationField({
  value,
  onChange,
  label = "Relato do atendimento",
  ajuda = "Conte o que foi apresentado, o que o cliente falou e o que ficou combinado.",
  obrigatorio = true,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  ajuda?: string;
  obrigatorio?: boolean;
}) {
  const [estado, setEstado] = useState<Estado>("ocioso");
  const [erro, setErro] = useState<string | null>(null);
  const [parcial, setParcial] = useState("");
  const [temDitado, setTemDitado] = useState(false);
  const recRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const baseRef = useRef("");

  useEffect(() => {
    setTemDitado(!!criarDitado());
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* nada a fazer */
      }
    };
  }, []);

  // ----------------------------------------------------------- ditado no navegador
  function iniciarDitado() {
    setErro(null);
    const rec = criarDitado();
    if (!rec) {
      void gravarParaTranscrever();
      return;
    }
    baseRef.current = value.trim();
    recRef.current = rec;

    rec.onresult = (evento: any) => {
      let finalizado = "";
      let emAndamento = "";
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const trecho = evento.results[i][0].transcript;
        if (evento.results[i].isFinal) finalizado += trecho;
        else emAndamento += trecho;
      }
      if (finalizado) {
        baseRef.current = `${baseRef.current} ${finalizado.trim()}`.trim();
        onChange(baseRef.current);
        setParcial("");
      } else {
        setParcial(emAndamento);
      }
    };

    rec.onerror = (evento: any) => {
      if (evento?.error === "no-speech") return;
      setErro(
        evento?.error === "not-allowed"
          ? "O navegador bloqueou o microfone. Libere o acesso e tente de novo."
          : "Não consegui ouvir. Você pode escrever no campo abaixo.",
      );
      setEstado("erro");
      setParcial("");
    };

    rec.onend = () => {
      setParcial("");
      setEstado((atual) => (atual === "ditando" ? "ocioso" : atual));
    };

    try {
      rec.start();
      setEstado("ditando");
    } catch {
      setErro("Não consegui iniciar o microfone.");
      setEstado("erro");
    }
  }

  function pararDitado() {
    try {
      recRef.current?.stop();
    } catch {
      /* nada a fazer */
    }
    setEstado("ocioso");
  }

  // ----------------------------------------------------------- alternativa: grava e manda pro servidor
  async function gravarParaTranscrever() {
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 1000) {
          setErro("Não captei nenhum áudio. Verifique o microfone e tente de novo.");
          setEstado("erro");
          return;
        }
        setEstado("transcrevendo");
        try {
          const formData = new FormData();
          formData.append("audio", blob, "relato.webm");
          const resp = await fetch("/api/transcribe", { method: "POST", body: formData });
          const dados = await resp.json();
          if (!resp.ok) {
            setErro(dados.erro ?? "Não consegui transcrever o áudio. Escreva o relato no campo abaixo.");
            setEstado("erro");
            return;
          }
          onChange(value.trim() ? `${value.trim()} ${dados.transcricao}` : dados.transcricao);
          setEstado("ocioso");
        } catch {
          setErro("Não consegui transcrever o áudio. Escreva o relato no campo abaixo.");
          setEstado("erro");
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setEstado("gravando");
    } catch {
      setErro("Não consegui acessar o microfone. Verifique a permissão do navegador.");
      setEstado("erro");
    }
  }

  const gravando = estado === "ditando" || estado === "gravando";

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-aura-graphite">
          {label} {obrigatorio && <span className="text-aura-danger">*</span>}
        </p>

        {!gravando && estado !== "transcrevendo" ? (
          <button
            type="button"
            onClick={() => (temDitado ? iniciarDitado() : void gravarParaTranscrever())}
            className="flex items-center gap-1.5 rounded-full bg-aura-petrol-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-aura-petrol-600"
          >
            <Mic size={13} />
            Falar o relato
          </button>
        ) : gravando ? (
          <button
            type="button"
            onClick={() => (estado === "ditando" ? pararDitado() : mediaRecorderRef.current?.stop())}
            className="flex items-center gap-1.5 rounded-full bg-aura-danger px-3 py-1.5 text-xs font-semibold text-white"
          >
            <Square size={11} />
            Parar e usar
          </button>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium text-aura-graphite-soft">
            <Loader2 size={13} className="animate-spin" />
            Transcrevendo...
          </span>
        )}
      </div>

      {obrigatorio && <p className="mb-1.5 text-xs text-aura-graphite-soft">{ajuda}</p>}

      {estado === "ditando" && (
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-aura-petrol-600">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aura-petrol-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-aura-petrol-600" />
          </span>
          Ouvindo — pode falar. O texto aparece sozinho abaixo.
        </p>
      )}

      {erro && (
        <p className="mb-1.5 flex items-start gap-1.5 text-xs text-aura-danger">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          {erro}
        </p>
      )}

      <textarea
        value={parcial ? `${value}${value ? " " : ""}${parcial}` : value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="Fale pelo microfone ou escreva aqui o que aconteceu no atendimento..."
        className="w-full resize-none rounded-xl border border-aura-mist bg-white px-4 py-3 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
      />

      {!temDitado && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-aura-graphite-soft">
          <Keyboard size={12} />
          Neste navegador o áudio é enviado para transcrição. No Chrome, o texto aparece enquanto você fala.
        </p>
      )}
    </div>
  );
}
