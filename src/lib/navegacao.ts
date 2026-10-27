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
  Globe,
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
  { href: "/meu-dia", label: "Meu Dia", icon: Home },
  { href: "/pos-venda", label: "Pós-venda", icon: Wrench },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/relacionamentos", label: "Clientes", icon: Users },
  { href: "/registrar-atividade", label: "Registrar Atividade", icon: ClipboardCheck },
  { href: "/atividades", label: "Atividades", icon: Activity },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/academy", label: "Academy", icon: GraduationCap },
  { href: "/area-vendedor", label: "Área do Vendedor", icon: Link2 },
];

const SDR: ItemMenu[] = [
  { href: "/meu-dia", label: "Meu Dia", icon: Home },
  { href: "/leads", label: "Leads Recebidos", icon: UserPlus },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/relacionamentos", label: "Clientes", icon: Users },
  { href: "/registrar-atividade", label: "Registrar Atividade", icon: ClipboardCheck },
  { href: "/atividades", label: "Atividades", icon: Activity },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/academy", label: "Academy", icon: GraduationCap },
  { href: "/area-vendedor", label: "Área do Vendedor", icon: Link2 },
];

const VENDEDOR_INTERNO: ItemMenu[] = [
  { href: "/meu-dia", label: "Meu Dia", icon: Home },
  { href: "/leads", label: "Leads", icon: UserPlus },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/relacionamentos", label: "Atendimento", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: Filter },
  { href: "/vendas", label: "Orçamentos", icon: ShoppingBag },
  { href: "/registrar-atividade", label: "Follow-ups", icon: ClipboardCheck },
  { href: "/relatorio", label: "Relatórios", icon: FileText },
  { href: "/ranking", label: "Ranking", icon: Trophy },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/academy", label: "Academy", icon: GraduationCap },
  { href: "/area-vendedor", label: "Área do Vendedor", icon: Link2 },
];

/**
 * Menu principal do cargo.
 *
 * AGENDA VALE PARA TODO MUNDO. Ela só estava no menu de Vendedor, então
 * Vendedor Interno, Pós-venda e SDR não tinham como chegar na tela: /agenda
 * existe, funciona e ninguém linka para ela fora do Meu Dia. Para a Jociane
 * isso apareceu como "a agenda sumiu da AURA" — ela nunca esteve lá para o
 * cargo dela. Quem atende por dentro marca retorno e visita igual a quem está
 * na rua; o pós-venda marca assistência; o SDR marca callback.
 *
 * MATERIAIS VALEM PARA TODO MUNDO. Academy e Área do Vendedor (catálogo,
 * planilhas, links e Mapa Comercial) estavam só no menu de Vendedor externo,
 * então a vendedora interna da LF (e as da A&G e da Sole) não alcançava os
 * materiais. Agora todos os cargos têm os dois itens.
 *
 * Meu Dia abre a lista de TODOS os cargos: é a tela onde a pessoa vê o que
 * tem para fazer hoje, e isso vale para quem atende no balcão, para o
 * pós-venda e para o marketing igual vale para o vendedor externo. Antes só o
 * menu de vendedor tinha, e quem era de outro cargo simplesmente não
 * alcançava a tela.
 */
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

/**
 * Aba "Site MF": atendimento dos formulários do site, formulários e páginas.
 * É da MF International (fábrica) e dos gestores mestres, que enxergam todas
 * as lojas onde quer que estejam cadastrados. Entra logo abaixo do WhatsApp,
 * sem mexer no resto do menu. O resto das outras lojas não vê. O servidor confere de
 * novo em cada rota, então esconder aqui é só para não mostrar caminho fechado.
 */
export const ITEM_SITE_MF: ItemMenu = { href: "/site-mf", label: "Site MF", icon: Globe };

export function comSiteMf(itens: ItemMenu[], empresa?: string | null, gestorMestre = false): ItemMenu[] {
  if (normalizar(empresa) !== "mf international" && !gestorMestre) return itens;
  if (itens.some((i) => i.href === ITEM_SITE_MF.href)) return itens;
  const pos = itens.findIndex((i) => i.href === "/whatsapp");
  if (pos < 0) return [...itens, ITEM_SITE_MF];
  return [...itens.slice(0, pos + 1), ITEM_SITE_MF, ...itens.slice(pos + 1)];
}
