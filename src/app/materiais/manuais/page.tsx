import type { Metadata } from "next";
import { ListaModelos } from "@/components/site-mf/lista-modelos";
import { LINK_WHATSAPP, PaginaMateriais, BOTAO_VERMELHO, BOTAO_CONTORNO } from "@/components/site-mf/pagina-materiais";
import { FUNDOS, MANUAIS, WHATSAPP_MF } from "@/lib/site-mf/materiais";
import { fotosCopiadas, logoDasPaginas } from "@/lib/site-mf/materiais-servidor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Manuais das lareiras | MF International" },
  description: "Todos os manuais das lareiras de alto rendimento da MF International, para baixar.",
  robots: { index: false, follow: false },
};

export default async function ManuaisMF() {
  const foto = await fotosCopiadas();
  const logo = await logoDasPaginas(foto);
  return (
    <PaginaMateriais
      ativa="manuais"
      logo={logo}
      fundo={foto(FUNDOS.manuais)}
      titulo="Manuais das lareiras MF"
      descricao="Aqui estão os manuais de todas as lareiras de alto rendimento da MF. Escolha o seu modelo e baixe o manual."
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
      <div id="modelos" className="scroll-mt-24">
        <ListaModelos
          modelos={MANUAIS.map((m) => ({ ...m, imagem: foto(m.imagem) }))}
          botao="Baixar manual"
          whatsapp={WHATSAPP_MF}
          assunto="o manual"
        />
      </div>
      <p className="px-5 pb-12 text-center text-sm text-neutral-500">
        Não achou o seu modelo?{" "}
        <a href={LINK_WHATSAPP} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#CD1C1B] underline">
          Peça o manual no WhatsApp
        </a>
        .
      </p>
    </PaginaMateriais>
  );
}
