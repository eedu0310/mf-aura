"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserProfile } from "@/lib/user-profile-context";
import { rotaInicial } from "@/lib/rota-inicial";

export function OnboardingRedirectGuard({ children }: { children: React.ReactNode }) {
  const { isOnboarded, carregando, profile } = useUserProfile();
  const router = useRouter();

  useEffect(() => {
    if (!carregando && isOnboarded) {
      router.replace(rotaInicial(profile.cargo));
    }
  }, [isOnboarded, carregando, profile.cargo, router]);

  if (carregando || isOnboarded) return null;

  return <>{children}</>;
}
