"use client";

/**
 * Áreas e abas do Painel do Gestor.
 *
 * Eram 19 itens no mesmo menu lateral: o gestor lia a lista inteira para achar
 * uma tela, e "Custo da IA" tinha o mesmo peso que "Equipe". Agora são SEIS
 * ÁREAS, na ordem do dia do gestor — ver como está, cobrar a equipe, olhar os
 * números, cuidar dos acessos, cuidar da AURA, ajustar o sistema — e cada área
 * abre poucas abas de um assunto só.
 *
 * Moram aqui, e não no layout ou na página, porque os dois usam: o layout
 * desenha o menu (as áreas) e a página desenha as abas e o conteúdo. A aba
 * aberta mora no endereço (/gestor?aba=funil): link copiado abre a mesma tela,
 * e os links antigos (/gestor?aba=saude, que o sino das Sentinelas usa)
 * continuam valendo.
 */
import {
  Activity,
  AtSign,
  BarChart3,
  CalendarRange,
  FileBarChart,
  GitBranch,
  GraduationCap,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Table2,
  Target,
  Trophy,
  Users,
  UsersRound,
  Video,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { usarMeuAcesso } from "@/lib/usar-permissoes";

export type AbaGestor =
  | "aura"
  | "dashboard"
  | "planilha"
  | "usuarios"
  | "permissoes"
  | "instagram"
  | "ranking"
  | "avaliacoes"
  | "custo-ia"
  | "configuracoes"
  | "marketing"
  | "aprendizado"
  | "semanal"
  | "movimentacao"
  | "atendimento"
  | "funil"
  | "pontuacao"
  | "equipe"
  | "saude";

export type AreaGestor = "visao" | "equipe" | "relatorios" | "acessos" | "aura" | "ajustes";

export const AREAS_GESTOR: Array<{ id: AreaGestor; titulo: string; descricao: string; icone: LucideIcon }> = [
  { id: "visao", titulo: "Visão geral", descricao: "Como a operação está agora", icone: LayoutDashboard },
  { id: "equipe", titulo: "Equipe", descricao: "Conversas, metas e prêmios", icone: UsersRound },
  { id: "relatorios", titulo: "Relatórios", descricao: "Fechou, perdeu e leads", icone: FileBarChart },
  { id: "acessos", titulo: "Pessoas e acessos", descricao: "Quem entra e o que pode", icone: KeyRound },
  { id: "aura", titulo: "AURA", descricao: "O que a IA sabe e custa", icone: Sparkles },
  { id: "ajustes", titulo: "Ajustes", descricao: "Funil, canais e regras", icone: SlidersHorizontal },
];

export const ABAS_GESTOR: Array<{
  id: AbaGestor;
  label: string;
  descricao: string;
  icon: LucideIcon;
  area: AreaGestor;
  /** Só aparece para quem enxerga as quatro lojas (o servidor confere de novo). */
  soMestre?: boolean;
}> = [
  // Visão geral
  { id: "aura", label: "Supervisora AURA", descricao: "Equipe, riscos e o que fazer agora", icon: Sparkles, area: "visao" },
  { id: "movimentacao", label: "Movimentação do dia", descricao: "O que cada um fez hoje, e quem não apareceu", icon: Activity, area: "visao" },
  { id: "dashboard", label: "Dashboard", descricao: "Visão comercial, equipe e resultados", icon: BarChart3, area: "visao" },
  // Equipe
  { id: "equipe", label: "Conversa por conversa", descricao: "Loja → vendedor → conversa e negociação, com o laudo da IA", icon: MessagesSquare, area: "equipe" },
  { id: "pontuacao", label: "Metas e prêmios", descricao: "Meta por pessoa, pontos e premiação", icon: Target, area: "equipe" },
  { id: "ranking", label: "Regras do ranking", descricao: "O que conta, quanto pesa e o corte do bônus", icon: Trophy, area: "equipe" },
  // Relatórios
  { id: "semanal", label: "Relatório do período", descricao: "Fechou, perdeu e onde cada um erra", icon: CalendarRange, area: "relatorios" },
  { id: "planilha", label: "Planilha de leads", descricao: "Indicadores de leads preenchidos pela equipe", icon: Table2, area: "relatorios" },
  // Pessoas e acessos
  { id: "usuarios", label: "Usuários", descricao: "Gerencie os acessos da empresa", icon: Users, area: "acessos" },
  { id: "permissoes", label: "Permissões", descricao: "Aprovar gestores e definir o que cada um faz", icon: ShieldCheck, area: "acessos" },
  // AURA
  { id: "aprendizado", label: "Aprendizado", descricao: "Aprove o que ela tirou das conversas", icon: GraduationCap, area: "aura" },
  { id: "configuracoes", label: "Base de conhecimento", descricao: "O que a AURA sabe e as regras do CRM", icon: Settings, area: "aura" },
  { id: "custo-ia", label: "Custo da IA", descricao: "Saldo, consumo e depósitos da AURA", icon: Wallet, area: "aura" },
  // Ajustes
  { id: "funil", label: "Etapas do funil", descricao: "Renomeie, reordene e escolha o que conta no pipeline", icon: GitBranch, area: "ajustes" },
  { id: "atendimento", label: "Atendimento por distância", descricao: "O que oferecer a quem está longe do showroom", icon: Video, area: "ajustes" },
  { id: "avaliacoes", label: "Avaliações", descricao: "Links do Google e redes, e quem já avaliou", icon: Star, area: "ajustes" },
  { id: "instagram", label: "Instagram", descricao: "Conectar a conta de cada loja e liberar quem atende", icon: AtSign, area: "ajustes" },
  { id: "marketing", label: "Marketing", descricao: "Dashboard, usuários e configurações de marketing", icon: Megaphone, area: "ajustes" },
  { id: "saude", label: "Saúde do sistema", descricao: "O que as Sentinelas acharam: crons, backup, dados e acessos", icon: HeartPulse, area: "ajustes", soMestre: true },
];

export function hrefDaAbaGestor(id: AbaGestor) {
  return id === "aura" ? "/gestor" : `/gestor?aba=${id}`;
}

/**
 * Aba aberta (lida da URL), já filtrada pelo que a pessoa pode ver. Quem não é
 * mestre e abre /gestor?aba=saude cai na primeira aba, e não numa tela vazia.
 * Usa useSearchParams: quem chama precisa estar dentro de um <Suspense>.
 */
export function useAbaGestor() {
  const params = useSearchParams();
  const acesso = usarMeuAcesso();
  const souMestre = acesso.gestorMestre && acesso.gestorAprovado;

  const visiveis = ABAS_GESTOR.filter((a) => !a.soMestre || souMestre);
  const pedida = params.get("aba");
  const atual = visiveis.find((a) => a.id === pedida) ?? visiveis[0];
  const areaAtual = AREAS_GESTOR.find((ar) => ar.id === atual.area) ?? AREAS_GESTOR[0];
  const abasDaArea = visiveis.filter((a) => a.area === areaAtual.id);
  const areasVisiveis = AREAS_GESTOR.filter((ar) => visiveis.some((a) => a.area === ar.id));
  /** Abrir uma área = abrir a primeira aba dela. */
  const hrefDaArea = (id: AreaGestor) => {
    const primeira = visiveis.find((a) => a.area === id);
    return primeira ? hrefDaAbaGestor(primeira.id) : "/gestor";
  };

  return { atual, areaAtual, abasDaArea, areasVisiveis, hrefDaArea, souMestre };
}
