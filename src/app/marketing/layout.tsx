"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  ChevronDown,
  User,
  Settings,
  LogOut,
  LayoutGrid,
  UserPlus,
  Megaphone,
  Calendar,
  Table2,
} from "lucide-react";
import { OnboardingGuard } from "@/components/onboarding-guard";
import { RoleGuard } from "@/components/role-guard";
import { useUserProfile } from "@/lib/user-profile-context";
import { AvatarUsuario } from "@/components/avatar-usuario";
import { ABAS_MARKETING, AbaMarketingContext, type AbaMarketing, type AbaMarketingContextValue } from "@/components/marketing/aba-marketing";

function PerfilMenu() {
  const router = useRouter();
  const { profile, clearProfile } = useUserProfile();
  const [menuAberto, setMenuAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  async function sair() {
    if (saindo) return;
    setSaindo(true);
    setMenuAberto(false);
    await clearProfile();
    router.push("/login");
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuAberto((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-white/5"
      >
        <AvatarUsuario foto={profile.fotoUrl} iniciais={profile.avatarIniciais} className="h-8 w-8 bg-aura-gold font-display text-xs font-semibold text-aura-navy-950" />
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium leading-tight text-white">{profile.nome}</p>
          <p className="truncate text-xs leading-tight text-white/50">{profile.cargo}</p>
        </div>
        <ChevronDown size={14} className="shrink-0 text-white/50" />
      </button>

      {menuAberto && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-56 overflow-hidden rounded-2xl border border-aura-mist bg-white py-1.5 shadow-lg shadow-black/20">
          <div className="border-b border-aura-mist px-4 py-2.5">
            <p className="text-sm font-medium text-aura-graphite">{profile.nome}</p>
            <p className="text-xs text-aura-graphite-soft">
              {profile.cargo} · {profile.empresa}
            </p>
          </div>
          <Link
            href="/configuracoes"
            onClick={() => setMenuAberto(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-aura-graphite hover:bg-aura-bg"
          >
            <User size={15} />
            Meu perfil
          </Link>
          <Link
            href="/configuracoes"
            onClick={() => setMenuAberto(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-aura-graphite hover:bg-aura-bg"
          >
            <Settings size={15} />
            Configurações
          </Link>
          <button
            type="button"
            onClick={sair}
            disabled={saindo}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-aura-danger hover:bg-aura-danger/5 disabled:opacity-60"
          >
            <LogOut size={15} />
            {saindo ? "Saindo..." : "Sair da conta"}
          </button>
        </div>
      )}
    </div>
  );
}

function BarraLateral({ aba, setAba }: AbaMarketingContextValue) {
  return (
    <aside className="flex shrink-0 flex-row items-center gap-1 overflow-x-auto bg-aura-navy-950 px-4 py-3 sm:h-screen sm:w-60 sm:flex-col sm:items-stretch sm:justify-between sm:overflow-visible sm:px-4 sm:py-6">
      <div className="flex flex-row items-center gap-6 sm:flex-col sm:items-stretch sm:gap-8">
        <div className="hidden items-center gap-2 px-2.5 text-white sm:flex">
          <Sparkles size={18} className="text-aura-gold" />
          <span className="font-display text-sm font-semibold tracking-wide">
            AURA <span className="font-normal text-white/50">MKT</span>
          </span>
        </div>

        <nav className="flex flex-row gap-1 sm:flex-col">
          {ABAS_MARKETING.map((a) => {
            const Icon = a.icon;
            const ativo = aba === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAba(a.id)}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  ativo ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <Icon size={16} className={ativo ? "text-aura-gold" : ""} />
                <span className="whitespace-nowrap">{a.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="hidden sm:block">
        <PerfilMenu />
      </div>
    </aside>
  );
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [aba, setAba] = useState<AbaMarketing>("visao-geral");

  return (
    <OnboardingGuard>
      <RoleGuard papeisPermitidos={["Marketing", "Gestor"]}>
        <AbaMarketingContext.Provider value={{ aba, setAba }}>
          <div className="flex min-h-screen flex-col bg-aura-bg sm:flex-row-reverse">
            <BarraLateral aba={aba} setAba={setAba} />
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        </AbaMarketingContext.Provider>
      </RoleGuard>
    </OnboardingGuard>
  );
}
