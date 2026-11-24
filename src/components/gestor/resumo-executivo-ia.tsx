"use client";

import { useState } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { Botao, Card, CardHeader } from "@/components/ui";

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
    <Card>
      <CardHeader
        titulo="Resumo Executivo da IA"
        icone={Sparkles}
        corIcone="text-aura-gold-700"
        className={resumo || carregando || erro ? "mb-3" : "mb-0"}
        acoes={
          resumo ? (
            <button
              type="button"
              onClick={gerar}
              disabled={carregando}
              aria-label="Gerar novo resumo"
              className="rounded-md p-1.5 text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-graphite"
            >
              <RefreshCw size={13} className={carregando ? "animate-spin" : ""} />
            </button>
          ) : undefined
        }
      />

      {!resumo && !carregando && (
        <>
          <p className="mt-3 text-sm text-aura-graphite-soft">
            A IA analisa vendas, pipeline, leads e pós-venda das 4 lojas e já aponta o que
            precisa de atenção agora.
          </p>
          <Botao variante="primario" onClick={gerar} className="mt-3">
            Gerar resumo agora
          </Botao>
        </>
      )}

      {carregando && (
        <div className="flex items-center gap-2 text-sm text-aura-graphite-soft">
          <Loader2 size={15} className="animate-spin" />
          Analisando os dados das 4 lojas...
        </div>
      )}

      {erro && <p className="mt-2 text-sm text-aura-danger">{erro}</p>}

      {resumo && !carregando && (
        <div className="whitespace-pre-line text-sm leading-relaxed text-aura-graphite">{resumo}</div>
      )}
    </Card>
  );
}
