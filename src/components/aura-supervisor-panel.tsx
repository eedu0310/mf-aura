"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

type Recomendacao = {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: "urgente" | "alta" | "media" | "baixa";
  prazo?: string | null;
};

const CORES: Record<Recomendacao["prioridade"], string> = {
  urgente: "border-red-200 bg-red-50 text-red-700",
  alta: "border-orange-200 bg-orange-50 text-orange-700",
  media: "border-aura-mist bg-aura-bg text-aura-graphite",
  baixa: "border-aura-mist bg-white text-aura-graphite-soft",
};

export function AuraSupervisorPanel() {
  const [recomendacoes, setRecomendacoes] = useState<Recomendacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState<string | null>(null);

  async function carregar() {
    try {
      const resposta = await fetch("/api/aura/supervisao", { cache: "no-store" });
      if (!resposta.ok) return;
      const dados = (await resposta.json()) as { recomendacoes?: Recomendacao[] };
      setRecomendacoes(dados.recomendacoes ?? []);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function atualizar(id: string, status: "concluida" | "dispensada") {
    setAtualizando(id);
    try {
      const resposta = await fetch("/api/aura/supervisao", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (resposta.ok) setRecomendacoes((atuais) => atuais.filter((item) => item.id !== id));
    } finally {
      setAtualizando(null);
    }
  }

  if (carregando) {
    return <div className="flex justify-center rounded-2xl border border-aura-mist bg-white p-6"><Loader2 className="animate-spin text-aura-petrol-700" size={20} /></div>;
  }

  return (
    <section className="rounded-2xl border border-aura-mist bg-white p-5" aria-labelledby="aura-supervisora-titulo">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-aura-petrol-700/10 text-aura-petrol-700"><ShieldAlert size={18} /></span>
        <div>
          <h2 id="aura-supervisora-titulo" className="font-medium text-aura-graphite">AURA Supervisora</h2>
          <p className="text-xs text-aura-graphite-soft">Prioridades identificadas na última análise.</p>
        </div>
      </div>
      {recomendacoes.length === 0 ? (
        <p className="rounded-xl bg-aura-bg p-4 text-sm text-aura-graphite-soft">Nenhuma recomendação pendente nesta rodada. Continue registrando cada contato no CRM.</p>
      ) : (
        <div className="space-y-2">
          {recomendacoes.map((item) => (
            <div key={item.id} className={`rounded-xl border p-3 ${CORES[item.prioridade]}`}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.titulo}</p>
                  <p className="mt-1 text-xs opacity-80">{item.descricao}</p>
                </div>
                <span className="shrink-0 text-[0.65rem] font-semibold uppercase">{item.prioridade}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => void atualizar(item.id, "concluida")} disabled={atualizando === item.id} className="inline-flex items-center gap-1 rounded-lg bg-aura-petrol-700 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-50"><CheckCircle2 size={13} /> Concluí</button>
                <button type="button" onClick={() => void atualizar(item.id, "dispensada")} disabled={atualizando === item.id} className="rounded-lg px-2.5 py-1.5 text-xs underline disabled:opacity-50">Dispensar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
