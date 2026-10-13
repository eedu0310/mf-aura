"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ClipboardCheck,
  Check,
  X,
  Loader2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import {
  buscarPanoramaDeMetas,
  aprovarCompromisso,
  rejeitarCompromisso,
  removerCompromisso,
  type MetaNoPanorama,
} from "@/lib/supabase/compromisso-mensal";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatarReais } from "@/lib/formato/moeda";

const ROTULO_STATUS: Record<string, { texto: string; classe: string }> = {
  rascunho: { texto: "Rascunho (não enviada)", classe: "bg-gray-100 text-gray-700" },
  pendente_aprovacao: { texto: "Aguardando você", classe: "bg-yellow-100 text-yellow-700" },
  ajuste_solicitado: { texto: "Ajuste pedido", classe: "bg-orange-100 text-orange-700" },
  aprovado: { texto: "Aprovada", classe: "bg-green-100 text-green-700" },
  rejeitado: { texto: "Rejeitada", classe: "bg-red-100 text-red-700" },
};

function mesDeHoje() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
}

function deslocarMes(mes: string, passos: number) {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(ano, m - 1 + passos, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function rotuloDoMes(mes: string) {
  const [ano, m] = mes.split("-").map(Number);
  return new Date(ano, m - 1, 1).toLocaleString("pt-BR", { month: "long", year: "numeric" });
}

export function AprovacaoCompromissosMensais() {
  const { profile } = useUserProfile();
  const [mes, setMes] = useState(mesDeHoje);
  const [linhas, setLinhas] = useState<MetaNoPanorama[]>([]);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  const ehVendedor = profile.cargo === "Vendedor" || profile.cargo === "Vendedor Interno";

  const carregar = useCallback(async () => {
    if (ehVendedor) return;
    setCarregando(true);
    try {
      setLinhas(await buscarPanoramaDeMetas(mes));
      setErro(null);
    } catch (e) {
      // Erro de leitura vira aviso na tela. Lista vazia silenciosa já fez o
      // gestor acreditar que a equipe toda tinha mandado meta.
      setErro(e instanceof Error ? e.message : "Não consegui carregar as metas.");
      setLinhas([]);
    } finally {
      setCarregando(false);
    }
  }, [mes, ehVendedor]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (ehVendedor) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const canal = supabase
      .channel("aura-metas-panorama-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "compromissos_mensais" },
        () => void carregar(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregar, ehVendedor]);

  if (ehVendedor) return null;

  async function executar(id: string, acao: () => Promise<string | null>) {
    setProcessando(id);
    setErro(null);
    setRecado(null);
    try {
      const aviso = await acao();
      if (aviso) setRecado(aviso);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "A operação não foi concluída.");
    } finally {
      setProcessando(null);
    }
  }

  const semMeta = linhas.filter((l) => !l.compromisso);
  const aguardando = linhas.filter((l) => l.compromisso?.status === "pendente_aprovacao");

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={18} className="text-aura-petrol-600" />
          <p className="font-medium text-aura-graphite">Metas do mês</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMes(deslocarMes(mes, -1))}
            className="rounded-lg border border-aura-mist p-1.5 hover:bg-aura-bg"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[9rem] text-center text-sm font-medium capitalize text-aura-graphite">
            {rotuloDoMes(mes)}
          </span>
          <button
            type="button"
            onClick={() => setMes(deslocarMes(mes, 1))}
            className="rounded-lg border border-aura-mist p-1.5 hover:bg-aura-bg"
            aria-label="Mês seguinte"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {erro && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}
      {recado && (
        <div className="mb-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
          Feito, mas o vendedor não foi avisado: {recado}
        </div>
      )}

      {carregando ? (
        <p className="flex items-center gap-2 text-sm text-aura-graphite-soft">
          <Loader2 size={14} className="animate-spin" /> Carregando metas...
        </p>
      ) : linhas.length === 0 ? (
        <p className="text-sm text-aura-graphite-soft">Nenhum vendedor ativo no seu acesso.</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-aura-graphite-soft">
            {aguardando.length > 0 && (
              <span className="font-medium text-yellow-700">
                {aguardando.length} aguardando sua aprovação.{" "}
              </span>
            )}
            {semMeta.length > 0 ? (
              <span className="font-medium text-red-700">
                {semMeta.length} sem meta nenhuma: {semMeta.map((l) => l.vendedorNome).join(", ")}.
              </span>
            ) : (
              <span>Todo mundo mandou meta.</span>
            )}
          </p>

          <div className="space-y-3">
            {linhas.map((linha) => {
              const comp = linha.compromisso;
              const chave = comp?.id ?? linha.vendedorId;
              const status = comp ? ROTULO_STATUS[comp.status] : null;
              const ocupado = processando === chave;
              return (
                <div
                  key={chave}
                  className={`rounded-lg border p-4 transition ${
                    comp
                      ? "border-aura-mist bg-aura-bg hover:border-aura-petrol-300"
                      : "border-red-200 bg-red-50/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => comp && setExpandido(expandido === comp.id ? null : comp.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-aura-graphite">{linha.vendedorNome}</p>
                        <p className="text-xs text-aura-graphite-soft">
                          {linha.empresa}
                          {comp
                            ? ` • Meta: ${formatarReais(comp.metaFaturamento)}`
                            : " • ainda não mandou a meta"}
                        </p>
                      </div>
                      {status ? (
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${status.classe}`}
                        >
                          {status.texto}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                          Sem meta
                        </span>
                      )}
                    </div>
                  </button>

                  {comp && expandido === comp.id && (
                    <div className="mt-4 space-y-3 border-t border-aura-mist pt-4">
                      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                        {[
                          ["Clientes novos", comp.metaClientesNovos],
                          ["Arquitetos", comp.metaArquitetos],
                          ["Construtoras", comp.metaConstrutoras],
                          ["Obras", comp.metaObras],
                          ["Visitas", comp.metaVisitas],
                          ["Ligações", comp.metaLigacoes],
                        ].map(([rotulo, valor]) => (
                          <div key={String(rotulo)}>
                            <p className="text-aura-graphite-soft">{rotulo}</p>
                            <p className="font-medium text-aura-graphite">{valor}</p>
                          </div>
                        ))}
                      </div>

                      {comp.objetivoPessoal && (
                        <div>
                          <p className="text-xs text-aura-graphite-soft">Objetivo pessoal</p>
                          <p className="text-sm text-aura-graphite">{comp.objetivoPessoal}</p>
                        </div>
                      )}

                      {comp.feedbackGestor && (
                        <div>
                          <p className="text-xs text-aura-graphite-soft">Seu recado anterior</p>
                          <p className="text-sm text-aura-graphite">{comp.feedbackGestor}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-2">
                        {comp.status !== "aprovado" && (
                          <button
                            type="button"
                            onClick={() =>
                              void executar(comp.id, async () => {
                                await aprovarCompromisso(comp.id);
                                return null;
                              })
                            }
                            disabled={ocupado}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-100 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-200 disabled:opacity-50"
                          >
                            {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            Aprovar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const motivo = prompt("O que precisa ser ajustado na meta?");
                            if (!motivo || !motivo.trim()) return;
                            void executar(comp.id, async () => {
                              await rejeitarCompromisso(comp.id, motivo.trim());
                              return null;
                            });
                          }}
                          disabled={ocupado}
                          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-orange-100 px-3 py-2 text-sm font-medium text-orange-700 transition hover:bg-orange-200 disabled:opacity-50"
                        >
                          {ocupado ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                          Pedir ajuste
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const confirmado = confirm(
                              `Excluir a meta de ${linha.vendedorNome} de ${rotuloDoMes(comp.mes)}?\n\n` +
                                "A meta é apagada e o vendedor recebe uma notificação para preencher de novo. Não tem como desfazer.",
                            );
                            if (!confirmado) return;
                            const motivo = prompt("Motivo (vai no aviso para o vendedor, pode deixar vazio):");
                            void executar(comp.id, async () => {
                              const r = await removerCompromisso(comp.id, motivo?.trim() || undefined);
                              return r.avisoFalhou;
                            });
                          }}
                          disabled={ocupado}
                          className="flex items-center justify-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-200 disabled:opacity-50"
                        >
                          {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          Excluir meta
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
