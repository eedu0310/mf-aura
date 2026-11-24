"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Phone, MessageSquare, CheckCircle2, Clock, XCircle, Users, AlertTriangle, Trash2, ListChecks, FileBarChart, Snowflake } from "lucide-react";
import Link from "next/link";
import {
  listarLeads,
  marcarLeadRespondido,
  marcarLeadPerdido,
  marcarLeadFrio,
  excluirLead,
  buscarDiasSemAtividade,
  buscarNomesDosVendedores,
  type Lead,
  type StatusLead,
} from "@/lib/supabase/leads";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { donoDoLead, SEM_VENDEDOR } from "@/lib/leads/atendimento";
import { RelatorioAtendimento } from "@/components/leads/relatorio-atendimento";
import { EstadoVazio, PageContainer, PageHeader, Segmentado, classeBotao } from "@/components/ui";

const STATUS_LABEL: Record<StatusLead, string> = {
  aguardando_sdr: "Aguardando distribuição",
  atribuido_sdr: "Com o SDR",
  respondido: "Respondido",
  repassado_vendedor: "Com o vendedor",
  perdido: "Perdido",
  lead_frio: "Lead frio",
};

const STATUS_COR: Record<StatusLead, string> = {
  aguardando_sdr: "aura-selo-neutro",
  atribuido_sdr: "aura-selo-marca",
  respondido: "aura-selo-sucesso",
  repassado_vendedor: "aura-selo-marca",
  perdido: "aura-selo-perigo",
  lead_frio: "aura-selo-neutro",
};

