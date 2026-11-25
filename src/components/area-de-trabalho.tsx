"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronUp, LogOut, Settings, User, type LucideIcon } from "lucide-react";
import { AuraLogoFull } from "@/components/aura-logo";
import { AvatarUsuario } from "@/components/avatar-usuario";
import { BotaoTema, SeletorTema } from "@/components/tema";
import { useUserProfile } from "@/lib/user-profile-context";
import { paginaDeVolta } from "@/lib/voltar-crm";

/**
 * Casca das ÁREAS DE TRABALHO: Pós-venda, Central de Marketing e Painel do
 * Gestor.
 *
 * Cada uma abre sozinha, com o próprio menu, sem o menu do CRM (Leads,
 * Relacionamentos, Pipeline...) do lado — pedido do Elton (25/11): "abre só o
 * pós-venda, e clica para voltar". As três usam esta mesma casca, então a
 * pessoa aprende uma vez: marca + Voltar em cima, seções no meio, ela embaixo.
 *
 * O Voltar leva para a última tela do CRM em que a pessoa estava
 * (src/lib/voltar-crm.ts), não sempre para o Meu Dia.
 */

export interface ItemDaArea {
  id: string;
  rotulo: string;
  href: string;
  icone: LucideIcon;
  ativo: boolean;
  /** Uma linha de explicação embaixo do rótulo (o gestor usa nas áreas). */
  descricao?: string;
  /** Número pequeno à direita (pendências). */
  contador?: number;
}

export interface GrupoDaArea {
  titulo?: string;
  itens: ItemDaArea[];
}

