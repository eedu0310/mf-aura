"use client";

import { ClipboardCheck } from "lucide-react";
import { AprovacaoCompromissosMensais } from "@/components/gestor/aprovacao-compromissos-mensais";

export default function CompromissosMensaisPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-semibold text-aura-graphite">
          Compromissos Mensais
        </h1>
        <p className="text-sm text-aura-graphite-soft">
          Aprove ou rejeite os compromissos de seus vendedores
        </p>
      </div>

      {/* Conteúdo */}
      <AprovacaoCompromissosMensais />
    </div>
  );
}