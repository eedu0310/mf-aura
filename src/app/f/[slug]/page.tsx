import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { FormularioPublico } from "@/components/site-mf/formulario-publico";
import type { CampoFormulario } from "@/lib/site-mf/tipos";
import { fotosCopiadas } from "@/lib/site-mf/materiais-servidor";

export const dynamic = "force-dynamic";

/** Logo branco da MF e fundo padrão, até a equipe trocar pelo editor. */
const LOGO_PADRAO = "https://cdn.bitrix24.com.br/b28173705/landing/973/97305c65109aaf52e1b57b409fe2723c/mf_branco_1x.png";
const FUNDO_PADRAO = "https://cdn.bitrix24.com.br/b28173705/landing/123/123cadf9605d69a3b1811ca15fa0a237/montagem_m_ltiplos_cat_logos_2_1x.jpg";

async function buscar(slug: string) {
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const [{ data: f }, { data: config }] = await Promise.all([
    sb
      .from("site_formularios")
      .select("slug, nome, titulo, descricao, campos, botao_texto, cor, ativo, imagem_fundo")
      .eq("slug", slug)
      .maybeSingle(),
    sb.from("site_chat_config").select("logo_url").eq("empresa", "MF International").maybeSingle(),
  ]);
  if (!f || !f.ativo) return null;
  return { f, logo: (config?.logo_url as string | null) || LOGO_PADRAO };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await buscar(slug);
  return {
    title: { absolute: r?.f.titulo ? `${r.f.titulo} | MF International` : "Materiais | MF International" },
    description: r?.f.descricao ?? undefined,
    robots: { index: false, follow: false },
  };
}

/**
 * Formulário do site da MF.
 *
 * Aberto direto (/f/catalogo-mf): página no visual das páginas de materiais
 * que a MF já usava, com a barra vermelha e o logo, a foto de fundo e o
 * cartão "Preencha seus dados". Embutido (?embed=1, no chat do site ou num
 * iframe do Elementor): só o cartão, sem a página em volta.
 */
export default async function FormularioDoSite({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const busca = await searchParams;
  const r = await buscar(slug);
  if (!r) notFound();
  const { f, logo } = r;
  const campos = (f.campos ?? []) as CampoFormulario[];

  if (busca.embed === "1") {
    return (
      <div className="min-h-full bg-transparent p-2">
        <FormularioPublico slug={f.slug} campos={campos} botao={f.botao_texto} cor={f.cor} variante="cartao" />
      </div>
    );
  }

  const foto = await fotosCopiadas();
  const fundo = foto((f.imagem_fundo as string | null) || FUNDO_PADRAO);

  return (
    <div className="min-h-screen bg-white font-sans text-neutral-900">
      <header className="flex h-24 items-center justify-center bg-[#CD1C1B] sm:h-28">
        <a href="https://mfinternational.com.br" aria-label="MF International">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto(logo)} alt="MF International" className="h-12 w-auto sm:h-14" />
        </a>
      </header>

      <section
        className="relative bg-neutral-800 bg-cover bg-center"
        style={{ backgroundImage: `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url("${fundo}")` }}
      >
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-12 sm:py-16 lg:grid-cols-[1fr_420px] lg:gap-14">
          <div className="text-white">
            {f.titulo && <h1 className="text-3xl font-bold uppercase leading-tight tracking-wide sm:text-4xl">{f.titulo}</h1>}
            {f.descricao && <p className="mt-4 max-w-xl text-base leading-relaxed text-white/90 sm:text-lg">{f.descricao}</p>}
          </div>
          <FormularioPublico slug={f.slug} campos={campos} botao={f.botao_texto} cor={f.cor} variante="cartao" />
        </div>
      </section>

      <section className="bg-[#CD1C1B] px-5 py-12 text-white sm:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold uppercase tracking-wide sm:text-3xl">Somos a MF International</h2>
          <p className="mt-5 text-base leading-relaxed text-white/95 sm:text-lg">
            Desde 1977 produzindo lareiras de alto rendimento em São Sebastião do Caí, no Rio Grande do Sul. Pioneiros na tripla combustão, com
            engenharia de origem canadense e lareiras feitas em chapas de aço de 3 mm a 6,35 mm.
          </p>
          <p className="mt-4 text-base font-semibold sm:text-lg">Venha conhecer de perto e aquecer a sua casa com a MF.</p>
        </div>
      </section>

      <footer className="bg-neutral-950 px-5 py-8 text-center text-sm text-white/70">
        <p className="font-semibold text-white">MF International</p>
        <p className="mt-1">ERS-122, Km 08, Conceição · São Sebastião do Caí/RS</p>
        <p className="mt-1">
          WhatsApp{" "}
          <a href="https://wa.me/555135361422" className="text-white underline" target="_blank" rel="noopener noreferrer">
            (51) 3536-1422
          </a>{" "}
          ·{" "}
          <a href="https://mfinternational.com.br" className="text-white underline">
            mfinternational.com.br
          </a>
        </p>
        <p className="mt-3">
          <a href="/materiais" className="font-semibold text-white underline">
            Ver todos os materiais gratuitos
          </a>
        </p>
      </footer>
    </div>
  );
}
