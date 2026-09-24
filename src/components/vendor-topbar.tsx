"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, Bell, ChevronDown, Settings, LogOut, User } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { useAppData } from "@/lib/app-data-context";
import { computePendingTasks } from "@/lib/compute-pending-tasks";
import { saudacaoDoDia } from "@/lib/date-local";

export function VendorTopbar() {
  const router = useRouter();
  const { profile, clearProfile } = useUserProfile();
  const { relacionamentos } = useAppData();
  const nome = profile.nome;
  const cargo = `${profile.cargo} · ${profile.empresa}`;
  const avatarIniciais = profile.avatarIniciais;
  const [busca, setBusca] = useState("");
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);
  const [notificacoesLidas, setNotificacoesLidas] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const painelRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const todasNotificacoes = computePendingTasks(relacionamentos);
  // Respeita o interruptor "Follow-ups atrasados" das Configurações.
  const [avisarFollowUp, setAvisarFollowUp] = useState(true);
  useEffect(() => {
    try {
      setAvisarFollowUp(localStorage.getItem("aura:avisoFollowUp") !== "false");
    } catch {
      /* navegador sem armazenamento: mantém ligado */
    }
  }, []);
  const notificacoes = avisarFollowUp ? todasNotificacoes : [];
  const naoLidas = notificacoesLidas ? 0 : notificacoes.length;

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (painelRef.current && !painelRef.current.contains(e.target as Node)) {
        setNotificacoesAbertas(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAberto(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
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
    <header className="relative z-50 flex flex-col gap-4 border-b border-aura-mist bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-aura-graphite">
          {saudacaoDoDia()}, {nome}! 👋
        </h1>
        <p className="text-sm text-aura-graphite-soft">
          Vamos juntos fazer hoje ainda melhor que ontem.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <form onSubmit={buscar} className="relative hidden md:block">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-aura-graphite-soft"
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar relacionamento..."
            className="w-52 rounded-full border border-aura-mist bg-aura-bg py-2 pl-9 pr-4 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft focus:border-aura-petrol-500"
          />
        </form>

        <div ref={painelRef} className="relative hidden sm:block">
          <button
            type="button"
            onClick={() => {
              setNotificacoesAbertas((v) => !v);
              setNotificacoesLidas(true);
            }}
            aria-label="Notificações"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-aura-graphite-soft hover:bg-aura-bg hover:text-aura-graphite"
          >
            <Bell size={19} />
            {naoLidas > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-aura-danger text-[0.6rem] font-semibold text-white">
                {naoLidas}
              </span>
            )}
          </button>

          {notificacoesAbertas && (
            <div className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-2xl border border-aura-mist bg-white shadow-lg shadow-black/10">
              <p className="border-b border-aura-mist px-4 py-3 text-sm font-medium text-aura-graphite">
                Notificações
              </p>
              {notificacoes.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-aura-graphite-soft">
                  Nenhum follow-up pendente agora.
                </p>
              ) : (
                <ul className="max-h-72 overflow-y-auto">
                  {notificacoes.map((n) => (
                    <li key={n.id} className="border-b border-aura-mist last:border-b-0">
                      <Link
                        href={`/relacionamentos?buscar=${encodeURIComponent(n.titulo.split("· ")[1] ?? "")}`}
                        onClick={() => setNotificacoesAbertas(false)}
                        className="block px-4 py-3 hover:bg-aura-bg"
                      >
                        <p className="text-sm font-medium text-aura-graphite">{n.titulo}</p>
                        <p
                          className={`mt-1 text-xs font-medium ${
                            n.urgente ? "text-aura-danger" : "text-aura-graphite-soft"
                          }`}
                        >
                          {n.quando}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div ref={menuRef} className="relative hidden sm:block">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setMenuAberto((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setMenuAberto((v) => !v);
              }
            }}
            className="flex cursor-pointer items-center gap-2.5 rounded-full py-1 pl-1 pr-2 hover:bg-aura-bg"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-aura-petrol-700 font-display text-xs font-semibold text-white">
              {avatarIniciais}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-tight text-aura-graphite">
                {nome}
              </p>
              <p className="text-xs leading-tight text-aura-graphite-soft">{cargo}</p>
            </div>
            <ChevronDown size={15} className="text-aura-graphite-soft" />
          </div>

          {menuAberto && (
            <div className="absolute right-0 z-[60] mt-2 w-56 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-aura-mist bg-white py-1.5 shadow-lg shadow-black/10">
              <div className="border-b border-aura-mist px-4 py-2.5">
                <p className="text-sm font-medium text-aura-graphite">{nome}</p>
                <p className="text-xs text-aura-graphite-soft">{cargo}</p>
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
      </div>
    </header>
  );
}
