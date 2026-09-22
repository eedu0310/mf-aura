"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { listarLeadsEscalonados, type LeadEscalonado } from "@/lib/supabase/leads";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function formatarAtraso(prazo: string | null) {
  if (!prazo) return "";
  const minutos = Math.round((Date.now() - new Date(prazo).getTime()) / 60000);
  if (minutos < 60) return `${minutos} min de atraso`;
  return `${Math.round(minutos / 60)}h de atraso`;
}

export function AlertaLeadsSemResposta() {
  const [leads, setLeads] = useState<LeadEscalonado[]>([]);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    const lista = await listarLeadsEscalonados();
    setLeads(lista);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const canal = supabase
      .channel("aura-gestor-leads-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads_recebidos" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  if (carregando || leads.length === 0) return null;

  return (
    <div className="rounded-2xl border border-aura-danger/30 bg-aura-danger/5 p-5">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-aura-graphite">
        <AlertTriangle size={15} className="text-aura-danger" />
        {leads.length} vendedor{leads.length > 1 ? "es" : ""} não respondeu{leads.length > 1 ? "ram" : ""} um lead a tempo
      </p>
      <ul className="mt-2 flex flex-col divide-y divide-aura-danger/10">
        {leads.slice(0, 6).map((lead) => (
          <li key={lead.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
            <div>
              <p className="text-sm font-medium text-aura-graphite">
                {lead.vendedorNome} <span className="font-normal text-aura-graphite-soft">→ {lead.nome || lead.telefone}</span>
              </p>
              <p className="text-xs text-aura-graphite-soft">
                {lead.empresa}
                {lead.resumoIa ? ` · ${lead.resumoIa}` : ""}
              </p>
            </div>
            <span className="shrink-0 text-xs font-medium text-aura-danger">
              {formatarAtraso(lead.prazoResposta)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
