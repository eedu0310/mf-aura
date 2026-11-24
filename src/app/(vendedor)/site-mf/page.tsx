"use client";

import { useEffect, useState } from "react";
import { FileText, Globe, Inbox, LayoutTemplate, Loader2 } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { usarMeuAcesso } from "@/lib/usar-permissoes";
import { EMPRESA_DO_SITE } from "@/lib/site-mf/tipos";
import { AtendimentoSite } from "@/components/site-mf/atendimento-site";
import { FormulariosSite } from "@/components/site-mf/formularios-site";
import { PaginasSite } from "@/components/site-mf/paginas-site";
import { EstadoVazio, PageContainer, PageHeader } from "@/components/ui";

type Aba = "atendimento" | "formularios" | "paginas";

const ABAS: { id: Aba; rotulo: string; icone: typeof Inbox; ajuda: string }[] = [
  { id: "atendimento", rotulo: "Atendimento", icone: Inbox, ajuda: "Quem preencheu um formulário do site. Atenda ou passe para o vendedor certo." },
  { id: "formularios", rotulo: "Formulários", icone: FileText, ajuda: "Os formulários que vão nas LPs e no site. Cada envio vira lead no pipeline da MF." },
  { id: "paginas", rotulo: "Páginas", icone: LayoutTemplate, ajuda: "LPs montadas aqui dentro e postas no ar com um clique." },
];

function abaDaUrl(): Aba {
  if (typeof window === "undefined") return "atendimento";
  const a = new URLSearchParams(window.location.search).get("aba");
  return a === "formularios" || a === "paginas" ? a : "atendimento";
}

export default function SiteMfPage() {
  const { profile, carregando } = useUserProfile();
  const acesso = usarMeuAcesso();
  const [aba, setAba] = useState<Aba>("atendimento");

  useEffect(() => {
    setAba(abaDaUrl());
  }, []);

  function trocar(a: Aba) {
    setAba(a);
    const url = new URL(window.location.href);
    url.searchParams.set("aba", a);
    window.history.replaceState(null, "", url);
  }

  if (carregando) {
    return (
      <PageContainer>
        <div className="flex justify-center py-24 text-aura-graphite-soft">
          <Loader2 size={20} className="animate-spin" />
        </div>
      </PageContainer>
    );
  }

  const daMf = profile.empresa === EMPRESA_DO_SITE || acesso.gestorMestre;
  if (!daMf) {
    return (
      <PageContainer largura="estreita">
        <EstadoVazio
          icone={Globe}
          className="mt-10"
          titulo="Área da MF International"
          descricao="O atendimento do site, os formulários e as páginas são da equipe da fábrica."
        />
      </PageContainer>
    );
  }

  const atual = ABAS.find((a) => a.id === aba) ?? ABAS[0];

  return (
    <PageContainer largura="normal" className="flex flex-col gap-5">
      <PageHeader titulo="Site MF" descricao={atual.ajuda} icone={Globe} className="mb-0" />

      <div role="tablist" aria-label="Site MF" className="aura-segmentado max-w-full self-start overflow-x-auto">
        {ABAS.map((a) => {
          const Icone = a.icone;
          const ativa = a.id === aba;
          return (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => trocar(a.id)}
              className="aura-segmento inline-flex items-center gap-1.5"
            >
              <Icone size={14} className={ativa ? "text-aura-petrol-600" : undefined} /> {a.rotulo}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {aba === "atendimento" && <AtendimentoSite />}
        {aba === "formularios" && <FormulariosSite />}
        {aba === "paginas" && <PaginasSite />}
      </div>
    </PageContainer>
  );
}
