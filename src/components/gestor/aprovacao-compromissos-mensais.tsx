"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, Check, MessageCircleWarning, X, Loader2 } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import {
  buscarCompromissosPendentes,
  aprovarCompromisso,
  rejeitarCompromisso,
  type CompromissoMensalComVendedor,
} from "@/lib/supabase/compromisso-mensal";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", { 
    style: "currency", 
    currency: "BRL", 
    maximumFractionDigits: 0 
  }).format(valor);
}

export function AprovacaoCompromissosMensais() {
  const { profile } = useUserProfile();
  const [pendentes, setPendentes] = useState<CompromissoMensalComVendedor[]>([]);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);

  async function carregar() {
    const lista = await buscarCompromissosPendentes();
    setPendentes(lista);
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const canal = supabase
      .channel("aura-compromissos-pendentes-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "compromissos_mensais" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  // ✅ Se for vendedor, não mostra este componente
  if (profile.cargo === "Vendedor" || profile.cargo === "Vendedor Interno") {
    return null;
  }

  async function handleAprovar(id: string, feedback?: string) {
    setProcessando(id);
    const sucesso = await aprovarCompromisso(id, feedback);
    if (sucesso) {
      await carregar();
    }
    setProcessando(null);
  }

  async function handleRejeitar(id: string, feedback: string) {
    if (!feedback.trim()) {
      alert("Insira um feedback para rejeição");
      return;
    }
    setProcessando(id);
    const sucesso = await rejeitarCompromisso(id, feedback);
    if (sucesso) {
      await carregar();
    }
    setProcessando(null);
  }

  if (pendentes.length === 0) {
    return (
      <div className="rounded-2xl border border-aura-mist bg-white p-5">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={16} className="text-aura-petrol-600" />
          <p className="text-sm text-aura-graphite-soft">
            Nenhum compromisso pendente de aprovação
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <ClipboardCheck size={18} className="text-aura-petrol-600" />
        <p className="font-medium text-aura-graphite">
          Compromissos Pendentes ({pendentes.length})
        </p>
      </div>

      <div className="space-y-3">
        {pendentes.map((comp) => (
          <div
            key={comp.id}
            className="rounded-lg border border-aura-mist bg-aura-bg p-4 transition hover:border-aura-petrol-300"
          >
            <button
              onClick={() => setExpandido(expandido === comp.id ? null : comp.id)}
              className="w-full text-left"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-aura-graphite">{comp.vendedorNome}</p>
                  <p className="text-xs text-aura-graphite-soft">
                    {comp.mes} • Meta: {formatarMoeda(comp.metaFaturamento)}
                  </p>
                </div>
                <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
                  Pendente
                </span>
              </div>
            </button>

            {/* Detalhes */}
            {expandido === comp.id && (
              <div className="mt-4 space-y-3 border-t border-aura-mist pt-4">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-aura-graphite-soft">Clientes Novos</p>
                    <p className="font-medium text-aura-graphite">{comp.metaClientesNovos}</p>
                  </div>
                  <div>
                    <p className="text-aura-graphite-soft">Arquitetos</p>
                    <p className="font-medium text-aura-graphite">{comp.metaArquitetos}</p>
                  </div>
                  <div>
                    <p className="text-aura-graphite-soft">Visitas</p>
                    <p className="font-medium text-aura-graphite">{comp.metaVisitas}</p>
                  </div>
                  <div>
                    <p className="text-aura-graphite-soft">Ligações</p>
                    <p className="font-medium text-aura-graphite">{comp.metaLigacoes}</p>
                  </div>
                </div>

                {comp.objetivoPessoal && (
                  <div>
                    <p className="text-xs text-aura-graphite-soft">Objetivo Pessoal</p>
                    <p className="text-sm text-aura-graphite">{comp.objetivoPessoal}</p>
                  </div>
                )}

                {/* Ações */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleAprovar(comp.id)}
                    disabled={processando === comp.id}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-200 disabled:opacity-50"
                  >
                    {processando === comp.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    Aprovar
                  </button>
                  <button
                    onClick={() => {
                      const feedback = prompt("Motivo da rejeição:");
                      if (feedback) {
                        handleRejeitar(comp.id, feedback);
                      }
                    }}
                    disabled={processando === comp.id}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-200 disabled:opacity-50"
                  >
                    {processando === comp.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <X size={14} />
                    )}
                    Rejeitar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
