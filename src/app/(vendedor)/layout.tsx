import type { ReactNode } from "react";
import { VendorSidebar } from "@/components/vendor-sidebar";
import { VendorTopbar } from "@/components/vendor-topbar";
import { MobileNavbar } from "@/components/mobile-navbar";
import { FloatingActionButton } from "@/components/floating-action-button";
import { TravaMetaMensal } from "@/components/meu-dia/trava-meta-mensal";
import { OnboardingGuard } from "@/components/onboarding-guard";
import { AvisoErroCarregamento } from "@/components/shared/aviso-erro-carregamento";

interface VendedorLayoutProps {
  children: ReactNode;
}

/**
 * O OnboardingGuard aqui é o mesmo que gestor, marketing e pós-venda já
 * tinham. Faltava só nas telas do vendedor: quem tinha o cadastro incompleto
 * (sem loja) caía no Meu Dia, os dados esperavam a loja para carregar e a
 * tela ficava girando para sempre, sem nunca mandar para o /onboarding
 * (auditoria de 24/11/2026).
 */
export default function VendedorLayout({ children }: VendedorLayoutProps) {
  return (
    <OnboardingGuard>
      <div className="flex min-h-screen w-full bg-aura-bg">
        <VendorSidebar />
        <MobileNavbar />
        <FloatingActionButton />
        <TravaMetaMensal />

        <div className="flex min-w-0 flex-1 flex-col pt-14 lg:pt-0">
          <VendorTopbar />
          <AvisoErroCarregamento />

          <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </OnboardingGuard>
  );
}
