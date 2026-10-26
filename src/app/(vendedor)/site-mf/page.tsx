"use client";

import { useEffect, useState } from "react";
import { FileText, Inbox, LayoutTemplate, Loader2 } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { usarMeuAcesso } from "@/lib/usar-permissoes";
import { EMPRESA_DO_SITE } from "@/lib/site-mf/tipos";
import { AtendimentoSite } from "@/components/site-mf/atendimento-site";
import { FormulariosSite } from "@/components/site-mf/formularios-site";
import { PaginasSite } from "@/components/site-mf/paginas-site";

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
      <div className="flex justify-center py-24 text-aura-graphite-soft">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  const daMf = profile.empresa === EMPRESA_DO_SITE || acesso.gestorMestre;
  if (!daMf) {
    return (
      <div className="mx-auto max-w-xl py-24 text-center">
        <p className="font-display text-xl font-semibold text-aura-graphite">Área da MF International</p>
        <p className="mt-2 text-sm text-aura-graphite-soft">O atendimento do site, os formulários e as páginas são da equipe da fábrica.</p>
      </div>
    );
  }

  const atual = ABAS.find((a) => a.id === aba) ?? ABAS[0];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 pb-24">
      <div>
        <p className="font-display text-xl font-semibold text-aura-graphite">Site MF</p>
        <p className="text-sm text-aura-graphite-soft">{atual.ajuda}</p>
      </div>

      <div role="tablist" aria-label="Site MF" className="flex flex-wrap gap-2">
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
              className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition ${
                ativa
                  ? "border-aura-petrol-700 bg-aura-petrol-700 text-white"
                  : "border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-500/50"
              }`}
            >
              <Icone size={16} /> {a.rotulo}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {aba === "atendimento" && <AtendimentoSite />}
        {aba === "formularios" && <FormulariosSite />}
        {aba === "paginas" && <PaginasSite />}
      </div>
    </div>
  );
}
