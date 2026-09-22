"use client";

import { useState } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { enviarMensagemBaileys } from "@/lib/whatsapp/baileys-client";
import { ConfirmacaoModal } from "@/components/shared/confirmacao-modal";

interface EnviarMensagemWhatsAppProps {
  numero: string;
  nome: string;
  onSucesso?: () => void;
}

export function EnviarMensagemWhatsApp({ numero, nome, onSucesso }: EnviarMensagemWhatsAppProps) {
  const [aberto, setAberto] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string>("");

  async function handleEnviar() {
    setEnviando(true);
    setErro("");

    try {
      const resultado = await enviarMensagemBaileys(numero, mensagem);

      if (resultado.sucesso) {
        setEnviado(true);
        setMensagem("");
        setTimeout(() => {
          setAberto(false);
          setEnviado(false);
          onSucesso?.();
        }, 2000);
      } else {
        setErro(resultado.erro || "Erro ao enviar mensagem");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition"
      >
        💬 WhatsApp
      </button>

      {aberto && !enviado && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setAberto(false)} />
      )}

      {aberto && !enviado && (
        <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-aura-mist bg-white p-6 shadow-xl">
          <h2 className="mb-4 text-lg font-semibold text-aura-graphite">
            Enviar para {nome}
          </h2>

          <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            📱 {numero}
          </div>

          {erro && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              ❌ {erro}
            </div>
          )}

          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Digite sua mensagem..."
            rows={4}
            className="w-full rounded-lg border border-aura-mist bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />

          <p className="mt-2 text-xs text-aura-graphite-soft">
            {mensagem.length}/1000 caracteres
          </p>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setAberto(false)}
              className="flex-1 rounded-lg border border-aura-mist px-4 py-2.5 text-sm font-medium hover:bg-aura-bg transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleEnviar}
              disabled={enviando || !mensagem.trim()}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition disabled:opacity-50"
            >
              {enviando ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Enviar
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {enviado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="rounded-2xl border border-aura-mist bg-white p-6 text-center shadow-xl">
            <CheckCircle2 size={48} className="mx-auto mb-3 text-green-600" />
            <p className="font-semibold text-aura-graphite">Mensagem enviada!</p>
            <p className="mt-1 text-sm text-aura-graphite-soft">
              Mensagem foi entregue com sucesso
            </p>
          </div>
        </div>
      )}
    </>
  );
}