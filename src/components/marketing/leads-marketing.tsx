"use client";

import { useEffect, useState } from "react";
import { Loader2, Phone, MessageSquare } from "lucide-react";
import { listarLeads, type Lead } from "@/lib/supabase/leads";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const LABEL_STATUS: Record<string, { texto: string; cor: string }> = {
  aguardando_sdr: { texto: "Em qualificação", cor: "bg-aura-graphite-soft/15 text-aura-graphite-soft" },
  atribuido_sdr: { texto: "Com o SDR", cor: "bg-aura-petrol-700/10 text-aura-petrol-700" },
  respondido: { texto: "Respondido", cor: "bg-aura-success/10 text-aura-success" },
  repassado_vendedor: { texto: "Com o vendedor", cor: "bg-aura-petrol-700/10 text-aura-petrol-700" },
  perdido: { texto: "Perdido", cor: "bg-aura-danger/10 text-aura-danger" },
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
      <div className="flex justify-center rounded-2xl border border-aura-mist bg-white py-12 text-aura-graphite-soft">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        <div className="rounded-xl border border-aura-mist bg-white p-3 text-center">
          <p className="font-display text-lg font-bold text-aura-graphite">{leads.length}</p>
          <p className="text-[0.65rem] text-aura-graphite-soft">Total</p>
        </div>
        {Object.entries(LABEL_STATUS).map(([status, { texto }]) => (
          <div key={status} className="rounded-xl border border-aura-mist bg-white p-3 text-center">
            <p className="font-display text-lg font-bold text-aura-graphite">{porStatus[status] ?? 0}</p>
            <p className="text-[0.65rem] text-aura-graphite-soft">{texto}</p>
          </div>
        ))}
        <div className="rounded-xl border border-aura-mist bg-white p-3 text-center">
          <p className="font-display text-lg font-bold text-aura-success">{taxaResposta}%</p>
          <p className="text-[0.65rem] text-aura-graphite-soft">Taxa de resposta</p>
        </div>
      </div>

      <div className="rounded-2xl border border-aura-mist bg-white p-5">
        <p className="text-sm font-medium text-aura-graphite">Todos os leads</p>
        {leads.length === 0 ? (
          <p className="mt-4 text-center text-sm text-aura-graphite-soft">Nenhum lead recebido ainda.</p>
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
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${LABEL_STATUS[l.status]?.cor}`}>
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
