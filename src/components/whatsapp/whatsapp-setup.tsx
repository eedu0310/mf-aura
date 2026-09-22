"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type WhatsAppStatusRow = {
  id: number;
  conectado: boolean | null;
  numero: string | null;
  qr_code: string | null;
  atualizado_em: string | null;
};

type ApiError = {
  erro?: string;
  mensagem?: string;
};

async function obterErroDaResposta(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = (await response.json()) as ApiError;
    return data.erro || data.mensagem || fallback;
  } catch {
    return fallback;
  }
}

export function WhatsAppSetup() {
  const [qrCode, setQrCode] = useState("");
  const [qrImagem, setQrImagem] = useState("");
  const [conectado, setConectado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [numeroDestino, setNumeroDestino] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string | null>(
    null,
  );

  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const aplicarStatus = useCallback((status: WhatsAppStatusRow) => {
    setConectado(Boolean(status.conectado));
    setQrCode(status.qr_code || "");
    setUltimaAtualizacao(status.atualizado_em || null);
  }, []);

  const verificarStatus = useCallback(async () => {
    if (!supabase) {
      setErro("O cliente Supabase não foi configurado no navegador.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("whatsapp_status")
        .select("id, conectado, numero, qr_code, atualizado_em")
        .eq("id", 1)
        .maybeSingle();

      if (error) {
        console.error("Erro ao verificar o status do WhatsApp:", error);
        setErro(`Não foi possível consultar o status: ${error.message}`);
        return;
      }

      if (data) aplicarStatus(data as WhatsAppStatusRow);
    } catch (error) {
      console.error("Erro ao verificar o status do WhatsApp:", error);
      setErro("Não foi possível consultar o status da conexão.");
    }
  }, [aplicarStatus, supabase]);

  useEffect(() => {
    void verificarStatus();

    const interval = window.setInterval(() => {
      void verificarStatus();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [verificarStatus]);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel("whatsapp-status-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_status",
          filter: "id=eq.1",
        },
        (payload: any) => {
          if (payload.eventType === "DELETE") {
            setConectado(false);
            setQrCode("");
            setUltimaAtualizacao(null);
            return;
          }

          if (payload.new) aplicarStatus(payload.new as WhatsAppStatusRow);
        },
      )
      .subscribe((status: string) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(
            "Não foi possível iniciar o Realtime do WhatsApp:",
            status,
          );
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [aplicarStatus, supabase]);

  useEffect(() => {
    let cancelado = false;

    async function converterQrCode() {
      if (!qrCode) {
        setQrImagem("");
        return;
      }

      if (qrCode.startsWith("data:image/")) {
        setQrImagem(qrCode);
        return;
      }

      try {
        const { toDataURL } = await import("qrcode");
        const dataUrl = await toDataURL(qrCode, {
          width: 320,
          margin: 2,
          errorCorrectionLevel: "M",
        });

        if (!cancelado) setQrImagem(dataUrl);
      } catch (error) {
        console.error("Erro ao renderizar o QR Code:", error);
        if (!cancelado) setQrImagem("");
      }
    }

    void converterQrCode();

    return () => {
      cancelado = true;
    };
  }, [qrCode]);

  async function conectarWhatsApp() {
    setCarregando(true);
    setErro("");

    try {
      const response = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(
          await obterErroDaResposta(
            response,
            "Não foi possível iniciar o WhatsApp.",
          ),
        );
      }

      await verificarStatus();
    } catch (error) {
      const mensagemErro =
        error instanceof Error
          ? error.message
          : "Erro ao conectar ao WhatsApp.";
      setErro(mensagemErro);
      console.error("Erro ao conectar ao WhatsApp:", error);
    } finally {
      setCarregando(false);
    }
  }

  async function enviarMsg() {
    const numero = numeroDestino.replace(/\D/g, "");
    const texto = mensagem.trim();

    if (!numero || !texto) {
      setErro("Preencha o número e a mensagem antes de enviar.");
      return;
    }

    if (texto.length > 1000) {
      setErro("A mensagem pode ter no máximo 1000 caracteres.");
      return;
    }

    setEnviando(true);
    setErro("");

    try {
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numero, texto }),
      });

      if (!response.ok) {
        throw new Error(
          await obterErroDaResposta(
            response,
            "Não foi possível enviar a mensagem.",
          ),
        );
      }

      setMensagem("");
      setNumeroDestino("");
      setModalAberto(false);
      await verificarStatus();
    } catch (error) {
      const mensagemErro =
        error instanceof Error ? error.message : "Erro ao enviar a mensagem.";
      setErro(mensagemErro);
      console.error("Erro ao enviar mensagem:", error);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-aura-mist bg-white p-6">
        <div className="mb-6 flex items-center gap-3">
          <MessageCircle
            size={24}
            className="text-green-600"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-lg font-semibold text-aura-graphite">
              WhatsApp com Baileys
            </h2>
            <p className="text-xs text-aura-graphite-soft">
              Integração simples e direta
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-lg bg-aura-bg p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-aura-graphite-soft">
                Status da conexão
              </p>
              <p
                className={`mt-1 text-lg font-semibold ${
                  conectado ? "text-green-600" : "text-yellow-600"
                }`}
              >
                {conectado ? "Conectado" : "Desconectado"}
              </p>
              {ultimaAtualizacao && (
                <p className="mt-1 text-xs text-aura-graphite-soft">
                  Atualizado em{" "}
                  {new Date(ultimaAtualizacao).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
            {conectado ? (
              <CheckCircle2
                size={32}
                className="text-green-600"
                aria-hidden="true"
              />
            ) : (
              <RefreshCw
                size={28}
                className="text-yellow-600"
                aria-hidden="true"
              />
            )}
          </div>
        </div>

        {qrImagem && !conectado && (
          <div className="mb-6 rounded-lg border-2 border-yellow-200 bg-yellow-50 p-6">
            <p className="mb-4 text-center font-medium text-yellow-900">
              Escaneie o QR Code com o seu telemóvel
            </p>
            <div className="flex justify-center">
              <img
                src={qrImagem}
                alt="QR Code para vincular o WhatsApp"
                className="h-56 w-56 rounded-lg border-4 border-white bg-white object-contain shadow-lg"
              />
            </div>
            <p className="mt-4 text-center text-sm text-yellow-800">
              Abra o WhatsApp → Configurações → Dispositivos vinculados →
              Vincular dispositivo.
            </p>
          </div>
        )}

        {erro && (
          <div
            className="mb-4 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4"
            role="alert"
          >
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0 text-red-600"
              aria-hidden="true"
            />
            <div>
              <p className="font-medium text-red-900">Erro</p>
              <p className="text-sm text-red-700">{erro}</p>
            </div>
          </div>
        )}

        <div className="mb-6 flex gap-3">
          <button
            type="button"
            onClick={conectarWhatsApp}
            disabled={carregando || conectado}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {carregando ? (
              <>
                <Loader2
                  size={16}
                  className="animate-spin"
                  aria-hidden="true"
                />
                Conectando...
              </>
            ) : conectado ? (
              <>
                <CheckCircle2 size={16} aria-hidden="true" />
                Conectado
              </>
            ) : (
              <>
                <QrCode size={16} aria-hidden="true" />
                Gerar QR Code
              </>
            )}
          </button>

          {conectado && (
            <button
              type="button"
              onClick={() => {
                setErro("");
                setModalAberto(true);
              }}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <Send size={16} aria-hidden="true" />
              Enviar
            </button>
          )}
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="mb-2 font-medium text-blue-900">Como funciona?</p>
          <ul className="space-y-1 text-sm text-blue-800">
            <li>1. Clique em “Gerar QR Code”.</li>
            <li>
              2. Abra o WhatsApp no telemóvel e entre em “Dispositivos
              vinculados”.
            </li>
            <li>3. Leia o QR Code apresentado nesta tela.</li>
            <li>4. Aguarde o status mudar para “Conectado”.</li>
          </ul>
        </div>
      </div>

      {modalAberto && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => !enviando && setModalAberto(false)}
            aria-hidden="true"
          />
          <div
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-aura-mist bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="whatsapp-send-title"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2
                id="whatsapp-send-title"
                className="text-lg font-semibold text-aura-graphite"
              >
                Enviar mensagem
              </h2>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                disabled={enviando}
                className="rounded-md p-1 hover:bg-aura-bg disabled:opacity-50"
                aria-label="Fechar janela"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div className="mb-4">
              <label
                htmlFor="whatsapp-number"
                className="mb-2 block text-sm font-medium text-aura-graphite"
              >
                Número de telefone
              </label>
              <input
                id="whatsapp-number"
                type="tel"
                value={numeroDestino}
                onChange={(event) => setNumeroDestino(event.target.value)}
                placeholder="5511999999999"
                autoComplete="tel"
                inputMode="tel"
                className="w-full rounded-lg border border-aura-mist bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="mt-1 text-xs text-aura-graphite-soft">
                Use o código do país, de preferência no formato 5511999999999.
              </p>
            </div>

            <div className="mb-4">
              <label
                htmlFor="whatsapp-message"
                className="mb-2 block text-sm font-medium text-aura-graphite"
              >
                Sua mensagem
              </label>
              <textarea
                id="whatsapp-message"
                value={mensagem}
                onChange={(event) => setMensagem(event.target.value)}
                placeholder="Digite sua mensagem..."
                rows={4}
                maxLength={1000}
                className="w-full resize-none rounded-lg border border-aura-mist bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="mt-1 text-xs text-aura-graphite-soft">
                {mensagem.length}/1000 caracteres
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                disabled={enviando}
                className="flex-1 rounded-lg border border-aura-mist px-4 py-2.5 text-sm font-medium transition hover:bg-aura-bg disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={enviarMsg}
                disabled={
                  enviando ||
                  !mensagem.trim() ||
                  !numeroDestino.replace(/\D/g, "")
                }
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviando ? (
                  <>
                    <Loader2
                      size={16}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send size={16} aria-hidden="true" />
                    Enviar
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default WhatsAppSetup;
