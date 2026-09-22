import type { ReactNode } from "react";
import { VendorSidebar } from "@/components/vendor-sidebar";
import { VendorTopbar } from "@/components/vendor-topbar";
import { MobileNavbar } from "@/components/mobile-navbar";
import { FloatingActionButton } from "@/components/floating-action-button";

interface VendedorLayoutProps {
  children: ReactNode;
}

export default function VendedorLayout({ children }: VendedorLayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-aura-bg">
      <VendorSidebar />
      <MobileNavbar />
      <FloatingActionButton />

      <div className="flex min-w-0 flex-1 flex-col pt-14 lg:pt-0">
        <VendorTopbar />

        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
