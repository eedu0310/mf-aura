"use client";

import { useEffect, useState } from "react";
import { Menu, X, Home, FileText, Users, BarChart3, MessageCircle, Calendar, Filter, Trophy, Sparkles, ClipboardCheck, UserCircle, ChevronDown, Settings, Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUserProfile } from "@/lib/user-profile-context";
import { useAppData } from "@/lib/app-data-context";
import { computePendingTasks } from "@/lib/compute-pending-tasks";
import { menuDeGestao, menuDoCargo } from "@/lib/navegacao";
import { listarNotificacoes, marcarComoLida, type Notificacao } from "@/lib/supabase/notificacoes";

export function MobileNavbar() {
  const [aberto, setAberto] = useState(false);
  const [perfilAberto, setPerfilAberto] = useState(false);
  const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);
  const pathname = usePathname();
  const { profile } = useUserProfile();
  const { relacionamentos } = useAppData();
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

  // Avisos gravados pelo sistema (lead novo, lead sem resposta, pipeline).
  const [avisos, setAvisos] = useState<Notificacao[]>([]);
  useEffect(() => {
    let vivo = true;
    async function carregar() {
      const lista = await listarNotificacoes();
      if (vivo) setAvisos(lista.filter((a) => !a.lida));
    }
    void carregar();
    const t = setInterval(() => void carregar(), 60_000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);
  const totalAvisos = notificacoes.length + avisos.length;

  // O menu segue o cargo: um SDR não vê Pipeline, um pós-venda não vê Vendas.
  const links = [...menuDoCargo(profile.cargo), ...menuDeGestao(profile.cargo)];

  return (
    <>
      {/* Navbar */}
      <div className="fixed left-0 right-0 top-0 z-[70] bg-aura-navy-950 border-b border-aura-mist lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-white">AURA</h1>
          <div className="relative flex items-center gap-1">
            <button
              type="button"
              onClick={() => setNotificacoesAbertas((v) => !v)}
              aria-label="Notificações"
              className="relative p-2 text-white"
            >
              <Bell size={21} />
              {totalAvisos > 0 && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-aura-danger px-1 text-[10px] font-semibold text-white">{totalAvisos}</span>}
            </button>
            {notificacoesAbertas && <div className="absolute right-12 top-12 z-[80] w-72 overflow-hidden rounded-2xl border border-aura-mist bg-white shadow-xl">
              <p className="border-b border-aura-mist px-4 py-3 text-sm font-medium text-aura-graphite">Notificações</p>
              {totalAvisos === 0 ? <p className="px-4 py-6 text-center text-xs text-aura-graphite-soft">Nada pendente agora.</p> : <ul className="max-h-64 overflow-y-auto">{avisos.map((a) => <li key={a.id} className="border-b border-aura-mist last:border-0"><Link href={a.acaoUrl || "/meu-dia"} onClick={() => { setNotificacoesAbertas(false); setAvisos((atual) => atual.filter((x) => x.id !== a.id)); void marcarComoLida(a.id); }} className="block px-4 py-3 hover:bg-aura-bg"><p className="text-sm font-medium text-aura-graphite">{a.titulo}</p><p className="mt-1 text-xs text-aura-graphite-soft">{a.mensagem}</p></Link></li>)}{notificacoes.map((n) => <li key={n.id} className="border-b border-aura-mist last:border-0"><Link href={`/relacionamentos?buscar=${encodeURIComponent(n.titulo.split("· ")[1] ?? "")}`} onClick={() => setNotificacoesAbertas(false)} className="block px-4 py-3 hover:bg-aura-bg"><p className="text-sm font-medium text-aura-graphite">{n.titulo}</p><p className={`mt-1 text-xs ${n.urgente ? "text-aura-danger" : "text-aura-graphite-soft"}`}>{n.quando}</p></Link></li>)}</ul>}
            </div>}
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
          <div className="max-h-[calc(100vh-3.5rem)] overflow-y-auto bg-aura-navy-900 border-t border-aura-mist">
            <nav aria-label="Menu principal mobile" className="flex flex-col divide-y divide-aura-mist">
              <div className="border-b border-aura-mist px-4 py-3">
                <button type="button" onClick={() => setPerfilAberto((v) => !v)} aria-expanded={perfilAberto} className="flex w-full items-center gap-3 text-left text-white">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-aura-petrol-700 text-xs font-semibold">{profile.avatarIniciais || "??"}</span>
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
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Spacer para conteúdo não ficar sob navbar */}
      <div className="h-14 lg:h-0" />
    </>
  );
}
