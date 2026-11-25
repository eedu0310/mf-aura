"use client";

import { useEffect, useState } from "react";
import { Menu, X, UserCircle, Settings, Bell, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUserProfile } from "@/lib/user-profile-context";
import { AvatarUsuario } from "@/components/avatar-usuario";
import { AuraLogoFull } from "@/components/aura-logo";
import { SeletorTema } from "@/components/tema";
import { ITEM_COACH, ITEM_INSTAGRAM, comSiteMf, emSecoes, menuDeGestao, menuDoCargo } from "@/lib/navegacao";
import { usarMeuAcesso } from "@/lib/usar-permissoes";
import { useNaoLidasDoSite } from "@/components/site-mf/vigia-chat-site";
import { useLeadsPendentes } from "@/components/leads/aviso-leads-pendentes";
import { numeroDoSino, useSino } from "@/lib/use-sino";
import { PainelDoSino } from "@/components/notificacoes/painel-sino";

/**
 * Barra e gaveta do celular. Mesmo visual do menu lateral do computador, e os
 * mesmos itens: antes o celular não tinha Instagram nem AURA Coach, então a
 * vendedora interna que responde o Instagram não chegava na tela pelo
 * telefone (auditoria de 24/11/2026).
 */
export function MobileNavbar() {
  const [aberto, setAberto] = useState(false);
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { profile, clearProfile } = useUserProfile();
  const [saindo, setSaindo] = useState(false);
  const acesso = usarMeuAcesso();
  const naoLidasSite = useNaoLidasDoSite();
  const leadsPendentes = useLeadsPendentes().length;
  const sino = useSino();

  // O menu segue o cargo: um SDR não vê Pipeline, um pós-venda não vê Vendas.
  const principais = comSiteMf(menuDoCargo(profile.cargo), profile.empresa, acesso.gestorMestre);
  const gestao = menuDeGestao(profile.cargo);
  const podeInstagram = acesso.permissoes.usar_instagram || acesso.cargo === "Gestor";
  const secoes = emSecoes([...principais, ...(podeInstagram ? [ITEM_INSTAGRAM] : []), ITEM_COACH]);

  // Trocar de tela fecha a gaveta (inclusive pelo botão voltar do celular).
  useEffect(() => {
    setAberto(false);
  }, [pathname]);

  /**
   * No celular não havia "Sair": a barra de cima do computador (onde fica o
   * botão) some abaixo de lg, e a gaveta só tinha perfil e configurações. Quem
   * divide o aparelho precisava achar o botão no fim de Configurações.
   */
  async function sair() {
    if (saindo) return;
    setSaindo(true);
    setAberto(false);
    await clearProfile();
    router.push("/login");
  }

  const ativoEm = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const classe = (ativo: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.9rem] font-medium transition ${
      ativo ? "bg-aura-sunken text-aura-graphite" : "text-aura-graphite-soft active:bg-aura-sunken"
    }`;
  const icone = (ativo: boolean) => (ativo ? "text-aura-petrol-600" : "text-aura-graphite-soft");

  return (
    <>
      <div
        data-imprimir="esconder"
        className="area-segura-topo fixed left-0 right-0 top-0 z-[70] border-b border-aura-mist bg-aura-surface/90 backdrop-blur lg:hidden"
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/meu-dia" aria-label="Ir para o Meu Dia">
            <AuraLogoFull />
          </Link>
          <div className="relative flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setNotificacoesAbertas((v) => !v);
                sino.abrir();
              }}
              aria-label="Notificações"
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-aura-graphite-soft active:bg-aura-sunken"
            >
              <Bell size={20} />
              {sino.numero > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-aura-danger px-1 text-[10px] font-semibold text-white ring-2 ring-aura-surface">
                  {numeroDoSino(sino.numero)}
                </span>
              )}
            </button>
            {notificacoesAbertas && (
              <PainelDoSino
                sino={sino}
                aoFechar={() => setNotificacoesAbertas(false)}
                className="absolute right-10 top-12 z-[80] w-[min(20rem,calc(100vw-4rem))] overflow-hidden rounded-xl border border-aura-mist bg-aura-surface shadow-xl"
              />
            )}
            <button
              type="button"
              onClick={() => setAberto(!aberto)}
              aria-label={aberto ? "Fechar menu" : "Abrir menu"}
              aria-expanded={aberto}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg text-aura-graphite active:bg-aura-sunken"
            >
              {aberto ? <X size={22} /> : <Menu size={22} />}
              {!aberto && leadsPendentes > 0 && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-aura-danger ring-2 ring-aura-surface" />}
            </button>
          </div>
        </div>

        {aberto && (
          // Tocar em qualquer link fecha a gaveta. Só o efeito do pathname não
          // basta: tocar na tela em que já se está (ou em "Editar perfil" estando
          // em Configurações) não muda o caminho e a gaveta ficava aberta.
          <div
            className="menu-mobile-rolagem overflow-y-auto border-t border-aura-mist bg-aura-surface"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setAberto(false);
            }}
          >
            <div className="border-b border-aura-mist px-4 py-3">
              <div className="flex items-center gap-3">
                <AvatarUsuario
                  foto={profile.fotoUrl}
                  iniciais={profile.avatarIniciais}
                  className="h-10 w-10 bg-aura-petrol-600 text-xs font-semibold text-white"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-aura-graphite">{profile.nome || "Meu perfil"}</span>
                  <span className="block truncate text-xs text-aura-graphite-soft">
                    {profile.cargo} · {profile.empresa}
                  </span>
                </span>
              </div>
              <div className="mt-3">
                <SeletorTema compacto />
              </div>
            </div>

            {/* Mesmas seções da barra do computador (src/lib/navegacao.ts). */}
            <div className="p-2">
              {secoes.map((secao) => (
                <nav key={secao.id} aria-label={secao.titulo || "Início"} className="flex flex-col gap-0.5">
                  {secao.titulo && (
                    <p className="px-3 pb-1 pt-3 text-[0.68rem] font-medium uppercase tracking-wider text-aura-graphite-soft">
                      {secao.titulo}
                    </p>
                  )}
                  {secao.itens.map(({ href, label, icon: Icon }) => {
                    const ativo = ativoEm(href);
                    const coach = href === ITEM_COACH.href;
                    return (
                      <Link key={href} href={href} className={classe(ativo)} aria-current={ativo ? "page" : undefined}>
                        <Icon size={19} className={coach ? "text-aura-gold" : icone(ativo)} />
                        <span>{label}</span>
                        {href === "/site-mf" && naoLidasSite > 0 && (
                          <span className="ml-auto rounded-full bg-aura-danger px-2 py-0.5 text-xs font-semibold text-white">{naoLidasSite}</span>
                        )}
                        {href === "/leads" && leadsPendentes > 0 && (
                          <span className="ml-auto rounded-full bg-aura-danger px-2 py-0.5 text-xs font-semibold text-white">{leadsPendentes}</span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              ))}
            </div>

            {gestao.length > 0 && (
              <nav aria-label="Gestão" className="flex flex-col gap-0.5 border-t border-aura-mist p-2">
                <p className="px-3 pb-1 pt-2 text-[0.68rem] font-medium uppercase tracking-wider text-aura-graphite-soft">Gestão</p>
                {gestao.map(({ href, label, icon: Icon }) => {
                  const ativo = ativoEm(href);
                  return (
                    <Link key={href} href={href} className={classe(ativo)}>
                      <Icon size={19} className={icone(ativo)} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </nav>
            )}

            <nav aria-label="Conta" className="flex flex-col gap-0.5 border-t border-aura-mist p-2">
              <Link href="/configuracoes?editarPerfil=1" className={classe(false)}>
                <UserCircle size={19} className="text-aura-graphite-soft" />
                <span>Editar perfil</span>
              </Link>
              <Link href="/configuracoes" className={classe(ativoEm("/configuracoes"))}>
                <Settings size={19} className={icone(ativoEm("/configuracoes"))} />
                <span>Configurações</span>
              </Link>
              <button
                type="button"
                onClick={sair}
                disabled={saindo}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[0.9rem] font-medium text-aura-danger transition active:bg-aura-danger/5 disabled:opacity-60"
              >
                <LogOut size={19} />
                <span>{saindo ? "Saindo..." : "Sair da conta"}</span>
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Espaço para o conteúdo não ficar debaixo da barra */}
      <div className="altura-barra-mobile lg:h-0" />
    </>
  );
}
