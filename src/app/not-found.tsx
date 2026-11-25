import { Compass } from "lucide-react";
import { AuraLogoFull } from "@/components/aura-logo";
import { BotaoLink } from "@/components/ui";

/**
 * Endereço que não existe (link velho, digitado errado, tela que mudou de
 * lugar). Sem este arquivo o Next mostrava a página 404 padrão, em inglês e
 * sem caminho de volta para o CRM.
 *
 * O botão leva ao Meu Dia: quem está sem sessão é mandado ao login pelo
 * proxy, e cada cargo tem o Meu Dia no menu.
 */
export default function NaoEncontrado() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-aura-bg px-6 py-12 text-center">
      <div className="mb-8">
        <AuraLogoFull />
      </div>
      <div className="aura-card w-full max-w-sm p-6 sm:p-7">
        <Compass size={28} className="mx-auto text-aura-petrol-600" aria-hidden />
        <h1 className="mt-3 font-display text-lg font-semibold text-aura-graphite">Página não encontrada</h1>
        <p className="mt-1.5 text-sm text-aura-graphite-soft">
          Este endereço não existe ou mudou de lugar. Volte para o início e siga pelo menu.
        </p>
        <BotaoLink href="/meu-dia" variante="primario" className="mt-5 w-full justify-center">
          Ir para o início
        </BotaoLink>
      </div>
    </div>
  );
}
