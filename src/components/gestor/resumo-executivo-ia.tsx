"use client";

import { useState } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";

export function ResumoExecutivoIA() {
  const [resumo, setResumo] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setCarregando(true);
    setErro(null);
    try {
      const resp = await fetch("/api/gestor/resumo-executivo", { method: "POST" });
      const dados = await resp.json();
      if (!resp.ok) {
        setErro(dados.erro ?? "Não consegui gerar o resumo.");
      } else {
        setResumo(dados.resumo);
      }
    } catch {
      setErro("Não consegui gerar o resumo. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-aura-navy-950 bg-aura-navy-950 p-5">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-aura-gold" />
        <p className="text-sm font-medium text-white">Resumo Executivo da IA</p>
        {resumo && (
          <button
            type="button"
            onClick={gerar}
            disabled={carregando}
            aria-label="Gerar novo resumo"
            className="ml-auto text-white/50 hover:text-white"
          >
            <RefreshCw size={13} className={carregando ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      {!resumo && !carregando && (
        <>
          <p className="mt-2 text-sm text-white/60">
            A IA analisa vendas, pipeline, leads e pós-venda das 4 lojas e já aponta o que
            precisa de atenção agora.
          </p>
          <button
            type="button"
            onClick={gerar}
            className="mt-3 rounded-xl bg-aura-gold px-4 py-2 text-sm font-semibold text-aura-navy-950 hover:opacity-90"
          >
            Gerar resumo agora
          </button>
        </>
      )}

      {carregando && (
        <div className="mt-3 flex items-center gap-2 text-sm text-white/60">
          <Loader2 size={15} className="animate-spin" />
          Analisando os dados das 4 lojas...
        </div>
      )}

      {erro && <p className="mt-2 text-sm text-red-300">{erro}</p>}

      {resumo && !carregando && (
        <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/90">{resumo}</div>
      )}
    </div>
  );
}
