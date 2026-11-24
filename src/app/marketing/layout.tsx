"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronUp, User, Settings, LogOut } from "lucide-react";
import { OnboardingGuard } from "@/components/onboarding-guard";
import { RoleGuard } from "@/components/role-guard";
import { useUserProfile } from "@/lib/user-profile-context";
import { AvatarUsuario } from "@/components/avatar-usuario";
import { AuraLogoFull } from "@/components/aura-logo";
import { BotaoTema, SeletorTema } from "@/components/tema";
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
        aria-expanded={menuAberto}
        className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition hover:bg-aura-sunken"
      >
        <AvatarUsuario foto={profile.fotoUrl} iniciais={profile.avatarIniciais} className="h-8 w-8 bg-aura-petrol-600 text-xs font-semibold text-white" />
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-[0.8125rem] font-medium leading-tight text-aura-graphite">{profile.nome}</p>
          <p className="truncate text-xs leading-tight text-aura-graphite-soft">{profile.cargo}</p>
        </div>
        <ChevronUp size={14} className="shrink-0 text-aura-graphite-soft" />
      </button>

      {menuAberto && (
        <div className="aura-card absolute bottom-full left-0 z-30 mb-2 w-56 overflow-hidden py-1.5 shadow-xl">
          <div className="border-b border-aura-mist px-4 py-2.5">
            <p className="text-sm font-medium text-aura-graphite">{profile.nome}</p>
            <p className="text-xs text-aura-graphite-soft">
              {profile.cargo} · {profile.empresa}
            </p>
          </div>
          <Link
            href="/configuracoes"
            onClick={() => setMenuAberto(false)}
            className="flex items-center gap-2.5 px-4 py-2 text-[0.8125rem] text-aura-graphite transition hover:bg-aura-sunken"
          >
            <User size={15} className="text-aura-graphite-soft" />
            Meu perfil
          </Link>
          <Link
            href="/configuracoes"
            onClick={() => setMenuAberto(false)}
            className="flex items-center gap-2.5 px-4 py-2 text-[0.8125rem] text-aura-graphite transition hover:bg-aura-sunken"
          >
            <Settings size={15} className="text-aura-graphite-soft" />
            Configurações
          </Link>
          <button
            type="button"
            onClick={sair}
            disabled={saindo}
            className="flex w-full items-center gap-2.5 border-t border-aura-mist px-4 py-2 text-left text-[0.8125rem] text-aura-danger transition hover:bg-aura-danger/5 disabled:opacity-60"
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
    <aside className="flex shrink-0 flex-col border-b border-aura-mist bg-aura-surface sm:sticky sm:top-0 sm:h-dvh sm:w-60 sm:border-b-0 sm:border-r">
      <div className="flex h-14 items-center justify-between gap-2 px-4">
        <Link href="/marketing" aria-label="Central de Marketing" className="flex items-center gap-2">
          <AuraLogoFull />
          <span className="aura-selo aura-selo-neutro">MKT</span>
        </Link>
        <BotaoTema className="sm:hidden" />
      </div>

      <div className="overflow-x-auto px-2.5 pb-2.5 sm:flex-1 sm:overflow-y-auto sm:pb-4">
        <p className="hidden px-2.5 pb-1.5 pt-3 text-[0.68rem] font-medium uppercase tracking-wider text-aura-graphite-soft/80 sm:block">
          Marketing
        </p>
        <nav className="flex flex-row gap-0.5 sm:flex-col" aria-label="Marketing">
          {ABAS_MARKETING.map((a) => {
            const Icon = a.icon;
            const ativo = aba === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAba(a.id)}
                aria-current={ativo ? "page" : undefined}
                className={`group flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[0.8125rem] font-medium transition ${
                  ativo
                    ? "bg-aura-sunken text-aura-graphite"
                    : "text-aura-graphite-soft hover:bg-aura-sunken/70 hover:text-aura-graphite"
                }`}
              >
                <Icon
                  size={17}
                  strokeWidth={1.9}
                  className={ativo ? "text-aura-petrol-600" : "text-aura-graphite-soft group-hover:text-aura-graphite"}
                />
                <span className="whitespace-nowrap">{a.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="hidden border-t border-aura-mist p-3 sm:block">
        <SeletorTema compacto />
        <div className="mt-2.5">
          <PerfilMenu />
        </div>
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
          <div className="flex min-h-screen flex-col bg-aura-bg sm:flex-row">
            <BarraLateral aba={aba} setAba={setAba} />
            <div className="min-w-0 flex-1">{children}</div>
          </div>
        </AbaMarketingContext.Provider>
      </RoleGuard>
    </OnboardingGuard>
  );
}