const URGENCIA_LABEL: Record<string, { texto: string; cor: string }> = {
  alta: { texto: "Urgente", cor: "aura-selo-perigo" },
  media: { texto: "Moderada", cor: "aura-selo-atencao" },
  baixa: { texto: "Baixa urgência", cor: "aura-selo-neutro" },
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
  const [vendedorFiltro, setVendedorFiltro] = useState<string>("todos");
  const [aba, setAba] = useState<"fila" | "relatorio">("fila");
  const [nomes, setNomes] = useState<Map<string, string>>(new Map());

  async function carregar() {
    const lista = await listarLeads();
    if (lista) {
      setLeads(lista);
      const ids = lista.map((l) => l.relacionamentoId).filter((id): id is string => Boolean(id));
      buscarDiasSemAtividade(ids).then(setDiasSemAtividade);
      buscarNomesDosVendedores(
        lista.map(donoDoLead).filter((id) => id !== SEM_VENDEDOR),
      ).then(setNomes);
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

  async function esfriar(lead: Lead) {
    const anterior = lead.status;
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: "lead_frio" } : l)));
    const ok = await marcarLeadFrio(lead.id, lead.respondidoEm);
    if (!ok) {
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: anterior } : l)));
      window.alert("Não consegui marcar como lead frio. Tente de novo.");
    }
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
  const leadsDaLojaToda = useMemo(
    () => (empresaFiltro === "todas" ? leads : leads.filter((l) => l.empresa === empresaFiltro)),
    [leads, empresaFiltro]
  );

  // Vendedores que têm lead na loja escolhida, para o filtro por vendedor.
  const nomeDoVendedor = (id: string) =>
    id === SEM_VENDEDOR ? "Sem vendedor" : nomes.get(id) ?? "Carregando...";
  const vendedores = useMemo(() => {
    const ids = [...new Set(leadsDaLojaToda.map(donoDoLead))];
    return ids
      .map((id) => ({ id, nome: id === SEM_VENDEDOR ? "Sem vendedor" : nomes.get(id) ?? "Vendedor" }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [leadsDaLojaToda, nomes]);
  const multiVendedor = vendedores.length > 1;
  const vendedorValido = vendedorFiltro === "todos" || vendedores.some((v) => v.id === vendedorFiltro);
  const vendedorAtivo = vendedorValido ? vendedorFiltro : "todos";

  const leadsDaLoja = useMemo(
    () => (vendedorAtivo === "todos" ? leadsDaLojaToda : leadsDaLojaToda.filter((l) => donoDoLead(l) === vendedorAtivo)),
    [leadsDaLojaToda, vendedorAtivo]
  );

  const ordemUrgencia: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
  const pendentes = leadsDaLoja
    .filter((l) => ["aguardando_sdr", "atribuido_sdr", "repassado_vendedor"].includes(l.status))
    .sort((a, b) => (ordemUrgencia[a.urgencia ?? "media"] ?? 1) - (ordemUrgencia[b.urgencia ?? "media"] ?? 1));
  const perdidos = leadsDaLoja.filter((l) => l.status === "perdido");
  const frios = leadsDaLoja.filter((l) => l.status === "lead_frio");
  const respondidos = leadsDaLoja.filter((l) => l.status === "respondido");

  return (
    <PageContainer largura={aba === "relatorio" ? "normal" : "estreita"}>
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0! print:hidden"
        titulo="Leads Recebidos"
        icone={Users}
        descricao={
          aba === "fila"
            ? "Novos contatos chegando automaticamente — responda antes do prazo esgotar."
            : "Quantos leads chegaram, quem atendeu, em quanto tempo e quem ficou sem resposta."
        }
        acoes={
        <div className="aura-segmentado" role="tablist" aria-label="Fila ou relatório">
          <button
            type="button"
            role="tab"
            aria-selected={aba === "fila"}
            onClick={() => setAba("fila")}
            className="aura-segmento flex items-center gap-1.5"
          >
            <ListChecks size={13} />
            Fila de leads
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === "relatorio"}
            onClick={() => setAba("relatorio")}
            className="aura-segmento flex items-center gap-1.5"
          >
            <FileBarChart size={13} />
            Relatório de atendimento
          </button>
        </div>
        }
      />

      {multiLoja && (
        <Segmentado
          className="print:hidden"
          rotulo="Loja"
          valor={empresaFiltro}
          aoMudar={setEmpresaFiltro}
          opcoes={[
            { valor: "todas", rotulo: "Todas as lojas" },
            ...lojas.map((loja) => ({ valor: loja, rotulo: loja })),
          ]}
        />
      )}

      {multiVendedor && (
        <label className="flex w-fit items-center gap-2 text-xs text-aura-graphite-soft print:hidden">
          Vendedor
          <select
            value={vendedorAtivo}
            onChange={(e) => setVendedorFiltro(e.target.value)}
            className="aura-input w-auto"
          >
            <option value="todos">Todos os vendedores</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      {aba === "relatorio" ? (
        carregando ? (
          <div className="flex justify-center py-16 text-aura-graphite-soft">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <RelatorioAtendimento
            leads={leadsDaLoja}
            nomes={nomes}
            lojaTexto={empresaFiltro === "todas" ? (multiLoja ? "Todas as lojas" : lojas[0] ?? "—") : empresaFiltro}
            vendedorTexto={vendedorAtivo === "todos" ? "Todos os vendedores" : nomeDoVendedor(vendedorAtivo)}
          />
        )
      ) : carregando ? (
        <div className="flex justify-center py-16 text-aura-graphite-soft">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : leadsDaLoja.length === 0 ? (
        <EstadoVazio
          icone={Users}
          className="py-16"
          titulo="Nenhum lead recebido ainda. Assim que a integração com o WhatsApp estiver ativa, eles aparecem aqui automaticamente."
        />
      ) : (
        <>
          {pendentes.length > 0 && (
            <div>
              <p className="aura-rotulo mb-2">Pendentes de resposta</p>
              <div className="flex flex-col gap-2">
                {pendentes.map((lead) => {
                  const restante = tempoRestante(lead.prazoResposta);
                  const urgente = restante === "Prazo esgotado";
                  const diasParado = lead.relacionamentoId ? diasSemAtividade.get(lead.relacionamentoId) : undefined;
                  return (
                    <div
                      key={lead.id}
                      className={`aura-card p-4 ${urgente ? "border-aura-danger/40" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-aura-graphite">
                            {lead.nome || "Contato novo"}
                          </p>
                          <p className="flex items-center gap-1 text-xs text-aura-graphite-soft">
                            <Phone size={11} />
                            {lead.telefone}
                            {!lead.origem?.startsWith("Site MF") && ` · ${lead.origem}`}
                          </p>
                          {/* Veio do site da MF: de qual formulário ou do chat. */}
                          {lead.origem?.startsWith("Site MF") && (
                            <span className="aura-selo aura-selo-perigo mt-1 w-fit">
                              {lead.origem.replace(/^Site MF · /, "Site MF: ")}
                            </span>
                          )}
                          {multiVendedor && vendedorAtivo === "todos" && (
                            <span className="aura-selo aura-selo-neutro mt-1 mr-1 w-fit">
                              {nomeDoVendedor(donoDoLead(lead))}
                            </span>
                          )}
                          {multiLoja && empresaFiltro === "todas" && (
                            <span className="aura-selo aura-selo-marca mt-1 w-fit">
                              {lead.empresa}
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className={`aura-selo ${STATUS_COR[lead.status]}`}>
                            {STATUS_LABEL[lead.status]}
                          </span>
                          {lead.urgencia && (
                            <span className={`aura-selo ${URGENCIA_LABEL[lead.urgencia].cor}`}>
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
                        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-aura-sunken px-3 py-2 text-xs text-aura-graphite">
                          <MessageSquare size={12} className="mt-0.5 shrink-0" />
                          {lead.mensagemInicial}
                        </p>
                      )}
                      {lead.respostasQualificacao.length > 0 && (
                        <div className="mt-2 rounded-lg border border-aura-mist bg-aura-sunken/50 px-3 py-2">
                          <p className="aura-rotulo mb-1 text-aura-petrol-600">
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
                        <div className="ml-auto flex flex-wrap justify-end gap-2">
                          {/* O primeiro passo com o lead é chamar no WhatsApp,
                              pela AURA, para a conversa ficar registrada. */}
                          {lead.telefone && (
                            <a
                              href={`/whatsapp?numero=${lead.telefone.replace(/\D/g, "")}`}
                              className={classeBotao("secundario", "sm")}
                            >
                              <MessageSquare size={13} className="text-aura-success" />
                              Chamar no WhatsApp
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => esfriar(lead)}
                            title="Curioso ou ainda sem interesse de compra: vai para a coluna Leads frios do Pipeline"
                            className={classeBotao("fantasma", "sm")}
                          >
                            <Snowflake size={12} />
                            Lead frio / curioso
                          </button>
                          <button
                            type="button"
                            onClick={() => perder(lead)}
                            className={classeBotao("fantasma", "sm", "hover:text-aura-danger")}
                          >
                            <XCircle size={12} />
                            Perdido
                          </button>
                          <button
                            type="button"
                            onClick={() => responder(lead)}
                            className={classeBotao("primario", "sm")}
                          >
                            <CheckCircle2 size={12} />
                            Marcar como respondido
                          </button>
                          <button
                            type="button"
                            onClick={() => excluir(lead)}
                            className={classeBotao("perigo-suave", "sm")}
                            title="Excluir lead"
                            aria-label="Excluir lead"
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

          {frios.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-aura-graphite">
                <Snowflake size={14} className="text-aura-graphite-soft" />
                Leads frios / curiosos
                <Link href="/pipeline" className="ml-auto text-xs font-medium text-aura-petrol-600 hover:underline">
                  Ver no Pipeline
                </Link>
              </p>
              <div className="flex flex-col gap-2">
                {frios.slice(0, 20).map((lead) => (
                  <div key={lead.id} className="aura-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-aura-graphite">{lead.nome || "Contato novo"}</p>
                      <div className="flex items-center gap-3">
                        {lead.telefone && (
                          <a
                            href={`/whatsapp?numero=${lead.telefone.replace(/\D/g, "")}`}
                            className="text-xs font-medium text-aura-success hover:underline"
                          >
                            Chamar de novo
                          </a>
                        )}
                        <button type="button" onClick={() => excluir(lead)} className={classeBotao("fantasma", "sm", "h-7 w-7 px-0 text-aura-danger")} title="Excluir lead" aria-label="Excluir lead"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <p className="text-xs text-aura-graphite-soft">{lead.telefone}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {perdidos.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-aura-graphite">
                <XCircle size={14} className="text-aura-danger" />
                Perdidos
              </p>
              <div className="flex flex-col gap-2">
                {perdidos.map((lead) => (
                  <div key={lead.id} className="aura-card p-4">
                    <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-aura-graphite">{lead.nome || "Contato novo"}</p>
                    <button type="button" onClick={() => excluir(lead)} className={classeBotao("fantasma", "sm", "h-7 w-7 px-0 text-aura-danger")} title="Excluir lead" aria-label="Excluir lead"><Trash2 size={14} /></button>
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
              <p className="aura-rotulo mb-2">Já respondidos</p>
              <div className="flex flex-col gap-2">
                {respondidos.slice(0, 10).map((lead) => (
                  <div key={lead.id} className="aura-card p-4 opacity-70">
                    <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-aura-graphite">{lead.nome || "Contato novo"}</p>
                    <button type="button" onClick={() => excluir(lead)} className={classeBotao("fantasma", "sm", "h-7 w-7 px-0 text-aura-danger")} title="Excluir lead" aria-label="Excluir lead"><Trash2 size={14} /></button>
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
    </PageContainer>
  );
}
