"use client";

import { useEffect, useState } from "react";
import { MapPinned, ExternalLink, Loader2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type PontoComercial = {
  id: string;
  titulo: string;
  contexto: string | null;
  endereco: string | null;
  latitude: number;
  longitude: number;
  ocorrida_em: string | null;
};

export function MapaComercial() {
  const [pontos, setPontos] = useState<PontoComercial[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setCarregando(false);
      return;
    }
    const clienteSupabase = supabase;
    async function carregarPontos() {
      try {
        const { data } = await clienteSupabase
          .from("atividades")
          .select("id,titulo,contexto,endereco,latitude,longitude,ocorrida_em")
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .order("ocorrida_em", { ascending: false })
          .limit(12);
        setPontos((data ?? []) as PontoComercial[]);
      } finally {
        setCarregando(false);
      }
    }
    void carregarPontos();
  }, []);

  return (
    <section aria-labelledby="mapa-comercial-titulo" className="overflow-hidden rounded-2xl border border-aura-mist bg-white">
      <div className="flex items-center gap-3 border-b border-aura-mist px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-aura-petrol-700/10 text-aura-petrol-700"><MapPinned size={18} aria-hidden="true" /></span>
        <div>
          <h2 id="mapa-comercial-titulo" className="text-sm font-semibold text-aura-graphite">Mapa comercial</h2>
          <p className="text-xs text-aura-graphite-soft">Pontos de atendimento registrados pelo vendedor.</p>
        </div>
      </div>
      {carregando ? (
        <div className="flex min-h-28 items-center justify-center"><Loader2 className="animate-spin text-aura-petrol-700" size={20} /></div>
      ) : pontos.length === 0 ? (
        <div className="flex min-h-28 items-center justify-center bg-aura-bg px-6 py-8 text-center"><p className="max-w-sm text-xs text-aura-graphite-soft">Registre uma visita com localização para começar o mapa comercial.</p></div>
      ) : (
        <div className="grid gap-2 bg-aura-bg p-3 sm:grid-cols-2">
          {pontos.map((ponto) => (
            <a key={ponto.id} href={`https://www.google.com/maps/?q=${ponto.latitude},${ponto.longitude}`} target="_blank" rel="noreferrer" className="rounded-xl border border-aura-mist bg-white p-3 transition hover:border-aura-petrol-500">
              <div className="flex items-start gap-2"><MapPinned size={15} className="mt-0.5 shrink-0 text-aura-petrol-700" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-aura-graphite">{ponto.contexto || ponto.titulo}</p><p className="mt-1 truncate text-[0.7rem] text-aura-graphite-soft">{ponto.endereco || `${ponto.latitude.toFixed(5)}, ${ponto.longitude.toFixed(5)}`}</p></div><ExternalLink size={13} className="shrink-0 text-aura-graphite-soft" /></div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
