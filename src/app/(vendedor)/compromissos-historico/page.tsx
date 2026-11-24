"use client";

import { useEffect, useState } from "react";
import { Loader2, Calendar } from "lucide-react";
import { PageContainer, PageHeader, Selo, EstadoVazio } from "@/components/ui";
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
    <PageContainer largura="normal">
      <PageHeader
        titulo="Histórico de Compromissos"
        descricao="Seus compromissos enviados"
        icone={Calendar}
      />

      {/* Conteúdo */}
      {carregando ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-aura-petrol-600" />
        </div>
      ) : compromissos.length === 0 ? (
        <EstadoVazio icone={Calendar} titulo="Nenhum compromisso enviado ainda" />
      ) : (
        <div className="space-y-3">
          {compromissos.map((comp) => (
            <div
              key={comp.id}
              className="aura-card aura-card-interativo p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold capitalize text-aura-graphite">
                    {formatarMes(comp.mes)}
                  </p>
                  <p className="mt-0.5 text-sm text-aura-graphite-soft">
                    Objetivo: {comp.objetivoPessoal}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <p className="aura-rotulo">Faturamento</p>
                      <p className="mt-0.5 text-sm font-medium tabular-nums text-aura-graphite">R$ {(comp.metaFaturamento || 0).toLocaleString("pt-BR")}</p>
                    </div>
                    <div>
                      <p className="aura-rotulo">Clientes Novos</p>
                      <p className="mt-0.5 text-sm font-medium tabular-nums text-aura-graphite">{(comp.metaClientesNovos || 0)}</p>
                    </div>
                    <div>
                      <p className="aura-rotulo">Arquitetos</p>
                      <p className="mt-0.5 text-sm font-medium tabular-nums text-aura-graphite">{(comp.metaArquitetos || 0)}</p>
                    </div>
                    <div>
                      <p className="aura-rotulo">Visitas</p>
                      <p className="mt-0.5 text-sm font-medium tabular-nums text-aura-graphite">{(comp.metaVisitas || 0)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <Selo
                    tom={
                      comp.status === "aprovado"
                        ? "sucesso"
                        : comp.status === "rejeitado"
                          ? "perigo"
                          : "atencao"
                    }
                  >
                    {comp.status === "aprovado"
                      ? "Aprovado"
                      : comp.status === "rejeitado"
                        ? "Rejeitado"
                        : "Enviado"}
                  </Selo>
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
    </PageContainer>
  );
}
