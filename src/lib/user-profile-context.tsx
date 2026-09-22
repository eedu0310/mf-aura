"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export interface UserProfile {
  nome: string;
  empresa: string;
  cargo: string;
  avatarIniciais: string;
}

const PERFIL_VAZIO: UserProfile = {
  nome: "",
  empresa: "",
  cargo: "Vendedor",
  avatarIniciais: "",
};

interface UserProfileContextValue {
  profile: UserProfile;
  isOnboarded: boolean;
  carregando: boolean;
  setProfile: (nome: string, empresa: string, cargo?: string) => Promise<void>;
  clearProfile: () => Promise<void>;
}

function calcularIniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

function perfilDaSessao(session: {
  user?: {
    user_metadata?: Record<string, unknown> | null;
    email?: string | null;
  };
}): UserProfile {
  const metadata = session.user?.user_metadata ?? {};
  const nome = String(
    metadata.nome ||
      metadata.name ||
      metadata.full_name ||
      session.user?.email ||
      "",
  ).trim();
  const empresa = String(metadata.empresa || metadata.company || "").trim();
  const cargo = String(metadata.cargo || metadata.role || "Vendedor").trim();

  return {
    nome,
    empresa,
    cargo: cargo || "Vendedor",
    avatarIniciais: calcularIniciais(nome) || "??",
  };
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile>(PERFIL_VAZIO);
  const [carregando, setCarregando] = useState(true);

  async function setProfile(nome: string, empresa: string, cargo = "Vendedor") {
    const nomeLimpo = nome.trim();
    setProfileState({
      nome: nomeLimpo,
      empresa: empresa.trim(),
      cargo: cargo.trim() || "Vendedor",
      avatarIniciais: calcularIniciais(nomeLimpo) || "??",
    });

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ nome: nomeLimpo, empresa: empresa.trim(), cargo: cargo.trim() || "Vendedor" })
      .eq("id", user.id);
    if (error) throw error;
    await supabase.auth.updateUser({ data: { nome: nomeLimpo, empresa: empresa.trim(), cargo: cargo.trim() || "Vendedor" } });
  }

  async function clearProfile() {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error)
        console.warn("Não foi possível terminar a sessão:", error.message);
    }
    setProfileState(PERFIL_VAZIO);
  }

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    if (!supabase) {
      setCarregando(false);
      return;
    }

    const supabaseClient = supabase;
    let activo = true;

    async function restaurarSessao() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabaseClient.auth.getSession();

        if (sessionError) {
          console.warn(
            "Não foi possível restaurar a sessão:",
            sessionError.message,
          );
          return;
        }

        if (!session) {
          if (activo) setProfileState(PERFIL_VAZIO);
          return;
        }

        // Fallback imediato usando os metadados do utilizador autenticado.
        // Assim o layout não fica bloqueado se a tabela profiles tiver RLS incorreto.
        let perfilFinal = perfilDaSessao(session);

        try {
          const { data: perfilSalvo, error: perfilError } = await supabaseClient
            .from("profiles")
            .select("nome, empresa, cargo")
            .eq("id", session.user.id)
            .maybeSingle();

          if (perfilError) {
            console.warn(
              "Não foi possível ler o perfil público; usando os metadados da sessão:",
              perfilError.message,
            );
          } else if (perfilSalvo) {
            const nome = String(perfilSalvo.nome || perfilFinal.nome).trim();
            const empresa = String(
              perfilSalvo.empresa || perfilFinal.empresa,
            ).trim();
            const cargo = String(perfilSalvo.cargo || perfilFinal.cargo).trim();
            perfilFinal = {
              nome,
              empresa,
              cargo: cargo || "Vendedor",
              avatarIniciais: calcularIniciais(nome) || "??",
            };
          }
        } catch (perfilError) {
          console.warn(
            "Falha ao consultar profiles; usando a sessão:",
            perfilError,
          );
        }

        if (activo) setProfileState(perfilFinal);
      } catch (error) {
        console.error("Erro ao restaurar o perfil:", error);
        if (activo) setProfileState(PERFIL_VAZIO);
      } finally {
        if (activo) setCarregando(false);
      }
    }

    void restaurarSessao();

    const { data: listener } = supabaseClient.auth.onAuthStateChange(
      (evento, session) => {
        if (!activo) return;

        if (evento === "SIGNED_OUT" || !session) {
          setProfileState(PERFIL_VAZIO);
          setCarregando(false);
          return;
        }

        if (evento === "SIGNED_IN" || evento === "USER_UPDATED") {
          void restaurarSessao();
        }
      },
    );

    return () => {
      activo = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <UserProfileContext.Provider
      value={{
        profile,
        isOnboarded: profile.nome !== "" && profile.empresa !== "",
        carregando,
        setProfile,
        clearProfile,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const ctx = useContext(UserProfileContext);
  if (!ctx) {
    throw new Error(
      "useUserProfile deve ser usado dentro de <UserProfileProvider>",
    );
  }
  return ctx;
}
