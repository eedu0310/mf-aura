"use client";

import { Suspense } from "react";
import { LayoutDashboard } from "lucide-react";
import { OnboardingGuard } from "@/components/onboarding-guard";
import { RoleGuard } from "@/components/role-guard";
import { useUserProfile } from "@/lib/user-profile-context";
import { AreaDeTrabalho, type GrupoDaArea } from "@/components/area-de-trabalho";
import { ABAS_MARKETING, hrefDaAba, useAbaMarketing } from "@/components/marketing/aba-marketing";

/**
 * A Central de Marketing é uma ÁREA DE TRABALHO (src/components/area-de-trabalho):
 * abre sozinha, com o próprio menu, e o Voltar leva para onde a pessoa estava
 * no CRM. Mesma casca do Pós-venda e do Painel do Gestor.
 */
function Casca({ children }: { children: React.ReactNode }) {
  const { profile } = useUserProfile();
  const { aba } = useAbaMarketing();

  const grupos: GrupoDaArea[] = [
    {
      itens: ABAS_MARKETING.map((a) => ({
        id: a.id,
        rotulo: a.label,
        href: hrefDaAba(a.id),
        icone: a.icon,
        ativo: aba === a.id,
      })),
    },
  ];
  // Atalho só do gestor, num grupo à parte para não parecer mais uma seção.
  if (profile.cargo === "Gestor") {
    grupos.push({
      titulo: "Gestão",
      itens: [{ id: "gestor", rotulo: "Painel do gestor", href: "/gestor", icone: LayoutDashboard, ativo: false }],
    });
  }

  return (
    <AreaDeTrabalho nome="Central de Marketing" selo="MKT" inicio="/marketing" grupos={grupos}>
      {children}
    </AreaDeTrabalho>
  );
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingGuard>
      <RoleGuard papeisPermitidos={["Marketing", "Gestor"]}>
        {/* A seção aberta vem da URL (useSearchParams), que pede um Suspense em volta. */}
        <Suspense fallback={null}>
          <Casca>{children}</Casca>
        </Suspense>
      </RoleGuard>
    </OnboardingGuard>
  );
}
