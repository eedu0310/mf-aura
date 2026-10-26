import type { Metadata } from "next";
import { LINK_WHATSAPP, PaginaMateriais, BOTAO_VERMELHO, BOTAO_CONTORNO } from "@/components/site-mf/pagina-materiais";
import { VideoTutorial } from "@/components/site-mf/video-tutorial";
import { FUNDOS, TUTORIAIS } from "@/lib/site-mf/materiais";
import { fotosCopiadas, logoDasPaginas } from "@/lib/site-mf/materiais-servidor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Tutoriais MF | MF International" },
  description: "Vídeos da MF sobre instalação, lenha, acendimento e limpeza da lareira de alto rendimento.",
  robots: { index: false, follow: false },
};

export default async function TutoriaisMF() {
  const foto = await fotosCopiadas();
  const logo = await logoDasPaginas(foto);
  const grupos = [...new Set(TUTORIAIS.map((t) => t.grupo))];
  const ancora = (g: string) =>
    g
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
  return (
    <PaginaMateriais
      ativa="tutoriais"
      logo={logo}
      fundo={foto(FUNDOS.tutoriais)}
      titulo="Tutoriais MF"
      descricao="Vídeos curtos para tirar o melhor da sua lareira: instalação, escolha da lenha, acendimento, controle do fogo e limpeza."
      acoes={
        <>
          <a href={`#${ancora(grupos[0])}`} className={BOTAO_VERMELHO}>
            Ver os vídeos
          </a>
          <a href={LINK_WHATSAPP} target="_blank" rel="noopener noreferrer" className={BOTAO_CONTORNO}>
            Falar com um atendente
          </a>
        </>
      }
    >
      <div className="sticky top-16 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur md:top-20">
        <nav aria-label="Assuntos" className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3">
          {grupos.map((g) => (
            <a key={g} href={`#${ancora(g)}`} className="whitespace-nowrap rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-semibold text-neutral-700 hover:border-neutral-900">
              {g}
            </a>
          ))}
        </nav>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        {grupos.map((g) => (
          <section key={g} id={ancora(g)} className="mt-12 scroll-mt-36 first:mt-0" aria-label={g}>
            <h2 className="flex items-center gap-3 text-lg font-bold uppercase tracking-wide">
              <span className="h-5 w-1.5 rounded-full bg-[#CD1C1B]" aria-hidden />
              {g}
            </h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {TUTORIAIS.filter((t) => t.grupo === g).map((t) => (
                <VideoTutorial key={t.video} tutorial={t} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </PaginaMateriais>
  );
}
