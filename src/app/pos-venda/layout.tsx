"use client";

import { VendorSidebar } from "@/components/vendor-sidebar";
import { VendorTopbar } from "@/components/vendor-topbar";
import { MobileNavbar } from "@/components/mobile-navbar";
import { OnboardingGuard } from "@/components/onboarding-guard";
import { RoleGuard } from "@/components/role-guard";

/**
 * O pós-venda entra direto nesta tela ao fazer login, então ela precisa do
 * mesmo menu das outras áreas — antes só tinha um botão "Voltar" que levava
 * para a tela do vendedor.
 */
export default function PosVendaLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingGuard>
      <RoleGuard papeisPermitidos={["Pós-venda", "Gestor", "Diretor"]}>
        <div className="flex min-h-screen w-full bg-aura-bg">
          <VendorSidebar />
          <MobileNavbar />
          <div className="flex min-w-0 flex-1 flex-col pt-14 lg:pt-0">
            <VendorTopbar />
            <main className="min-w-0 flex-1 overflow-x-hidden px-6 py-8 sm:px-8">{children}</main>
          </div>
        </div>
      </RoleGuard>
    </OnboardingGuard>
  );
}
