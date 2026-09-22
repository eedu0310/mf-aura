"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Link2, Loader2 } from "lucide-react";
import { listarLinks, type LinkUtil } from "@/lib/supabase/links";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const CORES_CATEGORIA: Record<string, string> = {
  Catálogo: "bg-aura-petrol-700/10 text-aura-petrol-700",
  Planilha: "bg-aura-success/10 text-aura-success",
  Vendas: "bg-aura-gold/15 text-[#8a6a1c]",
  Marketing: "bg-aura-warning/10 text-aura-warning",
};

export default function AreaVendedorPage() {
  const [links, setLinks] = useState<LinkUtil[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [usandoSupabase, setUsandoSupabase] = useState(true);

  async function carregar() {
    const lista = await listarLinks();
    if (lista === null) {
      setUsandoSupabase(false);
    } else {
      setLinks(lista);
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
     
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const canal = supabase
      .channel("aura-links-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "links_uteis" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
     
  }, []);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-24">
      <div>
        <p className="font-display text-xl font-semibold text-aura-graphite">Área do Vendedor</p>
        <p className="text-sm text-aura-graphite-soft">
          Links importantes do dia a dia — catálogo, planilhas e materiais.
        </p>
      </div>

      <a href="/mapa-comercial" className="flex items-center justify-between rounded-2xl border border-aura-petrol-200 bg-aura-petrol-700/5 p-4 transition hover:border-aura-petrol-500">
        <div>
          <p className="text-sm font-semibold text-aura-graphite">Mapa Comercial</p>
          <p className="mt-1 text-xs text-aura-graphite-soft">Cadência, scripts, objeções e mensagens para facilitar o atendimento.</p>
        </div>
        <span className="rounded-lg bg-aura-petrol-700 px-3 py-2 text-xs font-semibold text-white">Abrir</span>
      </a>

      {!usandoSupabase && (
        <p className="rounded-xl bg-aura-warning/10 px-4 py-2.5 text-xs text-aura-warning">
          Supabase não configurado — essa área precisa dele para funcionar.
        </p>
      )}

      {carregando ? (
        <div className="flex justify-center py-16 text-aura-graphite-soft">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : links.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-aura-mist bg-white/60 px-6 py-16 text-center">
          <Link2 size={24} className="text-aura-graphite-soft" />
          <p className="text-sm text-aura-graphite-soft">
            Seu gestor ainda não cadastrou nenhum link nesta loja.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-aura-mist bg-white p-4 transition hover:border-aura-petrol-500/40 hover:shadow-sm"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-aura-petrol-700/10 text-aura-petrol-700">
                <Link2 size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-aura-graphite">{link.titulo}</p>
                <p className="truncate text-xs text-aura-graphite-soft">{link.url}</p>
              </div>
              {link.categoria && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${
                    CORES_CATEGORIA[link.categoria] ?? "bg-aura-bg text-aura-graphite-soft"
                  }`}
                >
                  {link.categoria}
                </span>
              )}
              <ExternalLink size={14} className="shrink-0 text-aura-graphite-soft" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
