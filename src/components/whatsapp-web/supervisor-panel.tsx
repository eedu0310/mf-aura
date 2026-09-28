"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ExternalLink,
  History,
  Lightbulb,
  Loader2,
  RefreshCw,
  Target,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { COR_ETAPA, ETAPAS_FUNIL, postJson, type Alerta, type Etapa, type LeadInfo } from "./types";

interface Props {
  chatId: string;
  lead: LeadInfo | null;
  alertas: Alerta[];
  onClose: () => void;
  onChanged: () => void;
}

function Secao({ icone, titulo, children }: { icone: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <section className="bg-[#111b21] px-5 py-4">
      <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-[#00a884]">
        {icone}
        {titulo}
      </h4>
      {children}
    </section>
  );
}

export function SupervisorPanel({ chatId, lead, alertas, onClose, onChanged }: Props) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function acao(nome: string, payload: Record<string, unknown>) {
    setOcupado(nome);
    setErro(null);
    try {
      await postJson({ chat: chatId, ...payload });
      onChanged();
    } catch (e: any) {
      setErro(e?.message ?? "Erro");
    } finally {
      setOcupado(null);
    }
  }

  const etapaAtual = (lead?.etapaPipeline ?? lead?.etapa) as Etapa | null;
  const idxAtual = etapaAtual ? ETAPAS_FUNIL.indexOf(etapaAtual) : -1;
  const ehLead = !!lead && !lead.ignorado && (lead.ehLead || !!lead.oportunidadeId);

  return (
    <aside className="flex h-full w-full flex-col border-l border-[#222d34] bg-[#0b141a] md:w-[360px]">
      <div className="flex h-[59px] items-center gap-4 bg-[#202c33] px-5">
        <button type="button" onClick={onClose} className="text-[#aebac1]" aria-label="Fechar">
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-[#00a884]" />
          <h3 className="text-[16px] text-[#e9edef]">Supervisor AURA</h3>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pb-6">
        {/* Status da análise */}
        <div className="flex items-center justify-between bg-[#111b21] px-5 py-3 text-xs text-[#8696a0]">
          <span className="flex items-center gap-1.5">
            {lead?.analisando ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00a884]" /> Analisando conversa…
              </>
            ) : lead?.ultimaAnaliseEm ? (
              <>Analisado às {new Date(lead.ultimaAnaliseEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>
            ) : (
              "Ainda não analisado"
            )}
          </span>
          <button
            type="button"
            onClick={() => acao("analisar", { action: "analyze" })}
            disabled={!!ocupado || lead?.analisando}
            className="flex items-center gap-1 rounded-full px-2 py-1 font-medium text-[#00a884] hover:bg-[#202c33] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${ocupado === "analisar" ? "animate-spin" : ""}`} /> Analisar agora
          </button>
        </div>

        {lead && !lead.iaDisponivel && (
          <p className="mx-4 rounded-lg bg-[#3d3219] px-3 py-2 text-xs text-[#ffd279]">
            IA desligada: falta uma chave válida da Anthropic no .env.local. Enquanto isso o supervisor usa as regras automáticas (palavras-chave e tempos de resposta).
          </p>
        )}
        {lead?.aviso && <p className="mx-4 rounded-lg bg-[#3d3219] px-3 py-2 text-xs text-[#ffd279]">{lead.aviso}</p>}
        {erro && <p className="mx-4 rounded-lg bg-[#3d1d22] px-3 py-2 text-xs text-[#f15c6d]">{erro}</p>}

        {/* Alertas de atendimento */}
        {(alertas.length > 0 || (lead?.alertasIa.length ?? 0) > 0) && (
          <Secao icone={<AlertTriangle className="h-4 w-4 text-[#f15c6d]" />} titulo="Atenção">
            <ul className="space-y-1.5">
              {alertas.map((a) => (
                <li
                  key={a.tipo + a.desde}
                  className={`rounded-md px-3 py-2 text-sm ${
                    a.nivel === "critico" ? "bg-[#3d1d22] text-[#f15c6d]" : a.nivel === "alto" ? "bg-[#3d2a19] text-[#ffa65c]" : "bg-[#3d3219] text-[#ffd279]"
                  }`}
                >
                  {a.texto}
                </li>
              ))}
              {lead?.alertasIa.map((t, i) => (
                <li key={i} className="rounded-md bg-[#3d1d22] px-3 py-2 text-sm text-[#f15c6d]">
                  {t}
                </li>
              ))}
            </ul>
          </Secao>
        )}

        {!ehLead ? (
          <Secao
            icone={<UserPlus className="h-4 w-4" />}
            titulo={lead?.leadSugerido ? "É um lead?" : "Lead no CRM"}
          >
            {/*
              Antes a AURA criava o lead sozinha sempre que achasse a conversa
              comercial, e o pipeline enchia de papo de amigo e suporte
              técnico. Agora, quando ela não tem certeza, pergunta em vez de
              decidir — quem conhece o contato é o vendedor.
            */}
            <p className="text-sm text-[#8696a0]">
              {lead?.ignorado
                ? "Você marcou esta conversa como não sendo lead. A IA não acompanha ela."
                : lead?.analisando
                ? "Verificando se é uma conversa comercial…"
                : lead?.leadSugerido
                ? (lead.motivoSugestao ??
                  "A AURA achou que isto pode ser um cliente, mas não teve certeza.")
                : "A IA não identificou esta conversa como um lead."}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => acao("lead", { action: "ignore", ignorado: false })}
                disabled={!!ocupado}
                className="inline-flex items-center gap-2 rounded-full bg-[#00a884] px-4 py-2 text-sm font-medium text-[#111b21] hover:bg-[#06cf9c] disabled:opacity-60"
              >
                {ocupado === "lead" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {lead?.leadSugerido ? "Sim, é um lead" : "Tratar como lead"}
              </button>

              {lead?.leadSugerido && (
                <button
                  type="button"
                  onClick={() => acao("ignorar", { action: "ignore", ignorado: true })}
                  disabled={!!ocupado}
                  className="inline-flex items-center gap-2 rounded-full border border-[#2a3942] px-4 py-2 text-sm font-medium text-[#8696a0] hover:bg-[#202c33] disabled:opacity-60"
                >
                  {ocupado === "ignorar" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Não é
                </button>
              )}
            </div>
          </Secao>
        ) : (
          <>
            {/* Funil */}
            <Secao icone={<Target className="h-4 w-4" />} titulo="Etapa no pipeline">
              <ol className="space-y-1">
                {ETAPAS_FUNIL.map((e, i) => {
                  const feito = idxAtual >= 0 && i < idxAtual;
                  const atual = i === idxAtual;
                  return (
                    <li key={e}>
                      <button
                        type="button"
                        disabled={!!ocupado || atual}
                        onClick={() => acao(`etapa-${e}`, { action: "stage", etapa: e })}
                        title={atual ? "Etapa atual" : `Mover para ${e}`}
                        className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition ${
                          atual ? "bg-[#0a332c] font-medium text-[#e9edef]" : "text-[#aebac1] hover:bg-[#202c33]"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                            atual ? "border-[#00a884] bg-[#00a884] text-[#111b21]" : feito ? "border-[#00a884] text-[#00a884]" : "border-[#3b4a54]"
                          }`}
                        >
                          {feito ? <CheckCircle2 className="h-4 w-4" /> : ocupado === `etapa-${e}` ? <Loader2 className="h-3 w-3 animate-spin" /> : i + 1}
                        </span>
                        {e}
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-3 flex items-center justify-between text-xs">
                <button
                  type="button"
                  disabled={!!ocupado}
                  onClick={() => acao("etapa-Perdidos", { action: "stage", etapa: "Perdidos" })}
                  className={`rounded-full px-2 py-1 ${etapaAtual === "Perdidos" ? COR_ETAPA.Perdidos : "text-[#f15c6d] hover:bg-[#3d1d22]"}`}
                >
                  {etapaAtual === "Perdidos" ? "Marcado como perdido" : "Marcar como perdido"}
                </button>
                <Link href="/pipeline" className="flex items-center gap-1 text-[#00a884] hover:underline">
                  Abrir pipeline <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <p className="mt-2 text-xs text-[#8696a0]">
                A IA avança o card sozinha conforme a conversa (apresentação, orçamento, negociação, fechamento). Clique numa etapa para corrigir.
              </p>
            </Secao>

            {lead?.proximaAcao && (
              <Secao icone={<Target className="h-4 w-4" />} titulo="Próxima ação">
                <p className="text-sm text-[#e9edef]">{lead.proximaAcao}</p>
              </Secao>
            )}

            {lead?.resumo && (
              <Secao icone={<Bot className="h-4 w-4" />} titulo="Resumo do lead">
                <p className="text-sm text-[#e9edef]">{lead.resumo}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {lead.interesse && <span className="rounded-full bg-[#202c33] px-2 py-1 text-[#aebac1]">Interesse: {lead.interesse}</span>}
                  {lead.valorEstimado ? (
                    <span className="rounded-full bg-[#202c33] px-2 py-1 text-[#aebac1]">
                      ~ {lead.valorEstimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
                    </span>
                  ) : null}
                </div>
              </Secao>
            )}

            {lead && lead.dicas.length > 0 && (
              <Secao icone={<Lightbulb className="h-4 w-4 text-[#ffd279]" />} titulo="Dicas do manual">
                <ul className="list-disc space-y-1.5 pl-4 text-sm text-[#e9edef]">
                  {lead.dicas.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </Secao>
            )}

            {lead && lead.historico.length > 0 && (
              <Secao icone={<History className="h-4 w-4" />} titulo="Movimentações">
                <ul className="space-y-2">
                  {[...lead.historico].reverse().map((h, i) => (
                    <li key={i} className="text-xs text-[#aebac1]">
                      <span className="font-medium text-[#e9edef]">
                        {h.de ? `${h.de} → ${h.para}` : h.para}
                      </span>{" "}
                      · {new Date(h.em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      {h.fonte === "ia" ? " · IA" : h.fonte === "regras" ? " · automático" : " · manual"}
                      {h.evidencia && <p className="mt-0.5 italic text-[#8696a0]">“{h.evidencia}”</p>}
                    </li>
                  ))}
                </ul>
              </Secao>
            )}

            <div className="px-5 pt-2">
              <button
                type="button"
                onClick={() => acao("ignorar", { action: "ignore", ignorado: true })}
                disabled={!!ocupado}
                className="flex items-center gap-2 text-sm text-[#f15c6d] hover:underline disabled:opacity-60"
              >
                <UserMinus className="h-4 w-4" /> Não é lead (parar de acompanhar)
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
