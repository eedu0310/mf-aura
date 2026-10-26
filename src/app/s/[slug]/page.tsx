import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { PaginaPublica } from "@/components/site-mf/pagina-publica";
import type { Bloco, CampoFormulario } from "@/lib/site-mf/tipos";

export const dynamic = "force-dynamic";

/**
 * Página de captura pública (LP) montada na aba Site da AURA.
 * Só a página publicada abre; rascunho dá 404 para quem está de fora.
 */
async function carregar(slug: string) {
  const sb = getSupabaseServiceClient();
  if (!sb) return null;
  const { data: pagina } = await sb
    .from("site_paginas")
    .select("slug, titulo, blocos, cor, tema, seo_titulo, seo_descricao, publicada, formulario_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!pagina || !pagina.publicada) return null;
  let formulario = null;
  if (pagina.formulario_id) {
    const { data } = await sb
      .from("site_formularios")
      .select("slug, titulo, descricao, campos, botao_texto, cor, ativo")
      .eq("id", pagina.formulario_id)
      .maybeSingle();
    if (data?.ativo) formulario = { ...data, campos: (data.campos ?? []) as CampoFormulario[] };
  }
  return { pagina, formulario };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await carregar(slug);
  if (!r) return { title: "Página não encontrada" };
  const titulo = r.pagina.seo_titulo || r.pagina.titulo;
  return {
    // Título inteiro, sem o sufixo "· AURA" do sistema: quem vê é o cliente.
    title: { absolute: `${titulo} | MF International` },
    description: r.pagina.seo_descricao ?? undefined,
    // A LP é para ser encontrada, ao contrário do resto do sistema.
    robots: { index: true, follow: true },
    openGraph: { title: titulo, description: r.pagina.seo_descricao ?? undefined, siteName: "MF International" },
  };
}

export default async function PaginaDoSite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await carregar(slug);
  if (!r) notFound();
  return (
    <PaginaPublica
      slug={r.pagina.slug}
      blocos={(r.pagina.blocos ?? []) as Bloco[]}
      cor={r.pagina.cor}
      tema={r.pagina.tema === "claro" ? "claro" : "escuro"}
      formulario={r.formulario}
    />
  );
}