function PerfilMenu() {
  const router = useRouter();
  const { profile, clearProfile } = useUserProfile();
  const [aberto, setAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  async function sair() {
    if (saindo) return;
    setSaindo(true);
    setAberto(false);
    await clearProfile();
    router.push("/login");
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition hover:bg-aura-sunken"
      >
        <AvatarUsuario
          foto={profile.fotoUrl}
          iniciais={profile.avatarIniciais}
          className="h-8 w-8 bg-aura-petrol-600 text-xs font-semibold text-white"
        />
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[0.8125rem] font-medium leading-tight text-aura-graphite">{profile.nome}</span>
          <span className="block truncate text-xs leading-tight text-aura-graphite-soft">
            {profile.cargo} · {profile.empresa}
          </span>
        </span>
        <ChevronUp size={14} className="shrink-0 text-aura-graphite-soft" />
      </button>

      {aberto && (
        <div className="aura-card absolute bottom-full left-0 z-30 mb-2 w-60 overflow-hidden py-1.5 shadow-xl">
          <div className="px-3 pb-2 pt-1">
            <SeletorTema compacto />
          </div>
          <Link
            href="/configuracoes?editarPerfil=1"
            onClick={() => setAberto(false)}
            className="flex items-center gap-2.5 border-t border-aura-mist px-4 py-2 text-[0.8125rem] text-aura-graphite transition hover:bg-aura-sunken"
          >
            <User size={15} className="text-aura-graphite-soft" />
            Meu perfil
          </Link>
          <Link
            href="/configuracoes"
            onClick={() => setAberto(false)}
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

/** Botão Voltar: o destino é lido no navegador (sessionStorage) depois de montar. */
function BotaoVoltar({ className, compacto = false }: { className: string; compacto?: boolean }) {
  const [destino, setDestino] = useState("/meu-dia");
  useEffect(() => setDestino(paginaDeVolta()), []);
  return (
    <Link href={destino} className={className} title="Voltar para onde você estava no CRM">
      <ArrowLeft size={compacto ? 15 : 16} strokeWidth={1.9} />
      {compacto ? "Voltar" : "Voltar ao CRM"}
    </Link>
  );
}

export function AreaDeTrabalho({
  nome,
  selo,
  inicio,
  grupos,
  children,
}: {
  /** Nome da área, mostrado acima das seções ("Pós-venda"). */
  nome: string;
  /** Selo curto ao lado da marca ("PÓS", "MKT", "GESTOR"). */
  selo: string;
  /** Endereço da primeira tela da área (clique na marca). */
  inicio: string;
  grupos: GrupoDaArea[];
  children: ReactNode;
}) {
  const todos = grupos.flatMap((g) => g.itens);

  return (
    <div className="flex min-h-screen flex-col bg-aura-bg lg:flex-row">
      {/* Computador: coluna fixa à esquerda. */}
      <aside data-menu className="hidden w-64 shrink-0 flex-col border-r border-aura-mist bg-aura-surface lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <div className="flex h-14 items-center gap-2 px-4">
          <Link href={inicio} aria-label={nome} className="flex items-center gap-2">
            <AuraLogoFull />
            <span className="aura-selo aura-selo-marca">{selo}</span>
          </Link>
        </div>

        <div className="px-2.5">
          <BotaoVoltar className="group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[0.8125rem] font-medium text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-graphite" />
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 pb-4">
          <p className="px-2.5 pb-1.5 pt-4 text-sm font-semibold text-aura-graphite">{nome}</p>
          {grupos.map((grupo, i) => (
            <div key={grupo.titulo ?? i}>
              {grupo.titulo && (
                <p className="px-2.5 pb-1 pt-4 text-[0.68rem] font-medium uppercase tracking-wider text-aura-graphite-soft/80">
                  {grupo.titulo}
                </p>
              )}
              <nav className="flex flex-col gap-0.5" aria-label={grupo.titulo ?? nome}>
                {grupo.itens.map((item) => {
                  const Icone = item.icone;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      aria-current={item.ativo ? "page" : undefined}
                      className={`group flex items-start gap-2.5 rounded-lg px-2.5 py-[7px] text-[0.8125rem] font-medium transition ${
                        item.ativo
                          ? "bg-aura-sunken text-aura-graphite"
                          : "text-aura-graphite-soft hover:bg-aura-sunken/70 hover:text-aura-graphite"
                      }`}
                    >
                      <Icone
                        size={17}
                        strokeWidth={1.9}
                        className={`mt-px shrink-0 ${
                          item.ativo ? "text-aura-petrol-600" : "text-aura-graphite-soft group-hover:text-aura-graphite"
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block">{item.rotulo}</span>
                        {item.descricao && (
                          <span className="mt-0.5 block text-xs font-normal leading-snug text-aura-graphite-soft">
                            {item.descricao}
                          </span>
                        )}
                      </span>
                      {item.contador ? (
                        <span className="ml-auto rounded-full bg-aura-danger/10 px-1.5 py-px text-[0.68rem] font-semibold text-aura-danger">
                          {item.contador}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="border-t border-aura-mist p-3">
          <PerfilMenu />
        </div>
      </aside>

      {/* Celular: barra com marca, Voltar e tema, e as seções numa faixa que rola de lado. */}
      <div className="area-segura-topo sticky top-0 z-40 border-b border-aura-mist bg-aura-surface/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <Link href={inicio} aria-label={nome} className="flex min-w-0 items-center gap-2">
            <AuraLogoFull compacto />
            <span className="truncate text-sm font-semibold text-aura-graphite">{nome}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <BotaoVoltar
              compacto
              className="flex h-9 items-center gap-1.5 rounded-lg border border-aura-mist px-2.5 text-xs font-medium text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-graphite"
            />
            <BotaoTema />
          </div>
        </div>
        <nav className="flex gap-1.5 overflow-x-auto px-4 pb-2.5" aria-label={nome}>
          {todos.map((item) => {
            const Icone = item.icone;
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={item.ativo ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[0.8125rem] font-medium transition ${
                  item.ativo
                    ? "border-aura-petrol-600 bg-aura-petrol-600 text-white"
                    : "border-aura-mist bg-aura-surface text-aura-graphite-soft"
                }`}
              >
                <Icone size={14} />
                {item.rotulo}
                {item.contador ? <span className="text-[0.68rem] font-semibold opacity-80">· {item.contador}</span> : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
