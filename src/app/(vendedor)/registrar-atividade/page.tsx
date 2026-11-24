import { ClipboardPen } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui";
import { RegistrarAtividadeFlow } from "@/components/registrar-atividade/registrar-atividade-flow";

export default function RegistrarAtividadePage() {
  return (
    <PageContainer largura="estreita">
      <PageHeader
        titulo="Registrar atividade"
        icone={ClipboardPen}
      />
      <RegistrarAtividadeFlow />
    </PageContainer>
  );
}
