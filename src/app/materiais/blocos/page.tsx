import type { Metadata } from "next";
import { ListaModelos } from "@/components/site-mf/lista-modelos";
import { LINK_WHATSAPP, PaginaMateriais, BOTAO_VERMELHO, BOTAO_CONTORNO } from "@/components/site-mf/pagina-materiais";
import { BLOCOS, FUNDOS, WHATSAPP_MF } from "@/lib/site-mf/materiais";
import { fotosCopiadas, logoDasPaginas } from "@/lib/site-mf/materiais-servidor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Blocos 3D para arquitetos | MF International" },
  description: "Blocos .SKP e .3DS das lareiras MF para o seu projeto.",
  robots: { index: false, follow: false },
};

export default async function BlocosMF() {
  const foto = await fotosCopiadas();
  const logo = await logoDasPaginas(foto);
  return (
    <PaginaMateriais
      ativa="blocos"
      logo={logo}
      fundo={foto(FUNDOS.blocos)}
      titulo="Blocos 3D das lareiras MF"
      descricao="Valorize o seu projeto com as lareiras de alto rendimento da MF. Todos os modelos em .SKP (SketchUp) e .3DS, feitos pelos nossos projetistas."
      acoes={
        <>
          <a href="#modelos" className={BOTAO_VERMELHO}>
            Escolher o modelo
          </a>
          <a href={LINK_WHATSAPP} target="_blank" rel="noopener noreferrer" className={BOTAO_CONTORNO}>
            Falar com um atendente
          </a>
        </>
      }
    >
      <div className="border-b border-neutral-200 bg-white">
        <ul className="mx-auto grid max-w-6xl gap-px bg-neutral-200 text-center sm:grid-cols-3">
          {[
            ["Formatos", ".SKP (SketchUp) e .3DS"],
            ["Medidas reais", "Desenhados pela engenharia da MF"],
            ["Orientação técnica", "Gratuita para o seu projeto"],
          ].map(([t, d]) => (
            <li key={t} className="bg-white px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#CD1C1B]">{t}</p>
              <p className="mt-1 text-[15px] text-neutral-700">{d}</p>
            </li>
          ))}
        </ul>
      </div>
      <div id="modelos" className="scroll-mt-28">
        <ListaModelos
          modelos={BLOCOS.map((m) => ({ ...m, imagem: foto(m.imagem) }))}
          botao="Baixar bloco"
          whatsapp={WHATSAPP_MF}
          assunto="o bloco 3D"
        />
      </div>
    </PaginaMateriais>
  );
}
