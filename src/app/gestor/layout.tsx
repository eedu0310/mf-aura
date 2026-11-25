"use client";

import { Suspense } from "react";
import { HeartHandshake, Megaphone } from "lucide-react";
import { OnboardingGuard } from "@/components/onboarding-guard";
import { RoleGuard } from "@/components/role-guard";
import { AreaDeTrabalho, type GrupoDaArea } from "@/components/area-de-trabalho";
import { useAbaGestor } from "@/components/gestor/areas";

/**
 * O Painel do Gestor é uma ÁREA DE TRABALHO (src/components/area-de-trabalho):
 * abre sozinho, com as seis áreas no menu, e o Voltar leva para onde o gestor
 * estava no CRM. Mesma casca do Pós-venda e do Marketing, que ficam no fim do
 * menu como atalhos.
 */
function Casca({ children }: { children: React.ReactNode }) {
  const { areaAtual, areasVisiveis, hrefDaArea } = useAbaGestor();

  const grupos: GrupoDaArea[] = [
    {
      itens: areasVisiveis.map((area) => ({
        id: area.id,
        rotulo: area.titulo,
        descricao: area.descricao,
        href: hrefDaArea(area.id),
        icone: area.icone,
        ativo: area.id === areaAtual.id,
      })),
    },
    {
      titulo: "Outras áreas",
      itens: [
        { id: "pos-venda", rotulo: "Pós-venda", href: "/pos-venda", icone: HeartHandshake, ativo: false },
        { id: "marketing", rotulo: "Central de Marketing", href: "/marketing", icone: Megaphone, ativo: false },
      ],
    },
  ];

  return (
    <AreaDeTrabalho nome="Painel do Gestor" selo="GESTOR" inicio="/gestor" grupos={grupos}>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </AreaDeTrabalho>
  );
}

export default function GestorLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingGuard>
      <RoleGuard papeisPermitidos={["Gestor"]}>
        {/* A aba aberta vem da URL (useSearchParams), que pede um Suspense em volta. */}
        <Suspense fallback={null}>
          <Casca>{children}</Casca>
        </Suspense>
      </RoleGuard>
    </OnboardingGuard>
  );
}
