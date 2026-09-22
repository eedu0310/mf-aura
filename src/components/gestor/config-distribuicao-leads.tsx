"use client";

import { useEffect, useState } from "react";
import { Timer, Check } from "lucide-react";
import { buscarConfigDistribuicao, definirConfigDistribuicao } from "@/lib/supabase/leads";
import { useUserProfile } from "@/lib/user-profile-context";

export function ConfigDistribuicaoLeads() {
  const { profile } = useUserProfile();
  const [minutos, setMinutos] = useState("15");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    buscarConfigDistribuicao().then((valor) => {
      if (valor) setMinutos(String(valor));
      setCarregando(false);
    });
  }, []);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const numero = Number(minutos);
    if (!numero || numero < 1) return;
    setSalvando(true);
    const ok = await definirConfigDistribuicao(profile.empresa, numero);
    setSalvando(false);
    if (ok) {
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
    }
  }

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <div className="flex items-center gap-2">
        <Timer size={16} className="text-aura-petrol-600" />
        <p className="text-sm font-medium text-aura-graphite">Prazo de Resposta a Leads</p>
      </div>
      <p className="mt-1 text-xs text-aura-graphite-soft">
        Quando um lead chega, ele é atribuído a um vendedor com esse prazo pra responder (se
        houver um SDR cadastrado na loja, ele responde primeiro). Se o prazo vencer sem resposta,
        você é avisado aqui no painel.
      </p>

      {carregando ? (
        <p className="mt-3 text-xs text-aura-graphite-soft">Carregando...</p>
      ) : (
        <form onSubmit={salvar} className="mt-3 flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={minutos}
            onChange={(e) => setMinutos(e.target.value)}
            className="w-24 rounded-xl border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500"
          />
          <span className="text-sm text-aura-graphite-soft">minutos</span>
          <button
            type="submit"
            disabled={salvando}
            className="ml-auto flex items-center gap-1.5 rounded-xl bg-aura-petrol-700 px-4 py-2 text-sm font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-60"
          >
            <Check size={14} />
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </form>
      )}
      {salvo && <p className="mt-2 text-xs font-medium text-aura-success">Salvo!</p>}
    </div>
  );
}
