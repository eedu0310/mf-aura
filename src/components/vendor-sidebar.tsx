"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  Users,
  Filter,
  ShoppingBag,
  ClipboardCheck,
  Trophy,
  GraduationCap,
  Sparkles,
  Settings,
  LayoutDashboard,
  Link2,
  Wrench,
  Activity,
  UserPlus,
  FileText,
  Megaphone,
  MessageCircle,
} from "lucide-react";
import { AuraLogoFull } from "@/components/aura-logo";
import { useUserProfile } from "@/lib/user-profile-context";

const ITENS_NAV_VENDEDOR = [
  { href: "/meu-dia", label: "Meu Dia", icon: Home },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/relacionamentos", label: "Relacionamentos", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: Filter },
  { href: "/vendas", label: "Vendas", icon: ShoppingBag },
  { href: "/registrar-atividade", label: "Atividades", icon: ClipboardCheck },
  { href: "/relatorios", label: "Relatórios", icon: FileText },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/academy", label: "Academy", icon: GraduationCap },
  { href: "/area-vendedor", label: "Área do Vendedor", icon: Link2 },
];

const ITENS_NAV_POS_VENDA = [
  { href: "/pos-venda", label: "Pós-venda", icon: Wrench },
  { href: "/registrar-atividade", label: "Registrar Atividade", icon: ClipboardCheck },
  { href: "/atividades", label: "Atividades", icon: Activity },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
];

const ITENS_NAV_SDR = [
  { href: "/leads", label: "Leads Recebidos", icon: UserPlus },
  { href: "/registrar-atividade", label: "Registrar Atividade", icon: ClipboardCheck },
  { href: "/atividades", label: "Atividades", icon: Activity },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
];

const ITENS_NAV_VENDEDOR_INTERNO = [
  { href: "/leads", label: "Leads", icon: UserPlus },
  { href: "/relacionamentos", label: "Atendimento", icon: Users },
  { href: "/vendas", label: "Orçamentos", icon: ShoppingBag },
  { href: "/registrar-atividade", label: "Follow-ups", icon: ClipboardCheck },
  { href: "/relatorios", label: "Relatórios", icon: FileText },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
];

export function VendorSidebar() {
  const pathname = usePathname();
  const { profile } = useUserProfile();
  const ehPosVenda = profile.cargo === "Pós-venda";
  const ehSdr = profile.cargo === "SDR";
  const ehVendedorInterno = profile.cargo === "Vendedor Interno";
  const ehMarketing = profile.cargo === "Marketing";
  const ehGestor = profile.cargo === "Gestor";
  const ehDiretor = profile.cargo === "Diretor";
  const podeAcessarGestor = ehGestor || ehDiretor;

  const itensNav = ehPosVenda
    ? ITENS_NAV_POS_VENDA
    : ehSdr
      ? ITENS_NAV_SDR
      : ehVendedorInterno
        ? ITENS_NAV_VENDEDOR_INTERNO
        : ITENS_NAV_VENDEDOR;

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
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                ativo
                  ? "bg-white/10 text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white/90"
              }`}
            >
              <Icon size={18} strokeWidth={ativo ? 2.25 : 1.75} />
              {item.label}
            </Link>
          );
        })}

        <Link
          href="/aura-coach"
          className={`mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            pathname === "/aura-coach"
              ? "bg-white/10 text-white"
              : "text-white/55 hover:bg-white/5 hover:text-white/90"
          }`}
        >
          <Sparkles size={18} strokeWidth={1.75} className="text-aura-gold" />
          AURA Coach
          <span className="ml-auto rounded-full bg-aura-gold/15 px-2 py-0.5 text-[0.6rem] font-semibold tracking-wide text-aura-gold">
            ATIVA
          </span>
        </Link>

        <Link
          href="/configuracoes"
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            pathname === "/configuracoes"
              ? "bg-white/10 text-white"
              : "text-white/55 hover:bg-white/5 hover:text-white/90"
          }`}
        >
          <Settings size={18} strokeWidth={1.75} />
          Configurações
        </Link>
      </nav>

      {/* APENAS GESTOR/DIRETOR VEEM ISSO */}
      {podeAcessarGestor && (
        <>
          {ehSdr || ehVendedorInterno ? (
            // SDR/Vendedor Interno vê Leads
            <Link
              href="/leads"
              className="mb-3 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-xs font-medium text-white/60 transition hover:border-white/20 hover:text-white"
            >
              <UserPlus size={14} />
              Leads
            </Link>
          ) : null}

          {!ehPosVenda && (
            <Link
              href="/pos-venda"
              className="mb-3 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-xs font-medium text-white/60 transition hover:border-white/20 hover:text-white"
            >
              <Wrench size={14} />
              Pós-venda
            </Link>
          )}

          {!ehMarketing && (
            <Link
              href="/marketing"
              className="mb-3 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-xs font-medium text-white/60 transition hover:border-white/20 hover:text-white"
            >
              <Megaphone size={14} />
              Marketing
            </Link>
          )}

          <Link
            href="/gestor"
            className="mb-3 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-xs font-medium text-white/60 transition hover:border-white/20 hover:text-white"
          >
            <LayoutDashboard size={14} />
            Visão do Gestor
          </Link>
        </>
      )}
    </aside>
  );
}
