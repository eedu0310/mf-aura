import type { Metadata } from "next";
import { Download, Flame, Leaf, Wind } from "lucide-react";
import { PaginaMateriais, LINK_WHATSAPP, BOTAO_VERMELHO, BOTAO_CONTORNO } from "@/components/site-mf/pagina-materiais";
import { FUNDOS, LINHAS_TRIPLA, TRIPLA_URL } from "@/lib/site-mf/materiais";
import { fotosCopiadas, logoDasPaginas } from "@/lib/site-mf/materiais-servidor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Tripla combustão | MF International" },
  description: "Infográfico gratuito: entenda como a tripla combustão inova nas lareiras de alto rendimento MF.",
  robots: { index: false, follow: false },
};

const PONTOS = [
  {
    icone: Wind,
    titulo: "Uma terceira entrada de ar",
    texto: "Além das entradas de ar comuns, a lareira MF tem uma terceira entrada, que completa a queima e reduz ao máximo a emissão de gases tóxicos.",
  },
  {
    icone: Flame,
    titulo: "Mais calor da mesma lenha",
    texto: "A queima fica mais completa e mais eficiente: chamas mais bonitas e duradouras, com até 80% menos lenha que uma lareira comum.",
  },
  {
    icone: Leaf,
    titulo: "Menos fumaça e poluição",
    texto: "Muito menos monóxido de carbono e hidrocarbonetos saindo pela chaminé. Melhor para a sua casa e para o planeta.",
  },
];

/** Página de download do infográfico da tripla combustão. */
export default async function TriplaCombustaoMF() {
  const foto = await fotosCopiadas();
  const logo = await logoDasPaginas(foto);
  return (
    <PaginaMateriais
      ativa="tecnologia"
      logo={logo}
      fundo={foto(FUNDOS.tripla)}
      titulo="Tecnologia tripla combustão"
      descricao="Pronto! Baixe o infográfico gratuito e entenda como a tripla combustão inova nas lareiras de alto rendimento MF."
      acoes={
        <>
          <a href={TRIPLA_URL} target="_blank" rel="noopener noreferrer" className={BOTAO_VERMELHO}>
            <Download size={18} aria-hidden /> Baixar o infográfico
          </a>
          <a href={LINK_WHATSAPP} target="_blank" rel="noopener noreferrer" className={BOTAO_CONTORNO}>
            Falar com um consultor
          </a>
        </>
      }
    >
      <div className="mx-auto max-w-6xl px-5 py-14 md:py-20">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#CD1C1B]">Pioneiros na tripla combustão</p>
        <h2 className="mx-auto mt-2 max-w-2xl text-center text-3xl font-bold uppercase leading-tight tracking-wide">Como funciona</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PONTOS.map(({ icone: Icone, titulo, texto }) => (
            <div key={titulo} className="rounded-md bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,.06),0_0_0_1px_rgba(0,0,0,.05)]">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#CD1C1B]/10 text-[#CD1C1B]">
                <Icone size={24} aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-bold uppercase tracking-wide">{titulo}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-neutral-600">{texto}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-md bg-neutral-900 p-6 text-white sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/60">Está presente nas linhas</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {LINHAS_TRIPLA.map((l) => (
              <li key={l} className="rounded-full border border-white/25 px-4 py-1.5 text-sm font-semibold">
                {l}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 text-center">
          <a href={TRIPLA_URL} target="_blank" rel="noopener noreferrer" className={BOTAO_VERMELHO}>
            <Download size={18} aria-hidden /> Baixar o infográfico completo
          </a>
        </div>
      </div>
    </PaginaMateriais>
  );
}
