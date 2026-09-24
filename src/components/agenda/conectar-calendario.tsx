"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, Copy, Loader2, RefreshCw, Smartphone } from "lucide-react";

/**
 * Liga a agenda do CRM ao calendário do celular.
 *
 * Em vez de pedir login do Google, o CRM publica um endereço secreto no
 * formato que todos os calendários entendem (.ics). O Google Agenda e o
 * calendário do iPhone buscam esse endereço sozinhos, de tempos em tempos:
 * o compromisso marcado aqui aparece no celular e lembra na hora.
 */
export function ConectarCalendario() {
  const [caminho, setCaminho] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/minha-agenda", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro ?? "Não consegui buscar seu endereço.");
      setCaminho(json.caminho);
      setErro(null);
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui buscar seu endereço.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const enderecoHttps = caminho && typeof window !== "undefined" ? `${window.location.origin}${caminho}` : "";
  const enderecoWebcal = enderecoHttps.replace(/^https?:/, "webcal:");

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enderecoHttps);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro("Não consegui copiar. Selecione o endereço e copie manualmente.");
    }
  }

  async function gerarNovo() {
    if (!window.confirm("Gerar um endereço novo? O calendário que você já conectou no celular vai parar de atualizar e precisará ser conectado de novo.")) {
      return;
    }
    setTrocando(true);
    try {
      const res = await fetch("/api/minha-agenda", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro ?? "Não consegui gerar.");
      setCaminho(json.caminho);
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui gerar.");
    } finally {
      setTrocando(false);
    }
  }

  return (
    <section className="rounded-2xl border border-aura-mist bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-aura-navy-950">
          <CalendarClock className="h-5 w-5 text-aura-gold" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-aura-graphite">
            Ver esta agenda no meu celular
          </span>
          <span className="block text-xs text-aura-graphite-soft">
            Conecte uma vez e todo compromisso marcado aqui aparece no seu calendário, com lembrete.
          </span>
        </span>
        <span className="shrink-0 text-xs font-medium text-aura-petrol-700">
          {aberto ? "Fechar" : "Conectar"}
        </span>
      </button>

      {aberto && (
        <div className="space-y-4 border-t border-aura-mist px-5 py-4">
          {carregando ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-aura-petrol-500" />
            </div>
          ) : (
            <>
              <div>
                <p className="mb-1.5 text-xs font-medium text-aura-graphite">
                  Seu endereço de calendário (é pessoal — não compartilhe)
                </p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={enderecoHttps}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-lg border border-aura-mist bg-aura-bg px-3 py-2 font-mono text-xs text-aura-graphite"
                  />
                  <button
                    type="button"
                    onClick={() => void copiar()}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-aura-navy-950 px-3 py-2 text-xs font-medium text-aura-gold"
                  >
                    {copiado ? <Check size={14} /> : <Copy size={14} />}
                    {copiado ? "Copiado" : "Copiar"}
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-aura-mist bg-aura-bg/50 p-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-aura-graphite">
                    <Smartphone size={13} /> iPhone e iPad
                  </p>
                  <p className="text-xs leading-relaxed text-aura-graphite-soft">
                    Abra este link no Safari do celular e confirme em <strong>Assinar</strong>:
                  </p>
                  <a
                    href={enderecoWebcal}
                    className="mt-2 inline-block break-all text-xs font-medium text-aura-petrol-700 underline"
                  >
                    Assinar no calendário do iPhone
                  </a>
                </div>

                <div className="rounded-xl border border-aura-mist bg-aura-bg/50 p-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-aura-graphite">
                    <CalendarClock size={13} /> Google Agenda
                  </p>
                  <p className="text-xs leading-relaxed text-aura-graphite-soft">
                    No computador, abra o Google Agenda, clique no <strong>+</strong> ao lado de
                    &quot;Outras agendas&quot;, escolha <strong>De URL</strong> e cole o endereço acima.
                    Depois ele aparece também no app do celular.
                  </p>
                  <a
                    href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl"
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-medium text-aura-petrol-700 underline"
                  >
                    Abrir a tela do Google Agenda
                  </a>
                </div>
              </div>

              <p className="text-xs text-aura-graphite-soft">
                O calendário atualiza sozinho (o Google costuma levar algumas horas; o iPhone pode ser
                ajustado para 15 minutos nos ajustes da assinatura). Entram os compromissos da agenda e
                os próximos contatos marcados nas atividades.
              </p>

              {erro && <p className="text-xs text-aura-danger">{erro}</p>}

              <button
                type="button"
                onClick={() => void gerarNovo()}
                disabled={trocando}
                className="flex items-center gap-1.5 text-xs font-medium text-aura-graphite-soft hover:text-aura-graphite disabled:opacity-60"
              >
                {trocando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Gerar um endereço novo
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
