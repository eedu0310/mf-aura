"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { AuraLogoFull } from "@/components/aura-logo";
import { AvatarUsuario } from "@/components/avatar-usuario";
import { useUserProfile } from "@/lib/user-profile-context";
import { ITEM_COACH, ITEM_INSTAGRAM, comSiteMf, emSecoes, menuDeGestao, menuDoCargo } from "@/lib/navegacao";
import { usarMeuAcesso } from "@/lib/usar-permissoes";
import { useNaoLidasDoSite } from "@/components/site-mf/vigia-chat-site";

/**
 * Menu lateral: claro e silencioso, no padrão dos CRMs de alto padrão.
 * O item ativo ganha fundo afundado e ícone na cor da marca; o resto fica em
 * cinza. Itens agrupados por assunto (seções de src/lib/navegacao.ts), e a
 * gestão por último, só para o gestor.
 */
export function VendorSidebar() {
  const pathname = usePathname();
  const { profile } = useUserProfile();

  const acesso = usarMeuAcesso();
  // O Instagram nao e do cargo, e da pessoa: em cada loja so o vendedor
  // interno responde. Quem manda de verdade e a rota, que confere no
  // servidor; aqui so evitamos mostrar um caminho que vai recusar.
  const podeInstagram = acesso.permissoes.usar_instagram || acesso.cargo === "Gestor";
  const itensNav = comSiteMf(menuDoCargo(profile.cargo), profile.empresa, acesso.gestorMestre);
  const secoes = emSecoes([...itensNav, ...(podeInstagram ? [ITEM_INSTAGRAM] : []), ITEM_COACH]);
  const itensGestao = menuDeGestao(profile.cargo);
  const naoLidasSite = useNaoLidasDoSite();

  const ativoEm = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const classe = (ativo: boolean) =>
    `group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[0.8125rem] font-medium transition ${
      ativo
        ? "bg-aura-sunken text-aura-graphite"
        : "text-aura-graphite-soft hover:bg-aura-sunken/70 hover:text-aura-graphite"
    }`;
  const classeIcone = (ativo: boolean) =>
    ativo ? "text-aura-petrol-600" : "text-aura-graphite-soft group-hover:text-aura-graphite";

  return (
    <aside
      data-imprimir="esconder"
      className="hidden w-60 shrink-0 flex-col border-r border-aura-mist bg-aura-surface lg:sticky lg:top-0 lg:flex lg:h-dvh"
    >
      <div className="flex h-14 items-center px-4">
        <Link href="/meu-dia" aria-label="Ir para o Meu Dia">
          <AuraLogoFull />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 pb-4">
        {secoes.map((secao) => (
          <div key={secao.id}>
            {secao.titulo && (
              <p className="px-2.5 pb-1 pt-4 text-[0.68rem] font-medium uppercase tracking-wider text-aura-graphite-soft/80">
                {secao.titulo}
              </p>
            )}
            <nav className={`flex flex-col gap-0.5 ${secao.titulo ? "" : "pt-2"}`} aria-label={secao.titulo || "Início"}>
              {secao.itens.map((item) => {
                const ativo = ativoEm(item.href);
                const Icon = item.icon;
                const coach = item.href === ITEM_COACH.href;
                return (
                  <Link key={item.href} href={item.href} className={classe(ativo)} aria-current={ativo ? "page" : undefined}>
                    <Icon size={17} strokeWidth={1.9} className={coach ? "text-aura-gold" : classeIcone(ativo)} />
                    {item.label}
                    {item.href === "/site-mf" && naoLidasSite > 0 && (
                      <span className="ml-auto rounded-full bg-aura-danger px-1.5 py-px text-[0.65rem] font-semibold text-white">
                        {naoLidasSite}
                      </span>
                    )}
                    {coach && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-aura-success" aria-label="ativa" />}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}

        {/* Só o gestor enxerga as outras áreas */}
        {itensGestao.length > 0 && (
          <>
            <p className="px-2.5 pb-1 pt-4 text-[0.68rem] font-medium uppercase tracking-wider text-aura-graphite-soft/80">
              Gestão
            </p>
            <nav className="flex flex-col gap-0.5" aria-label="Gestão">
              {itensGestao.map((item) => {
                const Icon = item.icon;
                const ativo = ativoEm(item.href);
                return (
                  <Link key={item.href} href={item.href} className={classe(ativo)}>
                    <Icon size={17} strokeWidth={1.9} className={classeIcone(ativo)} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </>
        )}
      </div>

      {/*
        Rodapé: a pessoa e as configurações. O seletor de tema saiu daqui: ele
        já está no topo (botão de lua/sol e no menu do perfil), e aqui estourava
        a largura da barra.
      */}
      <div className="flex items-center gap-1 border-t border-aura-mist p-3">
        <Link
          href="/configuracoes"
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition hover:bg-aura-sunken"
        >
          <AvatarUsuario
            foto={profile.fotoUrl}
            iniciais={profile.avatarIniciais}
            className="h-8 w-8 bg-aura-petrol-600 text-xs font-semibold text-white"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.8125rem] font-medium text-aura-graphite">{profile.nome}</span>
            <span className="block truncate text-xs text-aura-graphite-soft">{profile.empresa}</span>
          </span>
        </Link>
        <Link
          href="/configuracoes"
          aria-label="Configurações"
          title="Configurações"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition hover:bg-aura-sunken ${
            ativoEm("/configuracoes") ? "text-aura-petrol-600" : "text-aura-graphite-soft hover:text-aura-graphite"
          }`}
        >
          <Settings size={17} strokeWidth={1.9} />
        </Link>
      </div>
    </aside>
  );
}
