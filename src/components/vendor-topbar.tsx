"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Bell, ChevronDown, Settings, LogOut, User } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { AvatarUsuario } from "@/components/avatar-usuario";
import { saudacaoDoDia } from "@/lib/date-local";
import { numeroDoSino, useSino } from "@/lib/use-sino";
import { PainelDoSino } from "@/components/notificacoes/painel-sino";
import { BotaoTema, SeletorTema } from "@/components/tema";

/**
 * Barra do topo: uma linha só, da altura do logo do menu lateral.
 * Saudação à esquerda; busca (atalho Ctrl/⌘ K), tema, sino e perfil à direita.
 */
export function VendorTopbar() {
  const router = useRouter();
  const { profile, clearProfile } = useUserProfile();
  const nome = profile.nome;
  const primeiroNome = (nome ?? "").split(" ")[0];
  const cargo = `${profile.cargo} · ${profile.empresa}`;
  const avatarIniciais = profile.avatarIniciais;
  const [busca, setBusca] = useState("");
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const painelRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  const sino = useSino();

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (painelRef.current && !painelRef.current.contains(e.target as Node)) {
        setNotificacoesAbertas(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAberto(false);
      }
    }
    // Ctrl/⌘ K leva direto para a busca, como nos CRMs que a equipe já conhece.
    function atalho(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        buscaRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", atalho);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", atalho);
    };
  }, []);

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    if (!busca.trim()) return;
    router.push(`/relacionamentos?buscar=${encodeURIComponent(busca.trim())}`);
  }

  async function sair() {
    if (saindo) return;
    setSaindo(true);
    setMenuAberto(false);
    await clearProfile();
    router.push("/login");
  }

  return (
    <header
      data-imprimir="esconder"
      className="relative z-50 hidden h-14 items-center justify-between gap-4 border-b border-aura-mist bg-aura-surface/80 px-6 backdrop-blur lg:flex"
    >
      <p className="truncate text-sm text-aura-graphite-soft">
        {saudacaoDoDia()}, <span className="font-medium text-aura-graphite">{primeiroNome}</span>
      </p>

      <div className="flex items-center gap-1.5">
        <form onSubmit={buscar} className="relative mr-1.5">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-aura-graphite-soft"
          />
          <input
            ref={buscaRef}
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente"
            aria-label="Buscar cliente"
            className="h-9 w-64 rounded-lg border border-aura-mist bg-aura-bg pl-8 pr-14 text-sm text-aura-graphite outline-none transition placeholder:text-aura-graphite-soft focus:border-aura-petrol-500 focus:bg-aura-surface focus:ring-2 focus:ring-aura-petrol-500/15"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-aura-mist bg-aura-surface px-1.5 py-px font-sans text-[0.65rem] text-aura-graphite-soft">
            Ctrl K
          </kbd>
        </form>

        <BotaoTema />

        <div ref={painelRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setNotificacoesAbertas((v) => !v);
              sino.abrir();
            }}
            aria-label="Notificações"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-graphite"
          >
            <Bell size={17} />
            {sino.numero > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-aura-danger px-1 text-[0.6rem] font-semibold text-white ring-2 ring-aura-surface">
                {numeroDoSino(sino.numero)}
              </span>
            )}
          </button>

          {notificacoesAbertas && (
            <PainelDoSino
              sino={sino}
              aoFechar={() => setNotificacoesAbertas(false)}
              className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-aura-mist bg-aura-surface shadow-lg"
            />
          )}
        </div>

        <div ref={menuRef} className="relative ml-1">
          <button
            type="button"
            onClick={() => setMenuAberto((v) => !v)}
            aria-expanded={menuAberto}
            aria-haspopup="menu"
            className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition hover:bg-aura-sunken"
          >
            <AvatarUsuario foto={profile.fotoUrl} iniciais={avatarIniciais} className="h-7 w-7 bg-aura-petrol-600 text-[0.65rem] font-semibold text-white" />
            <ChevronDown size={14} className="text-aura-graphite-soft" />
          </button>

          {menuAberto && (
            <div
              role="menu"
              className="absolute right-0 z-[60] mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-aura-mist bg-aura-surface py-1.5 shadow-lg"
            >
              <div className="border-b border-aura-mist px-3.5 pb-3 pt-2">
                <p className="truncate text-sm font-medium text-aura-graphite">{nome}</p>
                <p className="truncate text-xs text-aura-graphite-soft">{cargo}</p>
              </div>
              <div className="border-b border-aura-mist px-3 py-2.5">
                <p className="mb-1.5 text-[0.68rem] font-medium uppercase tracking-wider text-aura-graphite-soft">Tema</p>
                <SeletorTema compacto />
              </div>
              <div className="py-1">
                <Link
                  href="/configuracoes?editarPerfil=1"
                  role="menuitem"
                  onClick={() => setMenuAberto(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-aura-graphite hover:bg-aura-sunken"
                >
                  <User size={15} className="text-aura-graphite-soft" />
                  Meu perfil
                </Link>
                <Link
                  href="/configuracoes"
                  role="menuitem"
                  onClick={() => setMenuAberto(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-aura-graphite hover:bg-aura-sunken"
                >
                  <Settings size={15} className="text-aura-graphite-soft" />
                  Configurações
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={sair}
                  disabled={saindo}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-aura-danger hover:bg-aura-danger/5 disabled:opacity-60"
                >
                  <LogOut size={15} />
                  {saindo ? "Saindo…" : "Sair da conta"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
