"use client";

import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { AprovacaoCompromissosMensais } from "@/components/gestor/aprovacao-compromissos-mensais";

export default function CompromissosMensaisPage() {
  return (
    <div>
      {/* Cabeçalho: o layout do gestor já dá a largura e o respiro da página. */}
      <PageHeader
        titulo="Compromissos Mensais"
        descricao="Aprove ou rejeite os compromissos de seus vendedores"
        icone={ClipboardCheck}
      />

      {/* Conteúdo */}
      <AprovacaoCompromissosMensais />
    </div>
  );
}
