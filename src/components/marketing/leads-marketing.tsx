"use client";

import { useEffect, useState } from "react";
import { Loader2, Phone, MessageSquare } from "lucide-react";
import { listarLeads, type Lead } from "@/lib/supabase/leads";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { EstadoVazio, StatCard } from "@/components/ui";

const LABEL_STATUS: Record<string, { texto: string; cor: string }> = {
  aguardando_sdr: { texto: "Em qualificação", cor: "aura-selo-neutro" },
  atribuido_sdr: { texto: "Com o SDR", cor: "aura-selo-marca" },
  respondido: { texto: "Respondido", cor: "aura-selo-sucesso" },
  repassado_vendedor: { texto: "Com o vendedor", cor: "aura-selo-marca" },
  perdido: { texto: "Perdido", cor: "aura-selo-perigo" },
};

export function LeadsMarketing() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    const lista = await listarLeads();
    if (lista) setLeads(lista);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const canal = supabase
      .channel("aura-marketing-leads-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads_recebidos" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const porStatus = leads.reduce<Record<string, number>>((mapa, l) => {
    mapa[l.status] = (mapa[l.status] ?? 0) + 1;
    return mapa;
  }, {});
  const respondidos = leads.filter((l) => l.status === "respondido").length;
  const taxaResposta = leads.length > 0 ? Math.round((respondidos / leads.length) * 100) : 0;

  if (carregando) {
    return (
      <div className="aura-card flex justify-center py-12 text-aura-graphite-soft">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <StatCard rotulo="Total" valor={leads.length} />
        {Object.entries(LABEL_STATUS).map(([status, { texto }]) => (
          <StatCard key={status} rotulo={texto} valor={porStatus[status] ?? 0} />
        ))}
        <StatCard rotulo="Taxa de resposta" valor={`${taxaResposta}%`} tom="sucesso" />
      </div>

      <div className="aura-card p-5">
        <p className="text-sm font-semibold text-aura-graphite">Todos os leads</p>
        {leads.length === 0 ? (
          <EstadoVazio titulo="Nenhum lead recebido ainda." className="mt-4" />
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-aura-mist">
            {leads.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-aura-graphite">{l.nome || "Contato novo"}</p>
                    <p className="flex items-center gap-1 text-xs text-aura-graphite-soft">
                      <Phone size={11} />
                      {l.telefone} · {l.origem}
                    </p>
                  </div>
                  <span className={`aura-selo shrink-0 ${LABEL_STATUS[l.status]?.cor ?? "aura-selo-neutro"}`}>
                    {LABEL_STATUS[l.status]?.texto}
                  </span>
                </div>
                {l.resumoIa && (
                  <p className="flex items-start gap-1.5 text-xs italic text-aura-graphite-soft">
                    <MessageSquare size={11} className="mt-0.5 shrink-0" />
                    {l.resumoIa}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
