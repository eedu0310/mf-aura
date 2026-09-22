"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Phone, MessageSquare, CheckCircle2, Clock, XCircle, Users, AlertTriangle, Trash2 } from "lucide-react";
import {
  listarLeads,
  marcarLeadRespondido,
  marcarLeadPerdido,
  excluirLead,
  buscarDiasSemAtividade,
  type Lead,
  type StatusLead,
} from "@/lib/supabase/leads";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const STATUS_LABEL: Record<StatusLead, string> = {
  aguardando_sdr: "Aguardando distribuição",
  atribuido_sdr: "Com o SDR",
  respondido: "Respondido",
  repassado_vendedor: "Com o vendedor",
  perdido: "Perdido",
};

const STATUS_COR: Record<StatusLead, string> = {
  aguardando_sdr: "bg-aura-graphite-soft/15 text-aura-graphite-soft",
  atribuido_sdr: "bg-aura-petrol-700/10 text-aura-petrol-700",
  respondido: "bg-aura-success/10 text-aura-success",
  repassado_vendedor: "bg-aura-petrol-700/10 text-aura-petrol-700",
  perdido: "bg-aura-danger/10 text-aura-danger",
};

const URGENCIA_LABEL: Record<string, { texto: string; cor: string }> = {
  alta: { texto: "Urgente", cor: "bg-aura-danger/10 text-aura-danger" },
  media: { texto: "Moderada", cor: "bg-aura-warning/10 text-aura-warning" },
  baixa: { texto: "Baixa urgência", cor: "bg-aura-graphite-soft/15 text-aura-graphite-soft" },
};

