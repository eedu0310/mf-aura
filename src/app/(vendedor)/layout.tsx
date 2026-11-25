import type { ReactNode } from "react";
import { VendorSidebar } from "@/components/vendor-sidebar";
import { VendorTopbar } from "@/components/vendor-topbar";
import { MobileNavbar } from "@/components/mobile-navbar";
import { FloatingActionButton } from "@/components/floating-action-button";
import { TravaMetaMensal } from "@/components/meu-dia/trava-meta-mensal";
import { AvisoLeadsPendentes } from "@/components/leads/aviso-leads-pendentes";

interface VendedorLayoutProps {
  children: ReactNode;
}

export default function VendedorLayout({ children }: VendedorLayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-aura-bg">
      <VendorSidebar />
      <MobileNavbar />
      <FloatingActionButton />
      <TravaMetaMensal />

      <div className="flex min-w-0 flex-1 flex-col pt-14 lg:pt-0">
        <VendorTopbar />
        <AvisoLeadsPendentes />

        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
