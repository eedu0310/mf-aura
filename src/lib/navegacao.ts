/**
 * Fonte única do menu. A barra do computador (VendorSidebar) e a do celular
 * (MobileNavbar) leem daqui, para não mostrarem coisas diferentes.
 */
import {
  Home,
  Calendar,
  Users,
  Filter,
  ShoppingBag,
  ClipboardCheck,
  Trophy,
  GraduationCap,
  Link2,
  Wrench,
  Activity,
  UserPlus,
  FileText,
  MessageCircle,
  LayoutDashboard,
  Megaphone,
  type LucideIcon,
} from "lucide-react";

export interface ItemMenu {
  href: string;
  label: string;
  icon: LucideIcon;
}

function normalizar(texto?: string | null) {
  return (texto ?? "").trim().toLowerCase();
}

const VENDEDOR: ItemMenu[] = [
  { href: "/meu-dia", label: "Meu Dia", icon: Home },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/relacionamentos", label: "Relacionamentos", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: Filter },
  { href: "/vendas", label: "Vendas", icon: ShoppingBag },
  { href: "/registrar-atividade", label: "Atividades", icon: ClipboardCheck },
  { href: "/relatorio", label: "Relatórios", icon: FileText },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/academy", label: "Academy", icon: GraduationCap },
  { href: "/area-vendedor", label: "Área do Vendedor", icon: Link2 },
];

const POS_VENDA: ItemMenu[] = [
  { href: "/pos-venda", label: "Pós-venda", icon: Wrench },
  { href: "/relacionamentos", label: "Clientes", icon: Users },
  { href: "/registrar-atividade", label: "Registrar Atividade", icon: ClipboardCheck },
  { href: "/atividades", label: "Atividades", icon: Activity },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
];

const SDR: ItemMenu[] = [
  { href: "/leads", label: "Leads Recebidos", icon: UserPlus },
  { href: "/relacionamentos", label: "Clientes", icon: Users },
  { href: "/registrar-atividade", label: "Registrar Atividade", icon: ClipboardCheck },
  { href: "/atividades", label: "Atividades", icon: Activity },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
];

const VENDEDOR_INTERNO: ItemMenu[] = [
  { href: "/leads", label: "Leads", icon: UserPlus },
  { href: "/relacionamentos", label: "Atendimento", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: Filter },
  { href: "/vendas", label: "Orçamentos", icon: ShoppingBag },
  { href: "/registrar-atividade", label: "Follow-ups", icon: ClipboardCheck },
  { href: "/relatorio", label: "Relatórios", icon: FileText },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
];

/** Menu principal do cargo. */
export function menuDoCargo(cargo?: string | null): ItemMenu[] {
  const c = normalizar(cargo);
  if (c === "pós-venda" || c === "pos-venda") return POS_VENDA;
  if (c === "sdr") return SDR;
  if (c === "vendedor interno") return VENDEDOR_INTERNO;
  return VENDEDOR;
}

/** Atalhos que só O Gestor enxergam, para supervisionar as outras áreas. */
export function menuDeGestao(cargo?: string | null): ItemMenu[] {
  const c = normalizar(cargo);
  if (c !== "gestor") return [];
  return [
    { href: "/gestor", label: "Visão do Gestor", icon: LayoutDashboard },
    { href: "/leads", label: "Leads", icon: UserPlus },
    { href: "/pos-venda", label: "Pós-venda", icon: Wrench },
    { href: "/marketing", label: "Marketing", icon: Megaphone },
  ];
}
