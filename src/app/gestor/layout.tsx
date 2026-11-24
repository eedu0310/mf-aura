"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuraLogoFull } from "@/components/aura-logo";
import { OnboardingGuard } from "@/components/onboarding-guard";
import { RoleGuard } from "@/components/role-guard";
import { BotaoTema } from "@/components/tema";
import { useUserProfile } from "@/lib/user-profile-context";
import { AvatarUsuario } from "@/components/avatar-usuario";

export default function GestorLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useUserProfile();

  return (
    <OnboardingGuard>
      <RoleGuard papeisPermitidos={["Gestor"]}>
        <div className="min-h-screen bg-aura-bg">
          <header className="area-segura-topo sticky top-0 z-40 border-b border-aura-mist bg-aura-surface/85 backdrop-blur">
            <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <AuraLogoFull />
                <span className="hidden h-5 w-px bg-aura-mist sm:block" aria-hidden />
                <span className="hidden truncate text-sm font-medium text-aura-graphite sm:block">Painel do Gestor</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Link
                  href="/meu-dia"
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-aura-mist px-3 text-xs font-medium text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-graphite"
                >
                  <ArrowLeft size={14} />
                  <span className="hidden sm:inline">Voltar para o Meu Dia</span>
                  <span className="sm:hidden">Voltar</span>
                </Link>
                <BotaoTema />
                <AvatarUsuario
                  foto={profile.fotoUrl}
                  iniciais={profile.avatarIniciais}
                  className="ml-1 h-8 w-8 bg-aura-petrol-600 text-[0.65rem] font-semibold text-white"
                />
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </RoleGuard>
    </OnboardingGuard>
  );
}
