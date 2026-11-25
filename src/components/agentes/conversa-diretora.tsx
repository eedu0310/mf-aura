"use client";

/**
 * "Conversar com a Diretora": painel lateral de chat entre o gestor e a AURA
 * Diretora (GET/POST /api/gestor/agentes/diretora).
 *
 * O gestor manda uma ideia de melhoria; ela responde na hora dizendo o que
 * vai fazer: para quem passou (os agentes aparecem como etiquetas embaixo da
 * resposta — clicar abre a ficha do agente) e, quando ninguém da equipe
 * cobre a ideia, o agente novo que ela propôs (espera o gestor mestre na aba
 * Propostas). Tudo também aparece no mural da equipe.
 *
 * O painel só existe enquanto está aberto (quem abre monta e desmonta): cada
 * vez que abre, lê a conversa de novo.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Crown, DatabaseZap, Lightbulb, Loader2, Send, X } from "lucide-react";
import type { ConversaDiretora as Conversa, MensagemConversaDiretora, MesaAgente } from "@/lib/agentes/tipos";
import { hrefDaAbaGestor } from "@/components/gestor/areas";
import { Alerta } from "@/components/ui";
import { chamarApi, cx, haQuanto, rotuloSetor } from "./comum";
import { RetratoPixel, aparenciaDoAgente } from "./escritorio-pixel";

const LIMITE = 2000;

const EXEMPLOS = [
  "Quero que os vendedores sejam lembrados dos orçamentos parados há mais de uma semana.",
  "Dá para avisar o pós-venda quando um cliente reclamar no WhatsApp?",
  "Gostaria de um resumo semanal das campanhas que trouxeram mais leads.",
];

export function ConversaDiretora({
  diretora,
  equipeAtiva,
  aoFechar,
  aoAbrirAgente,
  aoMudar,
}: {
  diretora: MesaAgente | null;
  equipeAtiva: boolean;
  aoFechar: () => void;
  aoAbrirAgente: (id: string) => void;
  /** Relê o escritório (o mural mostra a conversa e os pedidos novos). */
  aoMudar: () => void | Promise<void>;
}) {
  const [mensagens, setMensagens] = useState<MensagemConversaDiretora[]>([]);
  const [carregando, setCarregando] = useState(equipeAtiva);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [pendente, setPendente] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);
  const ap = useMemo(() => aparenciaDoAgente(diretora?.id ?? "diretora", { chefe: true }), [diretora?.id]);
  const nome = diretora?.nome ?? "AURA Diretora";

  // Lê a conversa ao abrir.
  useEffect(() => {
    if (!equipeAtiva) return;
    let vivo = true;
    chamarApi<Conversa>("/api/gestor/agentes/diretora")
      .then((c) => {
        if (vivo) setMensagens(Array.isArray(c?.mensagens) ? c.mensagens : []);
      })
      .catch((e: unknown) => {
        if (vivo) setErro(e instanceof Error ? e.message : "Não consegui abrir a conversa.");
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [equipeAtiva]);

  // Fecha no Esc.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aoFechar]);

  // Sempre mostra a mensagem mais nova.
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length, pendente, carregando]);

  const enviar = async (e?: FormEvent) => {
    e?.preventDefault();
    const t = texto.trim();
    if (!t || pendente || !equipeAtiva) return;
    if (t.length > LIMITE) {
      setErro(`A mensagem passou de ${LIMITE} caracteres. Pode resumir um pouco?`);
      return;
    }
    setErro(null);
    setPendente(t);
    setTexto("");
    try {
      const troca = await chamarApi<{ pergunta: MensagemConversaDiretora; resposta: MensagemConversaDiretora }>(
        "/api/gestor/agentes/diretora",
        { method: "POST", body: JSON.stringify({ texto: t }) },
      );
      setMensagens((atual) => [...atual, troca.pergunta, troca.resposta]);
      void aoMudar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "A Diretora não conseguiu responder agora.");
      setTexto(t);
    } finally {
      setPendente(null);
    }
  };

  const abrirAgente = (id: string) => {
    aoFechar();
    aoAbrirAgente(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Conversa com ${nome}`}>
      <button type="button" aria-label="Fechar" onClick={aoFechar} className="absolute inset-0 bg-aura-navy-950/40 backdrop-blur-[1px]" />
      <aside className="relative flex h-full w-full max-w-md flex-col border-l border-aura-mist bg-aura-surface shadow-xl">
        <header className="flex items-center gap-3 border-b border-aura-mist px-5 py-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-aura-gold/30 bg-aura-gold/12">
            <RetratoPixel ap={ap} tamanho={34} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-1.5 truncate text-sm font-semibold text-aura-graphite">
              {nome}
              <Crown size={12} className="shrink-0 text-aura-gold-700" aria-hidden />
            </h2>
            <p className="text-xs text-aura-graphite-soft">Mande sua ideia de melhoria direto para ela</p>
          </div>
          <button type="button" onClick={aoFechar} className="aura-btn aura-btn-fantasma aura-btn-sm" aria-label="Fechar">
            <X size={15} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
          {!equipeAtiva ? (
            <Alerta
              tom="atencao"
              icone={DatabaseZap}
              titulo="A equipe ainda não foi ativada"
              descricao="A Diretora começa a conversar assim que a migração 110 estiver no banco. Até lá nada é gravado e nenhum custo de IA acontece."
            />
          ) : (
            <ol className="space-y-4">
              <BalaoDiretora ap={ap} nome={nome}>
                <p>
                  Oi! Sou a {nome}. Me conte sua ideia de melhoria: eu digo quem da equipe vai cuidar dela e, se ninguém
                  cobre, proponho um agente novo para o gestor mestre aprovar.
                </p>
                {!carregando && mensagens.length === 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    {EXEMPLOS.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setTexto(ex)}
                        className="flex w-full items-start gap-1.5 rounded-md border border-aura-mist bg-aura-surface px-2 py-1.5 text-left text-xs text-aura-graphite-soft transition hover:border-aura-petrol-500/40 hover:text-aura-graphite"
                      >
                        <Lightbulb size={12} className="mt-0.5 shrink-0 text-aura-gold-700" aria-hidden />
                        {ex}
                      </button>
                    ))}
                  </div>
                )}
              </BalaoDiretora>

              {carregando && (
                <li className="flex items-center gap-2 px-1 text-xs text-aura-graphite-soft">
                  <Loader2 size={13} className="motion-safe:animate-spin" aria-hidden />
                  Abrindo a conversa…
                </li>
              )}

              {mensagens.map((m) =>
                m.autor === "gestor" ? (
                  <BalaoGestor key={m.id} texto={m.texto} quando={m.criadoEm} />
                ) : (
                  <BalaoDiretora key={m.id} ap={ap} nome={nome} quando={m.criadoEm}>
                    <p className="whitespace-pre-line">{m.texto}</p>
                    {m.encaminhados && m.encaminhados.length > 0 && (
                      <div className="mt-2.5">
                        <p className="mb-1 text-[0.6875rem] text-aura-graphite-soft">Passei para:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {m.encaminhados.map((e) => (
                            <button
                              key={e.agenteId}
                              type="button"
                              onClick={() => abrirAgente(e.agenteId)}
                              title={e.pedido}
                              className="inline-flex items-center gap-1 rounded-md border border-aura-petrol-500/25 bg-aura-petrol-500/8 px-2 py-0.5 text-xs text-aura-petrol-600 transition hover:border-aura-petrol-500/50"
                            >
                              {e.agenteNome}
                              <ArrowRight size={11} aria-hidden />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {m.proposta && (
                      <div className="mt-2.5 rounded-md border border-aura-gold/30 bg-aura-gold/8 px-2.5 py-2 text-xs">
                        <p className="font-medium text-aura-graphite">
                          Agente novo proposto: {m.proposta.nome}
                          {m.proposta.setor && <span className="text-aura-graphite-soft"> · {rotuloSetor(m.proposta.setor)}</span>}
                        </p>
                        <p className="mt-0.5 text-aura-graphite-soft">
                          {m.proposta.gravada
                            ? "Espera a aprovação do gestor mestre."
                            : "Já existe uma proposta parecida em aberto."}{" "}
                          <Link href={hrefDaAbaGestor("propostas")} className="font-medium text-aura-petrol-600 underline-offset-2 hover:underline">
                            Ver na aba Propostas
                          </Link>
                        </p>
                      </div>
                    )}
                    {m.semIA && (
                      <p className="mt-2 text-[0.6875rem] text-aura-graphite-soft">
                        Resposta automática: a IA da Diretora não estava disponível agora. Sua ideia foi para o mural.
                      </p>
                    )}
                  </BalaoDiretora>
                ),
              )}

              {pendente && (
                <>
                  <BalaoGestor texto={pendente} />
                  <BalaoDiretora ap={ap} nome={nome}>
                    <span className="inline-flex items-center gap-2 text-aura-graphite-soft">
                      <span className="inline-flex gap-0.5" aria-hidden>
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-aura-gold-700/70 motion-safe:animate-pulse"
                            style={{ animationDelay: `${i * 200}ms` }}
                          />
                        ))}
                      </span>
                      A Diretora está pensando…
                    </span>
                  </BalaoDiretora>
                </>
              )}
            </ol>
          )}
          <div ref={fim} />
        </div>

        <form onSubmit={enviar} className="border-t border-aura-mist px-4 py-3">
          {erro && <p className="mb-2 text-xs text-aura-danger">{erro}</p>}
          <div className="flex items-end gap-2">
            <label className="sr-only" htmlFor="ideia-para-diretora">
              Sua ideia para a Diretora
            </label>
            <textarea
              id="ideia-para-diretora"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void enviar();
                }
              }}
              rows={2}
              maxLength={LIMITE}
              disabled={!equipeAtiva || Boolean(pendente)}
              placeholder={equipeAtiva ? "Escreva sua ideia… (Enter envia, Shift+Enter quebra a linha)" : "Disponível quando a equipe for ativada"}
              className="aura-input min-h-[2.75rem] flex-1 resize-none py-2 text-sm"
              autoFocus
            />
            <button
              type="submit"
              disabled={!equipeAtiva || !texto.trim() || Boolean(pendente)}
              className="aura-btn aura-btn-primario h-[2.75rem] shrink-0"
              aria-label="Enviar para a Diretora"
            >
              {pendente ? <Loader2 size={15} className="motion-safe:animate-spin" aria-hidden /> : <Send size={15} aria-hidden />}
            </button>
          </div>
          <p className={cx("mt-1 text-right text-[0.6875rem]", texto.length > LIMITE * 0.9 ? "text-aura-warning" : "text-aura-graphite-soft")}>
            {texto.length}/{LIMITE}
          </p>
        </form>
      </aside>
    </div>
  );
}

function BalaoGestor({ texto, quando }: { texto: string; quando?: string }) {
  return (
    <li className="flex justify-end">
      <div className="max-w-[85%]">
        <div className="rounded-xl rounded-br-sm border border-aura-petrol-500/20 bg-aura-petrol-500/10 px-3 py-2 text-sm leading-relaxed text-aura-graphite">
          <p className="whitespace-pre-line break-words">{texto}</p>
        </div>
        {quando && (
          <time dateTime={quando} className="mt-0.5 block text-right text-[0.6875rem] text-aura-graphite-soft">
            Você · {haQuanto(quando)}
          </time>
        )}
      </div>
    </li>
  );
}

function BalaoDiretora({
  ap,
  nome,
  quando,
  children,
}: {
  ap: ReturnType<typeof aparenciaDoAgente>;
  nome: string;
  quando?: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-end gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-aura-gold/30 bg-aura-gold/12">
        <RetratoPixel ap={ap} tamanho={26} />
      </span>
      <div className="min-w-0 max-w-[85%]">
        <div className="rounded-xl rounded-bl-sm border border-aura-mist bg-aura-sunken px-3 py-2 text-sm leading-relaxed text-aura-graphite">
          {children}
        </div>
        {quando && (
          <time dateTime={quando} className="mt-0.5 block text-[0.6875rem] text-aura-graphite-soft">
            {nome} · {haQuanto(quando)}
          </time>
        )}
      </div>
    </li>
  );
}
