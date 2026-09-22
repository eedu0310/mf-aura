"use client";

import { useRef, useState } from "react";
import { Mic, Square, Loader2, AlertCircle } from "lucide-react";

type Estado = "ocioso" | "gravando" | "transcrevendo" | "erro";

export function ObservationField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [estado, setEstado] = useState<Estado>("ocioso");
  const [erro, setErro] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function iniciarGravacao() {
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
          formData.append("audio", blob, "observacao.webm");

          const resp = await fetch("/api/transcribe", { method: "POST", body: formData });
          const dados = await resp.json();

          if (!resp.ok) {
            setErro(dados.erro ?? "Não consegui transcrever o áudio.");
            setEstado("erro");
            return;
          }

          const textoNovo = value.trim() ? `${value.trim()} ${dados.transcricao}` : dados.transcricao;
          onChange(textoNovo);
          setEstado("ocioso");
        } catch {
          setErro("Não consegui transcrever o áudio. Tente novamente.");
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

  function pararGravacao() {
    mediaRecorderRef.current?.stop();
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-sm font-medium text-aura-graphite">Observação</p>

        {estado === "ocioso" || estado === "erro" ? (
          <button
            type="button"
            onClick={iniciarGravacao}
            className="flex items-center gap-1.5 text-xs font-medium text-aura-petrol-600 hover:underline"
          >
            <Mic size={13} />
            Registrar por voz
          </button>
        ) : estado === "gravando" ? (
          <button
            type="button"
            onClick={pararGravacao}
            className="flex items-center gap-1.5 text-xs font-medium text-aura-danger hover:underline"
          >
            <Square size={11} />
            Parar gravação
          </button>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium text-aura-graphite-soft">
            <Loader2 size={13} className="animate-spin" />
            Transcrevendo...
          </span>
        )}
      </div>

      {erro && (
        <p className="mb-1.5 flex items-center gap-1.5 text-xs text-aura-danger">
          <AlertCircle size={12} />
          {erro}
        </p>
      )}

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Descreva rapidamente o que aconteceu..."
        className="w-full resize-none rounded-xl border border-aura-mist bg-white px-4 py-3 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500 focus:ring-2 focus:ring-aura-petrol-500/20"
      />
    </div>
  );
}
