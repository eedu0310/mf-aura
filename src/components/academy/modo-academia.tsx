"use client";

import { useState } from "react";
import { GraduationCap, Loader2, Sparkles } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";

const TEMAS = [
  "Fechados",
  "Prospecção",
  "Follow-up",
  "Negociação",
  "Ticket médio",
  "Atendimento",
  "Conversão",
];

export function ModoAcademia() {
  const { profile } = useUserProfile();
  const [temaEscolhido, setTemaEscolhido] = useState<string | null>(null);
  const [resposta, setResposta] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function escolherTema(tema: string) {
    setTemaEscolhido(tema);
    setResposta(null);
    setCarregando(true);

    try {
      const resp = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modo: "chat",
          mensagens: [
            {
              autor: "usuario",
              texto: `Quero melhorar especificamente em: ${tema}. Com base no manual de vendas e nas boas práticas da empresa, me dá: (1) um script ou frase pronta que eu possa usar de verdade nessa área, (2) 2-3 boas práticas objetivas, (3) um exercício prático rápido pra eu treinar essa semana. Seja direto e específico pro meu dia a dia, não genérico.`,
            },
          ],
        }),
      });
      const dados = await resp.json();
      setResposta(dados.resposta ?? "Não consegui gerar sugestões agora.");
    } catch {
      setResposta("Não consegui gerar sugestões agora. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <div className="flex items-center gap-2">
        <GraduationCap size={16} className="text-aura-petrol-600" />
        <p className="text-sm font-medium text-aura-graphite">Modo Academia</p>
      </div>
      <p className="mt-1 text-xs text-aura-graphite-soft">
        Escolha o que você quer melhorar — a AURA Coach sugere script, boas práticas e um
        exercício, com base no manual da {profile.empresa}.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {TEMAS.map((tema) => (
          <button
            key={tema}
            type="button"
            onClick={() => escolherTema(tema)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              temaEscolhido === tema
                ? "border-aura-petrol-700 bg-aura-petrol-700 text-white"
                : "border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-500/50"
            }`}
          >
            {tema}
          </button>
        ))}
      </div>

      {carregando && (
        <div className="mt-4 flex items-center gap-2 text-sm text-aura-graphite-soft">
          <Loader2 size={15} className="animate-spin" />
          Preparando sugestões sobre {temaEscolhido}...
        </div>
      )}

      {resposta && !carregando && (
        <div className="mt-4 rounded-xl border border-aura-petrol-700/15 bg-aura-petrol-700/[0.04] p-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-aura-petrol-700">
            <Sparkles size={12} />
            {temaEscolhido}
          </p>
          <div className="whitespace-pre-line text-sm leading-relaxed text-aura-graphite">
            {resposta}
          </div>
        </div>
      )}
    </div>
  );
}
