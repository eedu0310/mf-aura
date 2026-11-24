"use client";

import { useState } from "react";
import { Loader2, Sparkles, WandSparkles } from "lucide-react";
import { classeBotao } from "@/components/ui";

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
    <div className="rounded-xl border border-aura-mist bg-aura-sunken/60 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-gold/15 text-aura-gold-700"><Sparkles size={15} /></span>
        <div>
          <p className="text-sm font-semibold text-aura-graphite">Registrar com ajuda da AURA</p>
          <p className="text-xs text-aura-graphite-soft">Descreva o contato. A AURA prepara um rascunho para você revisar.</p>
        </div>
      </div>
      <textarea value={relato} onChange={(event) => setRelato(event.target.value)} rows={3} maxLength={6000} placeholder="Ex.: Visitei o arquiteto João. Ele gostou da lareira, mas vai conversar com o cliente e pediu retorno em cinco dias." className="aura-input mt-3 resize-none" />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-aura-graphite-soft">{relato.length}/6000</span>
        <button type="button" onClick={() => void gerarRascunho()} disabled={carregando || relato.trim().length < 12} className={classeBotao("secundario", "sm")}>
          {carregando ? <Loader2 size={13} className="animate-spin" /> : <WandSparkles size={13} className="text-aura-petrol-600" />}
          {carregando ? "Analisando..." : "Preparar rascunho"}
        </button>
      </div>
      {erro && <p className="mt-2 text-xs text-aura-danger">{erro}</p>}
      {rascunho && (
        <div className="aura-card mt-3 p-3">
          <p className="aura-rotulo text-aura-petrol-600">Rascunho para revisar</p>
          <p className="mt-1 text-sm text-aura-graphite">{rascunho.resumo}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-aura-graphite-soft sm:grid-cols-3">
            <span>Resultado: <b className="font-medium text-aura-graphite">{rascunho.resultado || "—"}</b></span>
            <span>Próximo passo: <b className="font-medium text-aura-graphite">{rascunho.proximoPasso || "—"}</b></span>
            <span>Confiança: <b className="font-medium tabular-nums text-aura-graphite">{Math.round(rascunho.confianca * 100)}%</b></span>
          </div>
          <button type="button" onClick={() => onAplicar(rascunho)} className={classeBotao("primario", "sm", "mt-3 w-full")}>Usar dados no formulário e revisar</button>
        </div>
      )}
    </div>
  );
}
