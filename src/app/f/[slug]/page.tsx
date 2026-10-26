import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { FormularioPublico } from "@/components/site-mf/formulario-publico";
import type { CampoFormulario } from "@/lib/site-mf/tipos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Formulário | MF International" },
  robots: { index: false, follow: false },
};

/**
 * O formulário sozinho, para colar no site da MF (Elementor) com um iframe.
 * Fundo transparente para assumir a cor da seção onde for colado.
 */
export default async function FormularioEmbutido({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = getSupabaseServiceClient();
  if (!sb) notFound();
  const { data: f } = await sb
    .from("site_formularios")
    .select("slug, titulo, descricao, campos, botao_texto, cor, ativo")
    .eq("slug", slug)
    .maybeSingle();
  if (!f || !f.ativo) notFound();
  return (
    <div className="min-h-full bg-transparent p-2">
      <FormularioPublico
        slug={f.slug}
        titulo={f.titulo}
        descricao={f.descricao}
        campos={(f.campos ?? []) as CampoFormulario[]}
        botao={f.botao_texto}
        cor={f.cor}
      />
    </div>
  );
}
