"use client";

import { useEffect, useState } from "react";
import { listarLinks, type LinkUtil } from "@/lib/supabase/links";
import { useUserProfile } from "@/lib/user-profile-context";
import { LinksGestor } from "@/components/area-vendedor/links-gestor";

/**
 * Links úteis da loja, na aba Configurações do gestor.
 *
 * O formulário antigo só criava e apagava. O editor agora é o LinksGestor:
 * edita, ordena e define a frase que vai junto no WhatsApp (catálogo, folder).
 * Um lugar só para mexer; o vendedor vê na Área do Vendedor e nos atalhos
 * da conversa.
 */
export function LinksManager() {
  const { profile } = useUserProfile();
  const [links, setLinks] = useState<LinkUtil[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    const lista = await listarLinks();
    if (lista === null) setErro("Banco não configurado.");
    else setLinks(lista);
  }

  useEffect(() => {
    void carregar();
  }, []);

  if (erro) return <p className="text-xs text-aura-danger">{erro}</p>;
  return <LinksGestor empresa={profile.empresa} links={links} aoMudar={carregar} />;
}
