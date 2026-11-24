"use client";

import { useState } from "react";
import { GraduationCap, Loader2, Sparkles } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { CardHeader } from "@/components/ui";

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
    <div className="aura-card p-5">
      <CardHeader
        titulo="Modo Academia"
        icone={GraduationCap}
        className="mb-3"
        descricao={
          <>
            Escolha o que você quer melhorar — a AURA Coach sugere script, boas práticas e um
            exercício, com base no manual da {profile.empresa}.
          </>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {TEMAS.map((tema) => (
          <button
            key={tema}
            type="button"
            onClick={() => escolherTema(tema)}
            aria-pressed={temaEscolhido === tema}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
              temaEscolhido === tema
                ? "border-aura-petrol-500/40 bg-aura-petrol-500/10 text-aura-petrol-600"
                : "border-aura-mist bg-aura-surface text-aura-graphite-soft hover:bg-aura-sunken hover:text-aura-graphite"
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
        <div className="mt-4 rounded-lg border border-aura-mist bg-aura-sunken/50 p-4">
          <p className="aura-rotulo mb-1.5 flex items-center gap-1.5 text-aura-petrol-600">
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
