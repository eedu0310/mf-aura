"use client";

import { useMemo, useState } from "react";
import { Download, MessageCircle, Search, X } from "lucide-react";
import { GRUPOS, type GrupoModelo, type ModeloMaterial } from "@/lib/site-mf/materiais";

const NOME_DO_GRUPO: Record<GrupoModelo, string> = {
  Embutidas: "Lareiras embutidas",
  Suspensas: "Lareiras suspensas",
  Expostas: "Lareiras expostas",
};

const tirarAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Cartões dos modelos com botão de baixar, separados por tipo de lareira,
 * com busca pelo nome. Modelo sem arquivo vira "Pedir pelo WhatsApp".
 */
export function ListaModelos({
  modelos,
  botao,
  whatsapp,
  assunto,
}: {
  modelos: ModeloMaterial[];
  botao: string;
  whatsapp: string;
  /** Ex.: "o manual" → "Olá! Quero o manual da MF Orbit." */
  assunto: string;
}) {
  const [grupo, setGrupo] = useState<GrupoModelo | "Todos">("Todos");
  const [busca, setBusca] = useState("");

  const visiveis = useMemo(() => {
    const b = tirarAcento(busca.trim());
    return modelos.filter((m) => (grupo === "Todos" || m.grupo === grupo) && (!b || tirarAcento(m.nome).includes(b)));
  }, [modelos, grupo, busca]);

  const grupos = GRUPOS.filter((g) => visiveis.some((m) => m.grupo === g));
  const contagem = (g: GrupoModelo | "Todos") => (g === "Todos" ? modelos.length : modelos.filter((m) => m.grupo === g).length);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="tablist" aria-label="Tipo de lareira">
          {(["Todos", ...GRUPOS] as const).map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={grupo === g}
              onClick={() => setGrupo(g)}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                grupo === g ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-500"
              }`}
            >
              {g === "Todos" ? "Todos" : g} <span className={grupo === g ? "text-white/60" : "text-neutral-400"}>{contagem(g)}</span>
            </button>
          ))}
        </div>
        <label className="relative block md:w-72">
          <span className="sr-only">Buscar modelo</span>
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar modelo (ex.: Adatto 90)"
            className="h-12 w-full rounded-[4px] border border-neutral-300 bg-white pl-10 pr-10 text-[15px] outline-none focus:border-neutral-900"
          />
          {busca && (
            <button type="button" onClick={() => setBusca("")} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100">
              <X size={16} />
            </button>
          )}
        </label>
      </div>

      {grupos.length === 0 && (
        <p className="mt-12 text-center text-neutral-500">
          Nenhum modelo com esse nome.{" "}
          <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#CD1C1B] underline">
            Fale com a gente pelo WhatsApp
          </a>
          .
        </p>
      )}

      {grupos.map((g) => (
        <section key={g} className="mt-10 first-of-type:mt-8" aria-labelledby={`grupo-${g}`}>
          <h2 id={`grupo-${g}`} className="flex items-center gap-3 text-lg font-bold uppercase tracking-wide text-neutral-900">
            <span className="h-5 w-1.5 rounded-full bg-[#CD1C1B]" aria-hidden />
            {NOME_DO_GRUPO[g]}
          </h2>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {visiveis
              .filter((m) => m.grupo === g)
              .map((m) => {
                const pedir = `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Olá! Quero ${assunto} da ${m.nome} (${m.grupo.toLowerCase().replace(/s$/, "")}).`)}`;
                return (
                  <li key={`${m.grupo}-${m.nome}`} className="group flex flex-col overflow-hidden rounded-md bg-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_0_0_1px_rgba(0,0,0,.05)] transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,.10),0_0_0_1px_rgba(0,0,0,.05)]">
                    <div className="aspect-square overflow-hidden bg-neutral-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.imagem}
                        alt={`Lareira ${m.nome}`}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
                      <p className="text-[15px] font-bold uppercase leading-snug tracking-wide sm:text-base">{m.nome}</p>
                      <div className="mt-auto">
                        {m.url ? (
                          <a
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] bg-[#CD1C1B] px-2 text-[12px] font-semibold uppercase text-white sm:gap-2 sm:px-3 sm:text-[13px] sm:tracking-wide transition-colors hover:bg-[#a91615]"
                          >
                            <Download size={16} aria-hidden /> {botao}
                          </a>
                        ) : (
                          <a
                            href={pedir}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] border border-neutral-300 px-2 text-[12px] font-semibold uppercase text-neutral-800 sm:gap-2 sm:px-3 sm:text-[13px] sm:tracking-wide transition-colors hover:border-neutral-900"
                          >
                            <MessageCircle size={16} aria-hidden /> <span className="sm:hidden">WhatsApp</span>
                            <span className="hidden sm:inline">Pedir no WhatsApp</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
