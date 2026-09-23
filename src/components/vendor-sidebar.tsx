"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Settings } from "lucide-react";
import { AuraLogoFull } from "@/components/aura-logo";
import { useUserProfile } from "@/lib/user-profile-context";
import { menuDeGestao, menuDoCargo } from "@/lib/navegacao";

export function VendorSidebar() {
  const pathname = usePathname();
  const { profile } = useUserProfile();

  const itensNav = menuDoCargo(profile.cargo);
  const itensGestao = menuDeGestao(profile.cargo);

  const classe = (ativo: boolean) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
      ativo ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/5 hover:text-white/90"
    }`;

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-aura-navy-950 px-4 py-6 lg:flex">
      <div className="px-2">
        <AuraLogoFull />
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {itensNav.map((item) => {
          const ativo = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={classe(ativo)}>
              <Icon size={18} strokeWidth={ativo ? 2.25 : 1.75} />
              {item.label}
            </Link>
          );
        })}

        <Link href="/aura-coach" className={`mt-1 ${classe(pathname === "/aura-coach")}`}>
          <Sparkles size={18} strokeWidth={1.75} className="text-aura-gold" />
          AURA Coach
          <span className="ml-auto rounded-full bg-aura-gold/15 px-2 py-0.5 text-[0.6rem] font-semibold tracking-wide text-aura-gold">
            ATIVA
          </span>
        </Link>

        <Link href="/configuracoes" className={classe(pathname === "/configuracoes")}>
          <Settings size={18} strokeWidth={1.75} />
          Configurações
        </Link>
      </nav>

      {/* Só O Gestor enxergam as outras áreas */}
      {itensGestao.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="mb-2 px-3 text-[0.65rem] font-semibold uppercase tracking-wide text-white/35">
            Supervisão
          </p>
          {itensGestao.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="mb-2 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-xs font-medium text-white/60 transition hover:border-white/20 hover:text-white"
              >
                <Icon size={14} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </aside>
  );
}
