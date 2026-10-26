import type { Metadata } from "next";
import { Smartphone } from "lucide-react";
import { PaginaMateriais, BOTAO_VERMELHO, BOTAO_CONTORNO } from "@/components/site-mf/pagina-materiais";
import { FUNDOS, LOGO_MF_PREVIEW, MF_PREVIEW_URL, TELAS_MF_PREVIEW } from "@/lib/site-mf/materiais";
import { fotosCopiadas, logoDasPaginas } from "@/lib/site-mf/materiais-servidor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "MF Preview: realidade aumentada | MF International" },
  description: "Veja a lareira MF no seu ambiente pelo celular, com o MF Preview.",
  robots: { index: false, follow: false },
};

const PASSOS = [
  ["Abra no celular", "Toque no botão abaixo pelo celular."],
  ["Escolha a lareira", "Navegue pelos modelos MF e escolha o que quer ver."],
  ["Veja no seu ambiente", "Aponte a câmera para o ambiente e veja como a lareira fica na sua casa."],
];

/** Página de acesso ao MF Preview (para onde o formulário de realidade aumentada leva). */
export default async function RealidadeAumentadaMF() {
  const foto = await fotosCopiadas();
  const logo = await logoDasPaginas(foto);
  return (
    <PaginaMateriais
      ativa="realidade"
      logo={logo}
      fundo={foto(FUNDOS.realidade)}
      titulo="Realidade aumentada MF"
      descricao="Pronto! Com o MF Preview você vê a lareira na sua casa pelo celular, antes de comprar."
      acoes={
        <>
          <a href={MF_PREVIEW_URL} target="_blank" rel="noopener noreferrer" className={BOTAO_VERMELHO}>
            <Smartphone size={18} aria-hidden /> Abrir o MF Preview
          </a>
          <a href="https://mfinternational.com.br" target="_blank" rel="noopener noreferrer" className={BOTAO_CONTORNO}>
            Conhecer os produtos MF
          </a>
        </>
      }
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 md:grid-cols-[1fr_1.1fr] md:py-20">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto(LOGO_MF_PREVIEW)} alt="MF Preview" className="h-12 w-auto" />
          <h2 className="mt-6 text-3xl font-bold uppercase leading-tight tracking-wide">Como usar</h2>
          <ol className="mt-6 space-y-5">
            {PASSOS.map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#CD1C1B] text-sm font-bold text-white">{i + 1}</span>
                <div>
                  <p className="font-bold uppercase tracking-wide">{t}</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-neutral-600">{d}</p>
                </div>
              </li>
            ))}
          </ol>
          <a href={MF_PREVIEW_URL} target="_blank" rel="noopener noreferrer" className={`${BOTAO_VERMELHO} mt-8`}>
            Acessar o MF Preview
          </a>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {TELAS_MF_PREVIEW.map((t, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={foto(t)} alt={`Tela ${i + 1} do MF Preview`} loading="lazy" className="w-full rounded-xl object-cover shadow-md" />
          ))}
        </div>
      </div>
    </PaginaMateriais>
  );
}
