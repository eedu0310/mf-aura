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
  AtSign,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/**
 * Seções do menu. Eram quinze itens seguidos sob um rótulo só ("Trabalho"); a
 * pessoa lia a lista inteira para achar a tela. Agrupado por assunto, o olho
 * vai direto: quem é o cliente, onde se conversa, o que fazer no dia, como
 * estou indo, onde aprender.
 */
export type SecaoMenu = "inicio" | "clientes" | "conversas" | "rotina" | "desempenho" | "aprender";

export const SECOES_MENU: Array<{ id: SecaoMenu; titulo: string }> = [
  { id: "inicio", titulo: "" },
  { id: "clientes", titulo: "Clientes" },
  { id: "conversas", titulo: "Conversas" },
  { id: "rotina", titulo: "Rotina" },
  { id: "desempenho", titulo: "Desempenho" },
  { id: "aprender", titulo: "Aprender" },
];

export interface ItemMenu {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Sem seção, o item entra em "Clientes" (o assunto principal do CRM). */
  secao?: SecaoMenu;
}

/** Agrupa os itens nas seções, na ordem de SECOES_MENU; seção vazia some. */
export function emSecoes(itens: ItemMenu[]) {
  return SECOES_MENU.map((s) => ({
    ...s,
    itens: itens.filter((i) => (i.secao ?? "clientes") === s.id),
  })).filter((s) => s.itens.length > 0);
}

/** Itens que dependem da pessoa, não do cargo (os menus acrescentam). */
export const ITEM_INSTAGRAM: ItemMenu = { href: "/instagram", label: "Instagram", icon: AtSign, secao: "conversas" };
export const ITEM_COACH: ItemMenu = { href: "/aura-coach", label: "AURA Coach", icon: Sparkles, secao: "aprender" };

function normalizar(texto?: string | null) {
  return (texto ?? "").trim().toLowerCase();
}

/**
 * MENU ÚNICO para vendedor externo e vendedor interno (decisão do Elton,
 * 03/11). Antes o interno via "Atendimento", "Orçamentos" e "Follow-ups"
 * onde o externo via "Relacionamentos", "Vendas" e "Atividades" — as mesmas
 * telas com nomes diferentes — e o externo não tinha a aba Leads, embora
 * também receba lead (do site, transferido de outra loja). Leads e WhatsApp
 * vêm logo depois do Meu Dia porque são o que a pessoa abre primeiro.
 */
const VENDEDOR: ItemMenu[] = [
  { href: "/meu-dia", label: "Meu Dia", icon: Home, secao: "inicio" },
  { href: "/leads", label: "Leads", icon: UserPlus, secao: "clientes" },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, secao: "conversas" },
  { href: "/agenda", label: "Agenda", icon: Calendar, secao: "rotina" },
  { href: "/relacionamentos", label: "Relacionamentos", icon: Users, secao: "clientes" },
  { href: "/pipeline", label: "Pipeline", icon: Filter, secao: "clientes" },
  { href: "/vendas", label: "Vendas", icon: ShoppingBag, secao: "clientes" },
  { href: "/registrar-atividade", label: "Atividades", icon: ClipboardCheck, secao: "rotina" },
  { href: "/relatorio", label: "Relatórios", icon: FileText, secao: "desempenho" },
  { href: "/ranking", label: "Ranking", icon: Trophy, secao: "desempenho" },
  { href: "/academy", label: "Academy", icon: GraduationCap, secao: "aprender" },
  { href: "/area-vendedor", label: "Área do Vendedor", icon: Link2, secao: "aprender" },
];

const POS_VENDA: ItemMenu[] = [
  { href: "/meu-dia", label: "Meu Dia", icon: Home, secao: "inicio" },
  { href: "/pos-venda", label: "Pós-venda", icon: Wrench, secao: "clientes" },
  { href: "/agenda", label: "Agenda", icon: Calendar, secao: "rotina" },
  { href: "/relacionamentos", label: "Clientes", icon: Users, secao: "clientes" },
  { href: "/registrar-atividade", label: "Registrar Atividade", icon: ClipboardCheck, secao: "rotina" },
  { href: "/atividades", label: "Atividades", icon: Activity, secao: "rotina" },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, secao: "conversas" },
  { href: "/academy", label: "Academy", icon: GraduationCap, secao: "aprender" },
  { href: "/area-vendedor", label: "Área do Vendedor", icon: Link2, secao: "aprender" },
];

const SDR: ItemMenu[] = [
  { href: "/meu-dia", label: "Meu Dia", icon: Home, secao: "inicio" },
  { href: "/leads", label: "Leads Recebidos", icon: UserPlus, secao: "clientes" },
  { href: "/agenda", label: "Agenda", icon: Calendar, secao: "rotina" },
  { href: "/relacionamentos", label: "Clientes", icon: Users, secao: "clientes" },
  { href: "/registrar-atividade", label: "Registrar Atividade", icon: ClipboardCheck, secao: "rotina" },
  { href: "/atividades", label: "Atividades", icon: Activity, secao: "rotina" },
  { href: "/ranking", label: "Ranking", icon: Trophy, secao: "desempenho" },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, secao: "conversas" },
  { href: "/academy", label: "Academy", icon: GraduationCap, secao: "aprender" },
  { href: "/area-vendedor", label: "Área do Vendedor", icon: Link2, secao: "aprender" },
];

const VENDEDOR_INTERNO: ItemMenu[] = VENDEDOR;

/**
 * Marketing entra na Central de Marketing (rotaInicial), mas tudo que é do CRM
 * (Configurações, Meu Dia, o "Voltar" da área) abre com o menu de vendedor, e
 * nele não havia caminho de volta para /marketing: a pessoa só voltava
 * digitando o endereço ou saindo e entrando de novo. A Central vem primeiro.
 */
const MARKETING: ItemMenu[] = [
  { href: "/marketing", label: "Central de Marketing", icon: Megaphone, secao: "inicio" },
  ...VENDEDOR,
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
  if (c === "marketing") return MARKETING;
  return VENDEDOR;
}

/** Atalhos que só O Gestor enxergam, para supervisionar as outras áreas. */
export function menuDeGestao(cargo?: string | null): ItemMenu[] {
  const c = normalizar(cargo);
  if (c !== "gestor") return [];
  // Sem "/leads": o gestor já recebe o menu de Vendedor, que tem Leads. Os
  // dois juntos mostravam "Leads" duas vezes no celular (e o React reclamava
  // da chave repetida) — o teste navegacao.teste.ts pegou.
  return [
    { href: "/gestor", label: "Visão do Gestor", icon: LayoutDashboard },
    { href: "/pos-venda", label: "Pós-venda", icon: Wrench, secao: "clientes" },
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
export const ITEM_SITE_MF: ItemMenu = { href: "/site-mf", label: "Site MF", icon: Globe, secao: "conversas" };

export function comSiteMf(itens: ItemMenu[], empresa?: string | null, gestorMestre = false): ItemMenu[] {
  if (normalizar(empresa) !== "mf international" && !gestorMestre) return itens;
  if (itens.some((i) => i.href === ITEM_SITE_MF.href)) return itens;
  const pos = itens.findIndex((i) => i.href === "/whatsapp");
  if (pos < 0) return [...itens, ITEM_SITE_MF];
  return [...itens.slice(0, pos + 1), ITEM_SITE_MF, ...itens.slice(pos + 1)];
}
