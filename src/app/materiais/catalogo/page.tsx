import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PaginaMateriais, LINK_WHATSAPP, BOTAO_VERMELHO, BOTAO_CONTORNO } from "@/components/site-mf/pagina-materiais";
import { CATALOGO_URL, FUNDOS, MANUAIS } from "@/lib/site-mf/materiais";
import { fotosCopiadas, logoDasPaginas } from "@/lib/site-mf/materiais-servidor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Catálogo MF 2025 | MF International" },
  description: "Baixe o catálogo das lareiras de alto rendimento MF International.",
  robots: { index: false, follow: false },
};

/** Página de download do catálogo (para onde o formulário do catálogo leva). */
export default async function CatalogoMF() {
  const foto = await fotosCopiadas();
  const logo = await logoDasPaginas(foto);
  const destaque = ["Vision", "Wide Duo", "Altezza", "MF 360"].map((n) => MANUAIS.find((m) => m.nome === n)).filter((m) => !!m);

  return (
    <PaginaMateriais
      ativa="catalogo"
      logo={logo}
      fundo={foto(FUNDOS.materiais)}
      titulo="Catálogo MF 2025"
      descricao="Pronto! Aqui está o catálogo completo das lareiras de alto rendimento MF International."
      acoes={
        <>
          <a href={CATALOGO_URL} target="_blank" rel="noopener noreferrer" className={BOTAO_VERMELHO}>
            <Download size={18} aria-hidden /> Baixar o catálogo
          </a>
          <a href={LINK_WHATSAPP} target="_blank" rel="noopener noreferrer" className={BOTAO_CONTORNO}>
            Falar com um consultor
          </a>
        </>
      }
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-14 md:grid-cols-2 md:py-20">
        <div className="grid grid-cols-2 gap-3">
          {destaque.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.nome} src={foto(m.imagem)} alt={`Lareira ${m.nome}`} loading="lazy" className="aspect-square w-full rounded-md object-cover shadow-sm" />
          ))}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#CD1C1B]">Edição 2025</p>
          <h2 className="mt-2 text-3xl font-bold uppercase leading-tight tracking-wide">Todas as lareiras MF em um só lugar</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-neutral-700">
            Embutidas, expostas e suspensas, com medidas e potência de cada modelo. Use o catálogo para escolher com calma e, quando
            quiser, a nossa equipe ajuda a definir o modelo certo para o seu ambiente.
          </p>
          <ul className="mt-6 space-y-2 text-[15px] text-neutral-700">
            {["Fábrica própria desde 1977", "Pioneiros na tripla combustão", "Chapas de aço de 3 mm a 6,35 mm", "Engenharia de origem canadense"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#CD1C1B]" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={CATALOGO_URL} target="_blank" rel="noopener noreferrer" className={BOTAO_VERMELHO}>
              <Download size={18} aria-hidden /> Baixar agora (PDF)
            </a>

          </div>
        </div>
      </div>
    </PaginaMateriais>
  );
}