function tempoRestante(prazo: string | null) {
  if (!prazo) return null;
  const diffMs = new Date(prazo).getTime() - Date.now();
  const minutos = Math.round(diffMs / 60000);
  if (minutos <= 0) return "Prazo esgotado";
  if (minutos < 60) return `${minutos} min restantes`;
  return `${Math.round(minutos / 60)}h restantes`;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [diasSemAtividade, setDiasSemAtividade] = useState<Map<string, number>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("todas");

  async function carregar() {
    const lista = await listarLeads();
    if (lista) {
      setLeads(lista);
      const ids = lista.map((l) => l.relacionamentoId).filter((id): id is string => Boolean(id));
      buscarDiasSemAtividade(ids).then(setDiasSemAtividade);
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
      .channel("aura-leads-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads_recebidos" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  async function responder(lead: Lead) {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: "respondido" } : l)));
    await marcarLeadRespondido(lead.id);
  }

  async function perder(lead: Lead) {
    const motivo = prompt(`Por que "${lead.nome || lead.telefone}" foi perdido?`, "");
    if (motivo === null) return;
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: "perdido", motivoPerda: motivo } : l)));
    await marcarLeadPerdido(lead.id, motivo);
  }

  async function excluir(lead: Lead) {
    if (!window.confirm(`Excluir o lead ${lead.nome || lead.telefone}? Esta ação não pode ser desfeita.`)) return;
    try {
      await excluirLead(lead.id);
      setLeads((prev) => prev.filter((item) => item.id !== lead.id));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Não foi possível excluir o lead.");
    }
  }

  const lojas = useMemo(() => [...new Set(leads.map((l) => l.empresa))], [leads]);
  const multiLoja = lojas.length > 1;
  const leadsDaLoja = useMemo(
    () => (empresaFiltro === "todas" ? leads : leads.filter((l) => l.empresa === empresaFiltro)),
    [leads, empresaFiltro]
  );

  const ordemUrgencia: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
  const pendentes = leadsDaLoja
    .filter((l) => ["aguardando_sdr", "atribuido_sdr", "repassado_vendedor"].includes(l.status))
    .sort((a, b) => (ordemUrgencia[a.urgencia ?? "media"] ?? 1) - (ordemUrgencia[b.urgencia ?? "media"] ?? 1));
  const perdidos = leadsDaLoja.filter((l) => l.status === "perdido");
  const respondidos = leadsDaLoja.filter((l) => l.status === "respondido");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-24">
      <div>
        <p className="font-display text-xl font-semibold text-aura-graphite">Leads Recebidos</p>
        <p className="text-sm text-aura-graphite-soft">
          Novos contatos chegando automaticamente — responda antes do prazo esgotar.
        </p>
      </div>

      {multiLoja && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEmpresaFiltro("todas")}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              empresaFiltro === "todas"
                ? "border-aura-petrol-700 bg-aura-petrol-700 text-white"
                : "border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-500/50"
            }`}
          >
            Todas as lojas
          </button>
          {lojas.map((loja) => (
            <button
              key={loja}
              type="button"
              onClick={() => setEmpresaFiltro(loja)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                empresaFiltro === loja
                  ? "border-aura-petrol-700 bg-aura-petrol-700 text-white"
                  : "border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-500/50"
              }`}
            >
              {loja}
            </button>
          ))}
        </div>
      )}

      {carregando ? (
        <div className="flex justify-center py-16 text-aura-graphite-soft">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : leadsDaLoja.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-aura-mist bg-white/60 px-6 py-16 text-center">
          <Users size={24} className="text-aura-graphite-soft" />
          <p className="text-sm text-aura-graphite-soft">
            Nenhum lead recebido ainda. Assim que a integração com o WhatsApp estiver ativa, eles
            aparecem aqui automaticamente.
          </p>
        </div>
      ) : (
        <>
          {pendentes.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-aura-graphite">Pendentes de resposta</p>
              <div className="flex flex-col gap-2">
                {pendentes.map((lead) => {
                  const restante = tempoRestante(lead.prazoResposta);
                  const urgente = restante === "Prazo esgotado";
                  const diasParado = lead.relacionamentoId ? diasSemAtividade.get(lead.relacionamentoId) : undefined;
                  return (
                    <div
                      key={lead.id}
                      className={`rounded-2xl border bg-white p-4 ${urgente ? "border-aura-danger/40" : "border-aura-mist"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-aura-graphite">
                            {lead.nome || "Contato novo"}
                          </p>
                          <p className="flex items-center gap-1 text-xs text-aura-graphite-soft">
                            <Phone size={11} />
                            {lead.telefone} · {lead.origem}
                          </p>
                          {multiLoja && empresaFiltro === "todas" && (
                            <span className="mt-1 inline-block w-fit rounded-full bg-aura-petrol-700/10 px-1.5 py-0.5 text-[0.6rem] font-medium text-aura-petrol-700">
                              {lead.empresa}
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${STATUS_COR[lead.status]}`}>
                            {STATUS_LABEL[lead.status]}
                          </span>
                          {lead.urgencia && (
                            <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${URGENCIA_LABEL[lead.urgencia].cor}`}>
                              {URGENCIA_LABEL[lead.urgencia].texto}
                            </span>
                          )}
                        </div>
                      </div>
                      {lead.resumoIa && (
                        <p className="mt-2 text-xs italic text-aura-graphite-soft">
                          IA: &quot;{lead.resumoIa}&quot;
                        </p>
                      )}
                      {lead.mensagemInicial && (
                        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-aura-bg px-3 py-2 text-xs text-aura-graphite">
                          <MessageSquare size={12} className="mt-0.5 shrink-0" />
                          {lead.mensagemInicial}
                        </p>
                      )}
                      {lead.respostasQualificacao.length > 0 && (
                        <div className="mt-2 rounded-lg border border-aura-petrol-500/20 bg-aura-petrol-700/5 px-3 py-2">
                          <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-aura-petrol-600">
                            Pré-qualificação
                          </p>
                          <ul className="flex flex-col gap-1">
                            {lead.respostasQualificacao.map((qa, i) => (
                              <li key={i} className="text-xs text-aura-graphite">
                                <span className="text-aura-graphite-soft">{qa.pergunta}</span>{" "}
                                <span className="font-medium">{qa.resposta}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {!lead.qualificacaoConcluida && (
                        <p className="mt-2 text-xs text-aura-graphite-soft">
                          Aguardando o cliente terminar de responder as perguntas de qualificação...
                        </p>
                      )}
                      {lead.gestorNotificado && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-aura-danger">
                          <AlertTriangle size={12} />
                          Prazo vencido — seu gestor já foi avisado sobre esse lead
                        </p>
                      )}
                      {diasParado !== undefined && diasParado >= 2 && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-aura-warning">
                          <Clock size={12} />
                          {diasParado} dias sem nenhuma atividade registrada com esse cliente
                        </p>
                      )}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        {restante && (
                          <span className={`flex items-center gap-1 text-xs ${urgente ? "font-medium text-aura-danger" : "text-aura-graphite-soft"}`}>
                            <Clock size={11} />
                            {restante}
                          </span>
                        )}
                        <div className="ml-auto flex gap-2">
                          <button
                            type="button"
                            onClick={() => perder(lead)}
                            className="flex items-center gap-1.5 rounded-full border border-aura-mist px-3 py-1.5 text-xs font-medium text-aura-graphite-soft hover:border-aura-danger/40 hover:text-aura-danger"
                          >
                            <XCircle size={12} />
                            Perdido
                          </button>
                          <button
                            type="button"
                            onClick={() => responder(lead)}
                            className="flex items-center gap-1.5 rounded-full bg-aura-petrol-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-aura-petrol-600"
                          >
                            <CheckCircle2 size={12} />
                            Marcar como respondido
                          </button>
                          <button
                            type="button"
                            onClick={() => excluir(lead)}
                            className="rounded-full border border-aura-danger/40 px-3 py-1.5 text-xs text-aura-danger hover:bg-aura-danger/10"
                            title="Excluir lead"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {perdidos.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-aura-graphite">
                <XCircle size={14} className="text-aura-danger" />
                Perdidos
              </p>
              <div className="flex flex-col gap-2">
                {perdidos.map((lead) => (
                  <div key={lead.id} className="rounded-2xl border border-aura-danger/20 bg-aura-danger/5 p-4">
                    <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-aura-graphite">{lead.nome || "Contato novo"}</p>
                    <button type="button" onClick={() => excluir(lead)} className="text-aura-danger" title="Excluir lead"><Trash2 size={14} /></button>
                    </div>
                    <p className="text-xs text-aura-graphite-soft">{lead.telefone}</p>
                    {lead.motivoPerda && (
                      <p className="mt-1 text-xs text-aura-graphite-soft">Motivo: {lead.motivoPerda}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {respondidos.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-aura-graphite">Já respondidos</p>
              <div className="flex flex-col gap-2">
                {respondidos.slice(0, 10).map((lead) => (
                  <div key={lead.id} className="rounded-2xl border border-aura-mist bg-white p-4 opacity-70">
                    <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-aura-graphite">{lead.nome || "Contato novo"}</p>
                    <button type="button" onClick={() => excluir(lead)} className="text-aura-danger" title="Excluir lead"><Trash2 size={14} /></button>
                    </div>
                    <p className="text-xs text-aura-graphite-soft">{lead.telefone}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
