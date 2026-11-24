"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Link2, Loader2, Map as MapaIcone, UserRound } from "lucide-react";
import { listarLinks, type LinkUtil } from "@/lib/supabase/links";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Alerta, EstadoVazio, PageContainer, PageHeader, Selo, classeBotao, type Tom } from "@/components/ui";

const TOM_CATEGORIA: Record<string, Tom> = {
  Catálogo: "marca",
  Planilha: "sucesso",
  Vendas: "ouro",
  Marketing: "atencao",
};

export default function AreaVendedorPage() {
  const [links, setLinks] = useState<LinkUtil[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [usandoSupabase, setUsandoSupabase] = useState(true);

  async function carregar() {
    const lista = await listarLinks();
    if (lista === null) {
      setUsandoSupabase(false);
    } else {
      setLinks(lista);
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
     
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const canal = supabase
      .channel("aura-links-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "links_uteis" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
     
  }, []);

  return (
    <PageContainer largura="estreita" className="flex flex-col gap-6">
      <PageHeader
        titulo="Área do Vendedor"
        descricao="Links importantes do dia a dia — catálogo, planilhas e materiais."
        icone={UserRound}
        className="mb-0"
      />

      <a href="/mapa-comercial" className="aura-card aura-card-interativo flex items-center justify-between gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aura-petrol-500/10">
          <MapaIcone size={17} className="text-aura-petrol-600" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-aura-graphite">Mapa Comercial</p>
          <p className="mt-0.5 text-xs text-aura-graphite-soft">Cadência, scripts, objeções e mensagens para facilitar o atendimento.</p>
        </div>
        <span className={classeBotao("primario", "sm")}>Abrir</span>
      </a>

      {!usandoSupabase && (
        <Alerta tom="atencao" titulo="Esta área está indisponível no momento. Avise seu gestor." />
      )}

      {carregando ? (
        <div className="flex justify-center py-16 text-aura-graphite-soft">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : links.length === 0 ? (
        <EstadoVazio icone={Link2} titulo="Seu gestor ainda não cadastrou nenhum link nesta loja." />
      ) : (
        <div className="aura-card flex flex-col divide-y divide-aura-mist overflow-hidden">
          {links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 px-4 py-3.5 transition hover:bg-aura-sunken/60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-aura-sunken text-aura-graphite-soft group-hover:text-aura-petrol-600">
                <Link2 size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-aura-graphite">{link.titulo}</p>
                <p className="truncate text-xs text-aura-graphite-soft">{link.url}</p>
              </div>
              {link.categoria && (
                <Selo tom={TOM_CATEGORIA[link.categoria] ?? "neutro"} className="shrink-0">
                  {link.categoria}
                </Selo>
              )}
              <ExternalLink size={14} className="shrink-0 text-aura-graphite-soft" />
            </a>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
