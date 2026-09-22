"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ExternalLink,
  GraduationCap,
  HelpCircle,
  Loader2,
} from "lucide-react";
import {
  listarTreinamentos,
  alternarConclusao,
  type Treinamento,
} from "@/lib/supabase/academy";
import { listarFaq, type Faq } from "@/lib/supabase/faq";
import { extrairYoutubeId } from "@/lib/youtube";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ModoAcademia } from "@/components/academy/modo-academia";

const SEM_CATEGORIA = "Outros materiais";

export default function AcademyPage() {
  const [aba, setAba] = useState<"treinamentos" | "faq">("treinamentos");
  const [treinamentos, setTreinamentos] = useState<Treinamento[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [usandoSupabase, setUsandoSupabase] = useState(true);
  const [moduloAberto, setModuloAberto] = useState<string | null>(null);
  const [videoAtivoPorModulo, setVideoAtivoPorModulo] = useState<Record<string, string>>({});
  const [faqAberta, setFaqAberta] = useState<string | null>(null);

  async function carregar() {
    const [tLista, fLista] = await Promise.all([listarTreinamentos(), listarFaq()]);
    if (tLista === null) {
      setUsandoSupabase(false);
    } else {
      setTreinamentos(tLista);
    }
    if (fLista) setFaqs(fLista);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
     
  }, []);

  // Sincronização ao vivo: se o gestor adicionar/editar um treinamento ou
  // uma pergunta do FAQ (ou você marcar uma aula como concluída em outra
  // aba), a tela atualiza sozinha.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const canal = supabase
      .channel("aura-academy-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "treinamentos" }, () => carregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "treinamento_progresso" }, () => carregar())
      .on("postgres_changes", { event: "*", schema: "public", table: "perguntas_frequentes" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
     
  }, []);

  async function alternar(t: Treinamento) {
    const novoStatus = !t.concluido;
    setTreinamentos((prev) =>
      prev.map((item) => (item.id === t.id ? { ...item, concluido: novoStatus } : item))
    );
    await alternarConclusao(t.id, novoStatus);
  }

  const modulos = useMemo(() => {
    const mapa = new Map<string, Treinamento[]>();
    for (const t of treinamentos) {
      const chave = t.categoria?.trim() || SEM_CATEGORIA;
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(t);
    }
    return Array.from(mapa.entries());
  }, [treinamentos]);

  const concluidos = treinamentos.filter((t) => t.concluido).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-24">
      <div>
        <p className="font-display text-xl font-semibold text-aura-graphite">Academy</p>
        <p className="text-sm text-aura-graphite-soft">
          {treinamentos.length === 0
            ? "Materiais de treinamento da sua loja"
            : `${concluidos} de ${treinamentos.length} aulas concluídas`}
        </p>
      </div>

      {!usandoSupabase && (
        <p className="rounded-xl bg-aura-warning/10 px-4 py-2.5 text-xs text-aura-warning">
          Supabase não configurado — a Academy precisa dele para funcionar.
        </p>
      )}

      <ModoAcademia />

      <div className="flex gap-2 border-b border-aura-mist">
        <button
          type="button"
          onClick={() => setAba("treinamentos")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
            aba === "treinamentos"
              ? "border-aura-petrol-700 text-aura-petrol-700"
              : "border-transparent text-aura-graphite-soft hover:text-aura-graphite"
          }`}
        >
          <GraduationCap size={15} />
          Treinamentos
        </button>
        <button
          type="button"
          onClick={() => setAba("faq")}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition ${
            aba === "faq"
              ? "border-aura-petrol-700 text-aura-petrol-700"
              : "border-transparent text-aura-graphite-soft hover:text-aura-graphite"
          }`}
        >
          <HelpCircle size={15} />
          Perguntas Frequentes
        </button>
      </div>

      {carregando ? (
        <div className="flex justify-center py-16 text-aura-graphite-soft">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : aba === "treinamentos" ? (
        modulos.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-aura-mist bg-white/60 px-6 py-16 text-center">
            <GraduationCap size={24} className="text-aura-graphite-soft" />
            <p className="text-sm text-aura-graphite-soft">
              Seu gestor ainda não cadastrou nenhum treinamento nesta loja.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {modulos.map(([modulo, aulas]) => {
              const aberto = moduloAberto === modulo;
              const concluidasNoModulo = aulas.filter((a) => a.concluido).length;
              const videoAtivoId = videoAtivoPorModulo[modulo] ?? aulas[0]?.id;
              const aulaAtiva = aulas.find((a) => a.id === videoAtivoId) ?? aulas[0];
              const youtubeId = aulaAtiva?.link ? extrairYoutubeId(aulaAtiva.link) : null;

              return (
                <div key={modulo} className="overflow-hidden rounded-2xl border border-aura-mist bg-white">
                  <button
                    type="button"
                    onClick={() => setModuloAberto(aberto ? null : modulo)}
                    className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-aura-graphite">{modulo}</p>
                      <p className="text-xs text-aura-graphite-soft">
                        {concluidasNoModulo} de {aulas.length} aulas concluídas
                      </p>
                    </div>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-aura-graphite-soft transition-transform ${aberto ? "rotate-180" : ""}`}
                    />
                  </button>

                  {aberto && (
                    <div className="border-t border-aura-mist p-5 pt-4">
                      {youtubeId && (
                        <div className="mb-3 aspect-video w-full overflow-hidden rounded-xl bg-black">
                          <iframe
                            className="h-full w-full"
                            src={`https://www.youtube.com/embed/${youtubeId}`}
                            title={aulaAtiva?.titulo}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      )}

                      {aulaAtiva && (
                        <button
                          type="button"
                          onClick={() => alternar(aulaAtiva)}
                          className={`mb-4 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition ${
                            aulaAtiva.concluido
                              ? "border-aura-success/30 bg-aura-success/10 text-aura-success"
                              : "border-aura-petrol-700 bg-aura-petrol-700 text-white hover:bg-aura-petrol-600"
                          }`}
                        >
                          {aulaAtiva.concluido ? (
                            <>
                              <CheckCircle2 size={16} />
                              Aula concluída
                            </>
                          ) : (
                            <>
                              <Circle size={16} />
                              Marcar &quot;{aulaAtiva.titulo}&quot; como concluída
                            </>
                          )}
                        </button>
                      )}

                      <ul className="flex flex-col divide-y divide-aura-mist">
                        {aulas.map((aula) => (
                          <li key={aula.id} className="flex items-center gap-2.5 py-2.5 first:pt-0 last:pb-0">
                            <button
                              type="button"
                              onClick={() => alternar(aula)}
                              aria-label={aula.concluido ? "Marcar como pendente" : "Marcar como concluída"}
                              className="shrink-0 text-aura-graphite-soft hover:text-aura-petrol-600"
                            >
                              {aula.concluido ? (
                                <CheckCircle2 size={16} className="text-aura-success" />
                              ) : (
                                <Circle size={16} />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setVideoAtivoPorModulo((prev) => ({ ...prev, [modulo]: aula.id }))
                              }
                              className={`flex-1 truncate text-left text-sm hover:underline ${
                                aula.id === videoAtivoId
                                  ? "font-medium text-aura-petrol-700"
                                  : "text-aura-graphite"
                              }`}
                            >
                              {aula.titulo}
                            </button>
                            {aula.link && !extrairYoutubeId(aula.link) && (
                              <a
                                href={aula.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Abrir material"
                                className="shrink-0 text-aura-graphite-soft hover:text-aura-petrol-600"
                              >
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : faqs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-aura-mist bg-white/60 px-6 py-16 text-center">
          <HelpCircle size={24} className="text-aura-graphite-soft" />
          <p className="text-sm text-aura-graphite-soft">
            Seu gestor ainda não cadastrou nenhuma pergunta frequente.
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-aura-mist rounded-2xl border border-aura-mist bg-white">
          {faqs.map((f) => {
            const aberta = faqAberta === f.id;
            return (
              <div key={f.id}>
                <button
                  type="button"
                  onClick={() => setFaqAberta(aberta ? null : f.id)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
                >
                  <p className="text-sm font-medium text-aura-graphite">{f.pergunta}</p>
                  <ChevronDown
                    size={15}
                    className={`shrink-0 text-aura-graphite-soft transition-transform ${aberta ? "rotate-180" : ""}`}
                  />
                </button>
                {aberta && (
                  <div className="px-5 pb-4 text-sm leading-relaxed text-aura-graphite-soft">
                    {f.resposta}
                    {f.link && (
                      <a
                        href={f.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1.5 inline-flex items-center gap-1 text-aura-petrol-600 hover:underline"
                      >
                        <ExternalLink size={11} />
                        Ver material
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
