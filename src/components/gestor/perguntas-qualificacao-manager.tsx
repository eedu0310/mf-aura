"use client";

import { useEffect, useState } from "react";
import { ListChecks, Plus, Trash2, GripVertical } from "lucide-react";
import {
  listarPerguntasQualificacao,
  criarPerguntaQualificacao,
  apagarPerguntaQualificacao,
  type PerguntaQualificacao,
} from "@/lib/supabase/perguntas-qualificacao";
import { useUserProfile } from "@/lib/user-profile-context";

export function PerguntasQualificacaoManager() {
  const { profile } = useUserProfile();
  const [perguntas, setPerguntas] = useState<PerguntaQualificacao[]>([]);
  const [novaPergunta, setNovaPergunta] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const lista = await listarPerguntasQualificacao();
    if (lista) setPerguntas(lista);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!novaPergunta.trim()) return;
    setSalvando(true);
    await criarPerguntaQualificacao(profile.empresa, novaPergunta.trim(), perguntas.length);
    setNovaPergunta("");
    setSalvando(false);
    await carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Remover essa pergunta do fluxo de qualificação?")) return;
    setPerguntas((prev) => prev.filter((p) => p.id !== id));
    await apagarPerguntaQualificacao(id);
  }

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <div className="flex items-center gap-2">
        <ListChecks size={16} className="text-aura-petrol-600" />
        <p className="text-sm font-medium text-aura-graphite">Perguntas de Pré-qualificação</p>
      </div>
      <p className="mt-1 text-xs text-aura-graphite-soft">
        Assim que um lead chega pelo WhatsApp, a AURA faz essas perguntas — uma de cada vez —
        antes de repassar pro SDR/vendedor. As respostas já chegam prontas na fila de leads. Se
        não cadastrar nenhuma, o lead é repassado direto, sem perguntas extras.
      </p>

      <ul className="mt-4 flex flex-col divide-y divide-aura-mist">
        {perguntas.length === 0 ? (
          <p className="py-4 text-center text-xs text-aura-graphite-soft">
            Nenhuma pergunta cadastrada — os leads vão direto pro SDR/vendedor.
          </p>
        ) : (
          perguntas.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0">
              <GripVertical size={13} className="shrink-0 text-aura-graphite-soft" />
              <span className="shrink-0 text-xs font-medium text-aura-graphite-soft">{i + 1}.</span>
              <p className="flex-1 text-sm text-aura-graphite">{p.pergunta}</p>
              <button
                type="button"
                onClick={() => excluir(p.id)}
                aria-label="Excluir pergunta"
                className="shrink-0 text-aura-graphite-soft hover:text-aura-danger"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))
        )}
      </ul>

      <form onSubmit={adicionar} className="mt-4 flex gap-2">
        <input
          type="text"
          value={novaPergunta}
          onChange={(e) => setNovaPergunta(e.target.value)}
          placeholder="Ex.: Qual produto você tem interesse?"
          className="flex-1 rounded-xl border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
        />
        <button
          type="submit"
          disabled={salvando || !novaPergunta.trim()}
          className="flex items-center gap-1.5 rounded-xl bg-aura-petrol-700 px-4 py-2 text-sm font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-50"
        >
          <Plus size={14} />
          Adicionar
        </button>
      </form>
    </div>
  );
}
