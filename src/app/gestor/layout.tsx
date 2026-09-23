"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuraLogoFull } from "@/components/aura-logo";
import { OnboardingGuard } from "@/components/onboarding-guard";
import { RoleGuard } from "@/components/role-guard";
import { useUserProfile } from "@/lib/user-profile-context";

export default function GestorLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useUserProfile();

  return (
    <OnboardingGuard>
      <RoleGuard papeisPermitidos={["Gestor", "Diretor"]}>
        <div className="min-h-screen bg-aura-bg">
          <header className="flex items-center justify-between bg-aura-navy-950 px-6 py-4 sm:px-8">
            <AuraLogoFull />
            <div className="flex items-center gap-2">
              {/* O antigo link "Diretoria" apontava para uma rota inexistente (/diretoria). */}
              <Link
                href="/meu-dia"
                className="flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-medium text-white/70 hover:border-white/20 hover:text-white"
              >
                <ArrowLeft size={13} />
                Voltar para Meu Dia
              </Link>
            </div>
          </header>
          <main className="px-6 py-8 sm:px-8">{children}</main>
        </div>
      </RoleGuard>
    </OnboardingGuard>
  );
}
