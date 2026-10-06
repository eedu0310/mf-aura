"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type EstadoDoDitado =
  | "ocioso"
  | "ditando"
  | "gravando"
  | "transcrevendo"
  | "erro";

/**
 * Falar em vez de digitar.
 *
 * Esta lógica já existia, enterrada dentro do campo de relato da tela de
 * registrar atividade, e por isso a AURA do Meu Dia continuava só em digitação
 * — o pedido foi direto: "não consigo gravar áudio pra explicar pra ela,
 * nem o chat nem o Cloud, tá só em digitação".
 *
 * DOIS CAMINHOS, nesta ordem, e a ordem importa:
 *
 *  1. O ditado do próprio navegador (Chrome e Edge). Transcreve ao vivo, de
 *     graça, sem chave de ninguém, e a pessoa vê o texto aparecendo enquanto
 *     fala — o que deixa claro na hora se o microfone está pegando.
 *
 *  2. Gravar e mandar para /api/transcribe. Funciona em qualquer navegador,
 *     mas depende da OPENAI_API_KEY no servidor e só devolve o texto no fim.
 *
 * O segundo é o plano B de propósito: ele custa dinheiro por uso e, sem a
 * chave configurada, devolve um erro que a pessoa não tem como resolver. Com
 * a ordem invertida, quem usa Chrome pagaria transcrição à toa.
 *
 * O nome começa com "use", e não "usar", porque é o que faz o ESLint conseguir
 * conferir as regras de hook aqui dentro. É a única palavra em inglês no
 * arquivo, e tem essa razão.
 */
export function useDitado({
  aoTexto,
  idioma = "pt-BR",
}: {
  /** Chamado com cada pedaço de texto pronto, para ser acrescentado. */
  aoTexto: (trecho: string) => void;
  idioma?: string;
}) {
  const [estado, setEstado] = useState<EstadoDoDitado>("ocioso");
  const [erro, setErro] = useState<string | null>(null);
  const [parcial, setParcial] = useState("");
  const [temDitadoNoNavegador, setTemDitadoNoNavegador] = useState(false);

  const recRef = useRef<any>(null);
  const gravadorRef = useRef<MediaRecorder | null>(null);
  const pedacosRef = useRef<Blob[]>([]);
  // A função de callback muda a cada render do componente que usa o hook; o
  // reconhecimento de voz, não. Sem esta referência, o onresult chamaria uma
  // versão velha de aoTexto e o texto iria parar num estado antigo.
  //
  // A atualização vai num efeito, e não solta no corpo do hook: escrever em
  // ref durante o render é o tipo de coisa que funciona até o React decidir
  // renderizar duas vezes.
  const aoTextoRef = useRef(aoTexto);
  useEffect(() => {
    aoTextoRef.current = aoTexto;
  }, [aoTexto]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Rec =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    setTemDitadoNoNavegador(!!Rec);
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* já parado */
      }
      try {
        gravadorRef.current?.stream?.getTracks().forEach((t) => t.stop());
      } catch {
        /* já parado */
      }
    };
  }, []);

  const gravarParaTranscrever = useCallback(async () => {
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const gravador = new MediaRecorder(stream);
      pedacosRef.current = [];

      gravador.ondataavailable = (e) => {
        if (e.data.size > 0) pedacosRef.current.push(e.data);
      };

      gravador.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(pedacosRef.current, { type: "audio/webm" });
        // Menos de 1 KB é silêncio ou microfone mudo. Mandar para o servidor
        // gastaria crédito para receber uma transcrição vazia.
        if (blob.size < 1000) {
          setErro("Não captei nenhum áudio. Verifique o microfone e tente de novo.");
          setEstado("erro");
          return;
        }
        setEstado("transcrevendo");
        try {
          const corpo = new FormData();
          corpo.append("audio", blob, "fala.webm");
          const resp = await fetch("/api/transcribe", { method: "POST", body: corpo });
          const dados = await resp.json();
          if (!resp.ok) {
            setErro(dados.erro ?? "Não consegui transcrever o áudio.");
            setEstado("erro");
            return;
          }
          aoTextoRef.current(String(dados.transcricao ?? "").trim());
          setEstado("ocioso");
        } catch {
          setErro("Não consegui transcrever o áudio. Escreva a mensagem.");
          setEstado("erro");
        }
      };

      gravador.start();
      gravadorRef.current = gravador;
      setEstado("gravando");
    } catch {
      setErro("Não consegui acessar o microfone. Verifique a permissão do navegador.");
      setEstado("erro");
    }
  }, []);

  const comecar = useCallback(() => {
    setErro(null);
    const Rec =
      typeof window !== "undefined"
        ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition)
        : null;

    if (!Rec) {
      void gravarParaTranscrever();
      return;
    }

    const rec = new Rec();
    rec.lang = idioma;
    rec.continuous = true;
    rec.interimResults = true;
    recRef.current = rec;

    rec.onresult = (evento: any) => {
      let pronto = "";
      let andando = "";
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const trecho = evento.results[i][0].transcript;
        if (evento.results[i].isFinal) pronto += trecho;
        else andando += trecho;
      }
      if (pronto) {
        aoTextoRef.current(pronto.trim());
        setParcial("");
      } else {
        setParcial(andando);
      }
    };

    rec.onerror = (evento: any) => {
      // "no-speech" acontece a cada pausa de quem está pensando. Mostrar erro
      // aqui faria a tela piscar vermelho no meio de uma frase.
      if (evento?.error === "no-speech" || evento?.error === "aborted") return;
      setErro(
        evento?.error === "not-allowed"
          ? "O navegador bloqueou o microfone. Libere o acesso e tente de novo."
          : "Não consegui ouvir. Você pode escrever a mensagem.",
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
  }, [gravarParaTranscrever, idioma]);

  const parar = useCallback(() => {
    if (recRef.current) {
      try {
        recRef.current.stop();
      } catch {
        /* já parado */
      }
    }
    if (gravadorRef.current?.state === "recording") {
      gravadorRef.current.stop();
      return; // o onstop acima cuida do resto
    }
    setEstado("ocioso");
  }, []);

  return {
    estado,
    erro,
    parcial,
    temDitadoNoNavegador,
    ouvindo: estado === "ditando" || estado === "gravando",
    ocupado: estado === "transcrevendo",
    comecar,
    parar,
    limparErro: () => setErro(null),
  };
}
