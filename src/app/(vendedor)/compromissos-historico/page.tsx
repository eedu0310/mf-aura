"use client";

import { useEffect, useState } from "react";
import { Loader2, Calendar } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Compromisso {
  id: string;
  mes: string;
  metaFaturamento: number;
  metaClientesNovos: number;
  metaArquitetos: number;
  metaConstrutoras: number;
  metaObras: number;
  metaVisitas: number;
  metaLigacoes: number;
  objetivoPessoal: string;
  status: "enviado" | "aprovado" | "rejeitado";
  feedbackGestor?: string;
  dataEnvio: string;
  aprovadoPor?: string;
}

export default function CompromissosHistoricoPage() {
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        setCarregando(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setCarregando(false);
          return;
        }

        const { data } = await supabase
          .from("compromissos_mensais")
          .select("*")
          .eq("vendedor_id", user.id)
          .order("mes", { ascending: false });

        if (data) {
          setCompromissos(
            data.map((c: any) => ({
              id: c.id,
              mes: c.mes,
              metaFaturamento: c.meta_faturamento || 0,
              metaClientesNovos: c.meta_clientes_novos || 0,
              metaArquitetos: c.meta_arquitetos || 0,
              metaConstrutoras: c.meta_construtoras || 0,
              metaObras: c.meta_obras || 0,
              metaVisitas: c.meta_visitas || 0,
              metaLigacoes: c.meta_ligacoes || 0,
              objetivoPessoal: c.objetivo_pessoal || "Não informado",
              status: c.status || "enviado",
              feedbackGestor: c.feedback_gestor,
              dataEnvio: c.data_envio,
              aprovadoPor: c.aprovado_por,
            }))
          );
        }
      } catch (erro) {
        console.error("Erro ao carregar compromissos:", erro);
      }

      setCarregando(false);
    }

    carregar();
  }, []);

  const formatarMes = (mes: string) => {
    if (!mes) return "Sem data";
    const [ano, mesNum] = mes.split("-");
    return new Date(parseInt(ano), parseInt(mesNum) - 1).toLocaleString("pt-BR", {
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-semibold text-aura-graphite">
          Histórico de Compromissos
        </h1>
        <p className="text-sm text-aura-graphite-soft">
          Seus compromissos enviados
        </p>
      </div>

      {/* Conteúdo */}
      {carregando ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-aura-petrol-600" />
        </div>
      ) : compromissos.length === 0 ? (
        <div className="rounded-2xl border border-aura-mist bg-white p-8 text-center">
          <Calendar size={32} className="mx-auto mb-3 text-aura-graphite-soft" />
          <p className="text-aura-graphite-soft">Nenhum compromisso enviado ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {compromissos.map((comp) => (
            <div
              key={comp.id}
              className="rounded-2xl border border-aura-mist bg-white p-5 transition hover:border-aura-petrol-300"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-aura-graphite">
                    {formatarMes(comp.mes)}
                  </p>
                  <p className="text-sm text-aura-graphite-soft">
                    Objetivo: {comp.objetivoPessoal}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-aura-graphite-soft sm:grid-cols-4">
                    <div>
                      <p className="font-medium">Faturamento</p>
                      <p>R$ {(comp.metaFaturamento || 0).toLocaleString("pt-BR")}</p>
                    </div>
                    <div>
                      <p className="font-medium">Clientes Novos</p>
                      <p>{(comp.metaClientesNovos || 0)}</p>
                    </div>
                    <div>
                      <p className="font-medium">Arquitetos</p>
                      <p>{(comp.metaArquitetos || 0)}</p>
                    </div>
                    <div>
                      <p className="font-medium">Visitas</p>
                      <p>{(comp.metaVisitas || 0)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      comp.status === "aprovado"
                        ? "bg-green-100 text-green-700"
                        : comp.status === "rejeitado"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {comp.status === "aprovado"
                      ? "Aprovado"
                      : comp.status === "rejeitado"
                        ? "Rejeitado"
                        : "Enviado"}
                  </span>
                  {comp.feedbackGestor && (
                    <p className="max-w-xs text-right text-xs text-aura-graphite-soft">
                      {comp.feedbackGestor}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}