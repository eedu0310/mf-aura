"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Play, Trash2, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";

type Estado = "ocioso" | "gravando" | "gravado" | "transcrevendo" | "analisando" | "concluido" | "erro";

function formatarTempo(segundos: number) {
  const m = Math.floor(segundos / 60)
    .toString()
    .padStart(2, "0");
  const s = (segundos % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function MeetingRecorder() {
  const { playbook } = useAppData();
  const [estado, setEstado] = useState<Estado>("ocioso");
  const [segundos, setSegundos] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcricao, setTranscricao] = useState<string | null>(null);
  const [analise, setAnalise] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function iniciarGravacao() {
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        audioBlobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        setEstado("gravado");
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setSegundos(0);
      setEstado("gravando");

      timerRef.current = setInterval(() => setSegundos((s) => s + 1), 1000);
    } catch {
      setErro(
        "Não consegui acessar o microfone. Verifique se você deu permissão ao navegador."
      );
      setEstado("erro");
    }
  }

  function pararGravacao() {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function descartar() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioBlobRef.current = null;
    setAudioUrl(null);
    setTranscricao(null);
    setAnalise(null);
    setErro(null);
    setSegundos(0);
    setEstado("ocioso");
  }

  async function transcreverEAnalisar() {
    if (!audioBlobRef.current) return;
    setErro(null);
    setEstado("transcrevendo");

    try {
      const formData = new FormData();
      formData.append("audio", audioBlobRef.current, "reuniao.webm");

      const respTranscricao = await fetch("/api/transcribe", { method: "POST", body: formData });
      const dadosTranscricao = await respTranscricao.json();

      if (!respTranscricao.ok) {
        throw new Error(dadosTranscricao.erro ?? "Falha na transcrição.");
      }

      setTranscricao(dadosTranscricao.transcricao);
      setEstado("analisando");

      const respAnalise = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo: "analise_reuniao", transcricao: dadosTranscricao.transcricao, playbook }),
      });
      const dadosAnalise = await respAnalise.json();

      if (!respAnalise.ok || !dadosAnalise.resposta) {
        throw new Error(dadosAnalise.erro ?? "Falha ao analisar a reunião.");
      }
      setAnalise(dadosAnalise.resposta);
      setEstado("concluido");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Algo deu errado ao processar o áudio.");
      setEstado("erro");
    }
  }

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="text-aura-petrol-600" />
        <p className="text-sm font-medium text-aura-graphite">Gravar reunião com IA</p>
      </div>
      <p className="mt-1 text-xs text-aura-graphite-soft">
        Grave a conversa, a AURA transcreve e te dá dicas de como conduzir a venda.
      </p>

      {erro && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-aura-danger/10 px-3 py-2 text-xs text-aura-danger">
          <AlertCircle size={13} />
          {erro}
        </p>
      )}

      <div className="mt-4">
        {estado === "ocioso" && (
          <button
            type="button"
            onClick={iniciarGravacao}
            className="flex items-center justify-center gap-2 rounded-xl border border-aura-mist py-3 text-sm font-medium text-aura-graphite hover:bg-aura-bg"
          >
            <Mic size={16} />
            Iniciar gravação
          </button>
        )}

        {estado === "gravando" && (
          <div className="flex items-center justify-between rounded-xl border border-aura-danger/30 bg-aura-danger/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-aura-danger" />
              <span className="font-data text-sm text-aura-graphite">
                {formatarTempo(segundos)}
              </span>
            </div>
            <button
              type="button"
              onClick={pararGravacao}
              className="flex items-center gap-1.5 rounded-full bg-aura-danger px-3.5 py-1.5 text-xs font-medium text-white hover:bg-aura-danger/90"
            >
              <Square size={12} />
              Parar
            </button>
          </div>
        )}

        {(estado === "gravado" || estado === "erro") && audioUrl && (
          <div className="flex flex-col gap-3">
            <audio src={audioUrl} controls className="w-full" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={transcreverEAnalisar}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-aura-petrol-700 py-2.5 text-sm font-medium text-white hover:bg-aura-petrol-600"
              >
                <Play size={14} />
                Transcrever e analisar
              </button>
              <button
                type="button"
                onClick={descartar}
                aria-label="Descartar gravação"
                className="flex items-center justify-center rounded-xl border border-aura-mist px-3 text-aura-graphite-soft hover:bg-aura-bg hover:text-aura-danger"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        )}

        {(estado === "transcrevendo" || estado === "analisando") && (
          <div className="flex items-center gap-2 rounded-xl border border-aura-mist bg-aura-bg px-4 py-3 text-sm text-aura-graphite-soft">
            <Loader2 size={15} className="animate-spin" />
            {estado === "transcrevendo" ? "Transcrevendo áudio..." : "A AURA está analisando a conversa..."}
          </div>
        )}

        {transcricao && (estado === "analisando" || estado === "concluido") && (
          <div className="mt-3 rounded-xl bg-aura-bg p-3.5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-aura-graphite-soft">
              Transcrição
            </p>
            <p className="mt-1 text-sm leading-relaxed text-aura-graphite">{transcricao}</p>
          </div>
        )}

        {analise && estado === "concluido" && (
          <div className="mt-3 rounded-xl border border-aura-petrol-700/15 bg-aura-petrol-700/[0.04] p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-aura-petrol-700 text-white">
                <Sparkles size={12} />
              </span>
              <p className="text-xs font-semibold uppercase tracking-wide text-aura-petrol-700">
                Dicas da AURA Coach
              </p>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-aura-graphite">
              {analise}
            </p>
            <button
              type="button"
              onClick={descartar}
              className="mt-3 text-xs font-medium text-aura-petrol-600 hover:underline"
            >
              Gravar outra reunião
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
