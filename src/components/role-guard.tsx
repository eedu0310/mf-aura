"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserProfile } from "@/lib/user-profile-context";
import { rotaInicial } from "@/lib/rota-inicial";

function normalizar(texto?: string | null) {
  return (texto ?? "").trim().toLowerCase();
}

/**
 * Só libera o conteúdo se o cargo do usuário logado estiver na lista de
 * papéis permitidos. Caso contrário, manda ele de volta pra rota inicial
 * do próprio papel dele (não deixa acessar área de outro papel).
 */
export function RoleGuard({
  papeisPermitidos,
  children,
}: {
  papeisPermitidos: string[];
  children: React.ReactNode;
}) {
  const { profile, carregando } = useUserProfile();
  const router = useRouter();

  const permitidosNormalizados = papeisPermitidos.map(normalizar);
  const permitido = permitidosNormalizados.includes(normalizar(profile.cargo));

  useEffect(() => {
    if (!carregando && !permitido) {
      router.replace(rotaInicial(profile.cargo));
    }
  }, [carregando, permitido, profile.cargo, router]);

  if (carregando || !permitido) return null;

  return <>{children}</>;
}
