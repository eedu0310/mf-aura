"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserProfile } from "@/lib/user-profile-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { isOnboarded, carregando } = useUserProfile();
  const router = useRouter();

  useEffect(() => {
    if (carregando) return;

    async function verificar() {
      const supabase = getSupabaseBrowserClient();
      
      if (!supabase) {
        // Sem Supabase, segue normalmente
        if (!isOnboarded) {
          router.replace("/onboarding");
        }
        return;
      }

      // Verificar se há sessão autenticada
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Sem sessão, ir para login
        router.replace("/login");
        return;
      }

      // Com sessão mas não onboarded, ir para onboarding
      if (!isOnboarded) {
        router.replace("/onboarding");
      }
    }

    verificar();
  }, [isOnboarded, carregando, router]);

  if (carregando || !isOnboarded) return null;

  return <>{children}</>;
}