"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuraLogoFull } from "@/components/aura-logo";
import { OnboardingGuard } from "@/components/onboarding-guard";
import { RoleGuard } from "@/components/role-guard";

export default function PosVendaLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingGuard>
      <RoleGuard papeisPermitidos={["Pós-venda", "Gestor", "Diretor"]}>
        <div className="min-h-screen bg-aura-bg">
          <header className="flex items-center justify-between bg-aura-navy-950 px-6 py-4 sm:px-8">
            <AuraLogoFull />
            <Link
              href="/meu-dia"
              className="flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-medium text-white/70 hover:border-white/20 hover:text-white"
            >
              <ArrowLeft size={13} />
              Voltar
            </Link>
          </header>
          <main className="px-6 py-8 sm:px-8">{children}</main>
        </div>
      </RoleGuard>
    </OnboardingGuard>
  );
}
