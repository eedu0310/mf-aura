"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { EstadoVazio, Selo, classeBotao } from "@/components/ui";

type Recomendacao = {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: "urgente" | "alta" | "media" | "baixa";
  prazo?: string | null;
};

// Cartão neutro para todas; a prioridade aparece no filete à esquerda e no selo.
const CORES: Record<Recomendacao["prioridade"], string> = {
  urgente: "border-l-aura-danger",
  alta: "border-l-aura-warning",
  media: "border-l-aura-petrol-500",
  baixa: "border-l-aura-mist",
};

const SELO: Record<Recomendacao["prioridade"], "perigo" | "atencao" | "marca" | "neutro"> = {
  urgente: "perigo",
  alta: "atencao",
  media: "marca",
  baixa: "neutro",
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
    return <div className="aura-card flex justify-center p-6"><Loader2 className="animate-spin text-aura-graphite-soft" size={18} /></div>;
  }

  return (
    <section className="aura-card p-5" aria-labelledby="aura-supervisora-titulo">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-sunken text-aura-petrol-600"><ShieldAlert size={16} /></span>
        <div>
          <h2 id="aura-supervisora-titulo" className="text-sm font-semibold text-aura-graphite">AURA Supervisora</h2>
          <p className="mt-0.5 text-xs text-aura-graphite-soft">Prioridades identificadas na última análise.</p>
        </div>
      </div>
      {recomendacoes.length === 0 ? (
        <EstadoVazio icone={CheckCircle2} titulo="Nenhuma recomendação pendente nesta rodada." descricao="Continue registrando cada contato no CRM." className="py-6" />
      ) : (
        <div className="space-y-2">
          {recomendacoes.map((item) => (
            <div key={item.id} className={`rounded-lg border border-aura-mist border-l-2 p-3 ${CORES[item.prioridade]}`}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-aura-graphite">{item.titulo}</p>
                  <p className="mt-1 text-xs text-aura-graphite-soft">{item.descricao}</p>
                </div>
                <Selo tom={SELO[item.prioridade]} className="shrink-0 uppercase">{item.prioridade}</Selo>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => void atualizar(item.id, "concluida")} disabled={atualizando === item.id} className={classeBotao("secundario", "sm")}><CheckCircle2 size={13} className="text-aura-success" /> Concluí</button>
                <button type="button" onClick={() => void atualizar(item.id, "dispensada")} disabled={atualizando === item.id} className={classeBotao("fantasma", "sm")}>Dispensar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
