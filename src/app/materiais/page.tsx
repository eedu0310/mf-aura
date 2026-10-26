import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { PaginaMateriais, BOTAO_VERMELHO } from "@/components/site-mf/pagina-materiais";
import { BLOCOS, FUNDOS, MANUAIS, TUTORIAIS } from "@/lib/site-mf/materiais";
import { fotosCopiadas, logoDasPaginas } from "@/lib/site-mf/materiais-servidor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Materiais gratuitos | MF International" },
  description: "Catálogo, manuais, blocos 3D, tutoriais e realidade aumentada das lareiras MF.",
  robots: { index: false, follow: false },
};

/**
 * Página de entrada dos materiais gratuitos da MF. Catálogo, tecnologia,
 * realidade aumentada e blocos passam pelo formulário (viram lead); manuais
 * e tutoriais são para quem já tem lareira MF.
 */
export default async function MateriaisMF() {
  const foto = await fotosCopiadas();
  const logo = await logoDasPaginas(foto);
  const adatto = MANUAIS.find((m) => m.nome === "Adatto" && m.grupo === "Expostas")?.imagem ?? MANUAIS[0].imagem;
  const duo = BLOCOS.find((m) => m.nome === "Prime Duo")?.imagem ?? BLOCOS[0].imagem;
  const vision = MANUAIS[0].imagem;
  const m360 = MANUAIS.find((m) => m.nome === "MF 360")?.imagem ?? MANUAIS[0].imagem;

  const cartoes = [
    { titulo: "Catálogo de lareiras", texto: "Todos os modelos MF com medidas, potência e acabamentos.", href: "/f/catalogo-mf", acao: "Receber o catálogo", imagem: foto(FUNDOS.materiais) },
    { titulo: "Tecnologia tripla combustão", texto: "Entenda como a lareira MF aquece mais gastando menos lenha.", href: "/f/tripla-combustao", acao: "Conhecer", imagem: foto(vision) },
    { titulo: "Realidade aumentada", texto: "Veja a lareira na sua casa pelo celular, antes de comprar.", href: "/f/realidade-aumentada", acao: "Experimentar", imagem: foto(m360) },
    { titulo: "Blocos 3D para arquitetos", texto: `${BLOCOS.length} blocos .SKP e .3DS para o seu projeto.`, href: "/f/blocos-3d", acao: "Baixar os blocos", imagem: foto(duo) },
    { titulo: "Manuais de uso", texto: `Manuais de ${MANUAIS.length} modelos, para quem já tem uma lareira MF.`, href: "/f/manuais", acao: "Baixar o manual", imagem: foto(adatto) },
    { titulo: "Tutoriais em vídeo", texto: `${TUTORIAIS.length} vídeos de instalação, lenha, acendimento e limpeza.`, href: "/materiais/tutoriais", acao: "Assistir", imagem: foto(FUNDOS.tutoriais) },
  ];

  return (
    <PaginaMateriais
      ativa="inicio"
      logo={logo}
      fundo={foto(FUNDOS.materiais)}
      titulo="Materiais gratuitos MF"
      descricao="Tudo o que você precisa para escolher, projetar e cuidar da sua lareira de alto rendimento. Desde 1977, pioneiros na tripla combustão."
      acoes={
        <a href="#materiais" className={BOTAO_VERMELHO}>
          Ver os materiais
        </a>
      }
    >
      <div id="materiais" className="mx-auto grid max-w-6xl scroll-mt-28 gap-5 px-4 py-12 sm:grid-cols-2 sm:py-16 lg:grid-cols-3">
        {cartoes.map((c) => (
          <a
            key={c.titulo}
            href={c.href}
            className="group flex flex-col overflow-hidden rounded-md bg-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_0_0_1px_rgba(0,0,0,.05)] transition-shadow hover:shadow-[0_10px_30px_rgba(0,0,0,.12),0_0_0_1px_rgba(0,0,0,.05)]"
          >
            <div className="aspect-[16/10] overflow-hidden bg-neutral-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.imagem} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
            </div>
            <div className="flex flex-1 flex-col p-5">
              <h2 className="text-lg font-bold uppercase leading-snug tracking-wide">{c.titulo}</h2>
              <p className="mt-2 text-[15px] leading-relaxed text-neutral-600">{c.texto}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#CD1C1B]">
                {c.acao} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" aria-hidden />
              </span>
            </div>
          </a>
        ))}
      </div>
    </PaginaMateriais>
  );
}
