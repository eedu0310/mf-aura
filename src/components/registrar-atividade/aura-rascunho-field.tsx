"use client";

import { useState } from "react";
import { Loader2, Sparkles, WandSparkles } from "lucide-react";

export interface RascunhoAtividadeAura {
  resumo: string;
  resultado: string;
  proximoPasso: string;
  prazoDias: number;
  origem: string;
  categoria: string;
  nomeCliente: string;
  produto: string;
  valorEstimado: number;
  confianca: number;
}

export function AuraRascunhoField({
  onAplicar,
}: {
  onAplicar: (rascunho: RascunhoAtividadeAura) => void;
}) {
  const [relato, setRelato] = useState("");
  const [rascunho, setRascunho] = useState<RascunhoAtividadeAura | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function gerarRascunho() {
    setErro("");
    setCarregando(true);
    try {
      const resposta = await fetch("/api/aura/rascunho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relato }),
      });
      const dados = (await resposta.json()) as { rascunho?: RascunhoAtividadeAura; erro?: string };
      if (!resposta.ok || !dados.rascunho) {
        setErro(dados.erro ?? "Não foi possível estruturar o relato.");
        return;
      }
      setRascunho(dados.rascunho);
    } catch {
      setErro("Não foi possível conectar à AURA. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-aura-gold/30 bg-aura-gold/5 p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-aura-gold/20 text-aura-gold"><Sparkles size={16} /></span>
        <div>
          <p className="text-sm font-semibold text-aura-graphite">Registrar com ajuda da AURA</p>
          <p className="text-xs text-aura-graphite-soft">Descreva o contato. A AURA prepara um rascunho para você revisar.</p>
        </div>
      </div>
      <textarea value={relato} onChange={(event) => setRelato(event.target.value)} rows={3} maxLength={6000} placeholder="Ex.: Visitei o arquiteto João. Ele gostou da lareira, mas vai conversar com o cliente e pediu retorno em cinco dias." className="mt-3 w-full resize-none rounded-xl border border-aura-mist bg-white px-3 py-2.5 text-sm outline-none focus:border-aura-gold" />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-aura-graphite-soft">{relato.length}/6000</span>
        <button type="button" onClick={() => void gerarRascunho()} disabled={carregando || relato.trim().length < 12} className="inline-flex items-center gap-2 rounded-xl bg-aura-navy-950 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
          {carregando ? <Loader2 size={14} className="animate-spin" /> : <WandSparkles size={14} />}
          {carregando ? "Analisando..." : "Preparar rascunho"}
        </button>
      </div>
      {erro && <p className="mt-2 text-xs text-aura-danger">{erro}</p>}
      {rascunho && (
        <div className="mt-3 rounded-xl border border-aura-mist bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-aura-petrol-700">Rascunho para revisar</p>
          <p className="mt-1 text-sm text-aura-graphite">{rascunho.resumo}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-aura-graphite-soft sm:grid-cols-3">
            <span>Resultado: <b className="text-aura-graphite">{rascunho.resultado || "—"}</b></span>
            <span>Próximo passo: <b className="text-aura-graphite">{rascunho.proximoPasso || "—"}</b></span>
            <span>Confiança: <b className="text-aura-graphite">{Math.round(rascunho.confianca * 100)}%</b></span>
          </div>
          <button type="button" onClick={() => onAplicar(rascunho)} className="mt-3 w-full rounded-xl bg-aura-petrol-700 px-3 py-2 text-xs font-semibold text-white hover:bg-aura-petrol-600">Usar dados no formulário e revisar</button>
        </div>
      )}
    </div>
  );
}
