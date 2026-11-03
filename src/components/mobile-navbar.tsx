"use client";

import { useEffect, useState } from "react";
import { Menu, X, Home, FileText, Users, BarChart3, MessageCircle, Calendar, Filter, Trophy, Sparkles, ClipboardCheck, UserCircle, ChevronDown, Settings, Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUserProfile } from "@/lib/user-profile-context";
import { AvatarUsuario } from "@/components/avatar-usuario";
import { comSiteMf, menuDeGestao, menuDoCargo } from "@/lib/navegacao";
import { usarMeuAcesso } from "@/lib/usar-permissoes";
import { useNaoLidasDoSite } from "@/components/site-mf/vigia-chat-site";
import { numeroDoSino, useSino } from "@/lib/use-sino";
import { PainelDoSino } from "@/components/notificacoes/painel-sino";

export function MobileNavbar() {
  const [aberto, setAberto] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);
  const pathname = usePathname();
  const { profile } = useUserProfile();
  const acesso = usarMeuAcesso();
  const naoLidasSite = useNaoLidasDoSite();
  const sino = useSino();

  // O menu segue o cargo: um SDR não vê Pipeline, um pós-venda não vê Vendas.
  const links = [...comSiteMf(menuDoCargo(profile.cargo), profile.empresa, acesso.gestorMestre), ...menuDeGestao(profile.cargo)];

  return (
    <>
      {/* Navbar */}
      <div
        data-imprimir="esconder"
        className="area-segura-topo fixed left-0 right-0 top-0 z-[70] bg-aura-navy-950 border-b border-aura-mist lg:hidden"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-white">AURA</h1>
          <div className="relative flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setNotificacoesAbertas((v) => !v);
                sino.abrir();
              }}
              aria-label="Notificações"
              className="relative p-2 text-white"
            >
              <Bell size={21} />
              {sino.numero > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-aura-danger px-1 text-[10px] font-semibold text-white">{numeroDoSino(sino.numero)}</span>}
            </button>
            {notificacoesAbertas && (
              <PainelDoSino
                sino={sino}
                aoFechar={() => setNotificacoesAbertas(false)}
                className="absolute right-12 top-12 z-[80] w-[min(20rem,calc(100vw-4rem))] overflow-hidden rounded-2xl border border-aura-mist bg-white shadow-xl"
              />
            )}
            <button
              type="button"
              onClick={() => setAberto(!aberto)}
              aria-label={aberto ? "Fechar menu" : "Abrir menu"}
              className="p-2 text-white"
            >
              {aberto ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Menu Drawer */}
        {aberto && (
          <div className="menu-mobile-rolagem overflow-y-auto bg-aura-navy-900 border-t border-aura-mist">
            <nav aria-label="Menu principal mobile" className="flex flex-col divide-y divide-aura-mist">
              <div className="border-b border-aura-mist px-4 py-3">
                <button type="button" onClick={() => setPerfilAberto((v) => !v)} aria-expanded={perfilAberto} className="flex w-full items-center gap-3 text-left text-white">
                  <AvatarUsuario foto={profile.fotoUrl} iniciais={profile.avatarIniciais} className="h-9 w-9 bg-aura-petrol-700 text-xs font-semibold" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{profile.nome || "Meu perfil"}</span><span className="block truncate text-xs text-white/60">{profile.cargo} · {profile.empresa}</span></span>
                  <ChevronDown size={18} className={`transition-transform ${perfilAberto ? "rotate-180" : ""}`} />
                </button>
                {perfilAberto && <div className="mt-2 space-y-1 rounded-xl bg-aura-navy-950/70 p-2">
                  <Link href="/configuracoes?editarPerfil=1" onClick={() => setAberto(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 hover:bg-white/10"><UserCircle size={18} /> Editar perfil</Link>
                  <Link href="/configuracoes" onClick={() => setAberto(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/80 hover:bg-white/10"><Settings size={18} /> Configurações</Link>
                </div>}
              </div>
              {links.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setAberto(false)}
                    className={`flex items-center gap-3 px-4 py-3 transition ${
                      isActive
                        ? "bg-aura-petrol-500 text-white"
                        : "text-white/70 hover:bg-aura-navy-950"
                    }`}
                  >
                    <Icon size={20} />
                    <span>{label}</span>
                    {href === "/site-mf" && naoLidasSite > 0 && (
                      <span className="ml-auto rounded-full bg-[#CD1C1B] px-2 py-0.5 text-xs font-semibold text-white">{naoLidasSite}</span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Spacer para conteúdo não ficar sob navbar */}
      <div className="altura-barra-mobile lg:h-0" />
    </>
  );
}
