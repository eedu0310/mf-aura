import Script from "next/script";
import type { ReactNode } from "react";
import { TELEFONE_MF, WHATSAPP_MF } from "@/lib/site-mf/materiais";

export type AbaMateriais = "inicio" | "catalogo" | "tecnologia" | "realidade" | "blocos" | "manuais" | "tutoriais";

export const LINK_WHATSAPP = `https://wa.me/${WHATSAPP_MF}`;

/**
 * Moldura das páginas de materiais da MF: barra vermelha com o logo, foto
 * no topo, conteúdo, faixa de dúvida e rodapé. Mesmo visual das páginas
 * dos formulários (/f/…). O chat do site aparece aqui também.
 *
 * Sem menu para os outros materiais (pedido do Elton): quem abriu os
 * blocos vê só os blocos, quem abriu os manuais vê só os manuais.
 */
export function PaginaMateriais({
  ativa,
  logo,
  fundo,
  titulo,
  descricao,
  acoes,
  children,
}: {
  ativa: AbaMateriais;
  logo: string;
  fundo: string;
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f6f5f3] font-sans text-neutral-900">
      <header className="sticky top-0 z-30 bg-[#CD1C1B] shadow-[0_1px_0_rgba(0,0,0,.08)]" data-material={ativa}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-center px-4 md:h-20">
          <a href="https://mfinternational.com.br" aria-label="MF International" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt="MF International" className="h-9 w-auto md:h-11" />
          </a>
        </div>
      </header>

      <section
        className="relative bg-neutral-800 bg-cover bg-center"
        style={{ backgroundImage: `linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.55)), url("${fundo}")` }}
      >
        <div className="mx-auto max-w-4xl px-5 py-14 text-center text-white sm:py-20">
          <h1 className="text-3xl font-bold uppercase leading-tight tracking-wide sm:text-[42px]">{titulo}</h1>
          {descricao && <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">{descricao}</p>}
          {acoes && <div className="mt-7 flex flex-wrap items-center justify-center gap-3">{acoes}</div>}
        </div>
      </section>

      <main>{children}</main>

      <section className="bg-[#CD1C1B] px-5 py-12 text-white">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 text-center md:flex-row md:justify-between md:text-left">
          <div>
            <h2 className="text-2xl font-bold uppercase tracking-wide">Ainda tem alguma dúvida?</h2>
            <p className="mt-1 text-white/90">Fale com a nossa equipe e receba orientação especializada.</p>
          </div>
          <a href={LINK_WHATSAPP} target="_blank" rel="noopener noreferrer" className={BOTAO_CLARO}>
            Falar no WhatsApp
          </a>
        </div>
      </section>

      <footer className="bg-neutral-950 px-5 py-8 text-center text-sm text-white/70">
        <p className="font-semibold text-white">MF International · desde 1977</p>
        <p className="mt-1">ERS-122, Km 08, Conceição · São Sebastião do Caí/RS</p>
        <p className="mt-1">
          WhatsApp{" "}
          <a href={LINK_WHATSAPP} className="text-white underline" target="_blank" rel="noopener noreferrer">
            {TELEFONE_MF}
          </a>{" "}
          ·{" "}
          <a href="https://mfinternational.com.br" className="text-white underline">
            mfinternational.com.br
          </a>
        </p>
      </footer>

      <Script src="/widget-mf.js" strategy="afterInteractive" />
    </div>
  );
}

export const BOTAO_VERMELHO =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-[4px] bg-[#CD1C1B] px-6 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-[#a91615]";
export const BOTAO_CLARO =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-[4px] bg-white px-6 text-sm font-semibold uppercase tracking-wide text-[#CD1C1B] transition-colors hover:bg-neutral-100";
export const BOTAO_CONTORNO =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-[4px] border-2 border-white px-6 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-white hover:text-neutral-900";
