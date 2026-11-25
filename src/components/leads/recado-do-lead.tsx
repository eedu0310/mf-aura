"use client";

import { useState } from "react";
import { Bot, ChevronDown, MessageSquare } from "lucide-react";
import { separarHistorico } from "@/lib/leads/historico-ia";

/**
 * O recado do lead. Quando o agente do Instagram ou o assistente do site
 * atendeu antes, mostra o resumo do que foi conversado e a conversa inteira
 * (recolhida), para o vendedor assumir sabendo de tudo.
 */
export function RecadoDoLead({ texto, resumo }: { texto: string | null; resumo: string | null }) {
  const [aberto, setAberto] = useState(false);
  const { cabecalho, falas } = separarHistorico(texto);
  const atendidoPelaIA = falas.length > 0;

  return (
    <>
      {atendidoPelaIA ? (
        <div className="mt-2 rounded-lg border border-aura-petrol-500/25 bg-aura-petrol-500/8 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-aura-petrol-600">
            <Bot size={12} />
            Atendido pelo assistente de IA — leia antes de chamar
          </p>
          {resumo && <p className="mt-1 text-xs text-aura-graphite">{resumo}</p>}
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="mt-1.5 flex items-center gap-1 text-xs font-medium text-aura-petrol-600 hover:underline"
          >
            <ChevronDown size={12} className={`transition ${aberto ? "rotate-180" : ""}`} />
            {aberto ? "Esconder a conversa" : `Ver a conversa (${falas.length} mensagens)`}
          </button>
          {aberto && (
            <div className="mt-2 flex max-h-80 flex-col gap-1.5 overflow-y-auto rounded-md border border-aura-mist bg-aura-surface p-2">
              {falas.map((f, i) => (
                <div key={i} className={`flex ${f.quem === "Cliente" ? "justify-start" : "justify-end"}`}>
                  <p
                    className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs ${
                      f.quem === "Cliente"
                        ? "rounded-bl-sm bg-aura-sunken text-aura-graphite"
                        : "rounded-br-sm bg-aura-petrol-500/12 text-aura-graphite"
                    }`}
                  >
                    <span className="block text-[0.6rem] font-semibold text-aura-graphite-soft">
                      {f.quem === "Cliente" ? "Cliente" : f.quem === "Assistente" ? "Assistente de IA" : "Loja"}
                    </span>
                    {f.texto}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        resumo && <p className="mt-2 text-xs italic text-aura-graphite-soft">IA: &quot;{resumo}&quot;</p>
      )}
      {cabecalho && (
        <p className="mt-2 flex items-start gap-1.5 whitespace-pre-line rounded-lg border border-aura-mist bg-aura-sunken px-3 py-2 text-xs text-aura-graphite">
          <MessageSquare size={12} className="mt-0.5 shrink-0 text-aura-graphite-soft" />
          {cabecalho}
        </p>
      )}
    </>
  );
}
