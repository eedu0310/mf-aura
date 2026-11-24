import { AuraCoachChat } from "@/components/aura-coach-chat/aura-coach-chat";
import { PageContainer } from "@/components/ui";

export default function AuraCoachPage() {
  // O chat ocupa a altura da tela e já tem o próprio cabeçalho; aqui só o
  // respiro lateral padrão, sem a folga de baixo (não há botão flutuante).
  return (
    <PageContainer largura="normal" className="!pb-6">
      <AuraCoachChat />
    </PageContainer>
  );
}
