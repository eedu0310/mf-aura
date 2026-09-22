"use client";

import { PlaybookEditor } from "@/components/configuracoes/playbook-editor";
import { DocumentUploader } from "@/components/configuracoes/document-uploader";
import { AcademyManager } from "@/components/gestor/academy-manager";
import { LinksManager } from "@/components/gestor/links-manager";
import { FaqManager } from "@/components/gestor/faq-manager";
import { NiveisManager } from "@/components/gestor/niveis-manager";
import { useUserProfile } from "@/lib/user-profile-context";

export function ConfiguracoesTab() {
  const { profile } = useUserProfile();

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-lg font-semibold text-aura-graphite">
          Base de Conhecimento
        </p>
        <p className="text-sm text-aura-graphite-soft">
          Configure recursos para todos os vendedores de {profile.empresa}
        </p>
      </div>

      <PlaybookEditor />
      <DocumentUploader />
      <AcademyManager />
      <LinksManager />
      <FaqManager />
      <NiveisManager />
    </div>
  );
}