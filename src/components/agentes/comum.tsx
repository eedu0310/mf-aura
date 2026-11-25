"use client";

/**
 * Peças comuns das telas da equipe de agentes (escritório, equipe, propostas,
 * base de conhecimento e o cartão do Meu Dia).
 *
 * Tudo o que a tela recebe vem pronto do servidor no formato do contrato
 * (src/lib/agentes/tipos.ts → EstadoEscritorio). Aqui ficam só: a chamada
 * autenticada, a leitura do estado com atualização periódica, os nomes em
 * português de setor/estado/tipo de fala, o ícone de cada agente e peças de
 * visual (luz de status, gaveta lateral, janela, esqueleto de carregamento).
 */
import { createElement, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Activity,
  AtSign,
  BadgeCheck,
  Bug,
  CalendarCheck,
  DatabaseBackup,
  Globe,
  Library,
  MessageSquareWarning,
  RefreshCcw,
  ShieldAlert,
  Shuffle,
  Sun,
  AlarmClock,
  Archive,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Brain,
  Briefcase,
  CalendarClock,
  ClipboardCheck,
  Clock,
  CloudUpload,
  Compass,
  Crown,
  Database,
  Eye,
  FileText,
  Filter,
  Flame,
  Gauge,
  GraduationCap,
  Handshake,
  HardDrive,
  HeartHandshake,
  HeartPulse,
  Inbox,
  Layers,
  Lightbulb,
  LineChart,
  Mail,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  PhoneCall,
  Radar,
  Search,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Star,
  Target,
  Timer,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { EstadoEscritorio, EstadoMesa, FalaEscritorio, MesaAgente, Setor } from "@/lib/agentes/tipos";
import type { Tom } from "@/components/ui";

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* --------------------------------------------------------- chamada à API */

/**
 * fetch com o token da sessão (mesmo jeito do AURA Coach): as rotas aceitam
 * cookie ou "Bearer", e mandar os dois evita a tela vazia quando o cookie
 * ainda não chegou. Erro do servidor vira Error com a frase dele ({ erro }).
 */
export async function chamarApi<T>(url: string, init?: RequestInit): Promise<T> {
  const sb = getSupabaseBrowserClient();
  const sessao = sb ? (await sb.auth.getSession()).data.session : null;
  const headers = new Headers(init?.headers);
  if (sessao?.access_token) headers.set("Authorization", `Bearer ${sessao.access_token}`);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(url, { cache: "no-store", ...init, headers });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    const erro = (json as { erro?: unknown } | null)?.erro;
    throw new Error(typeof erro === "string" && erro ? erro : `Não consegui falar com o servidor (erro ${res.status}).`);
  }
  return json as T;
}

/* ------------------------------------------------ estado do escritório */

const INTERVALO_MS = 20_000;

/**
 * Lê GET /api/gestor/agentes. Com `vivo`, relê a cada 20 s enquanto a aba do
 * navegador estiver visível (aba escondida não gasta consulta) e relê na hora
 * em que a pessoa volta para ela.
 */
export function useEscritorio({ vivo = false }: { vivo?: boolean } = {}) {
  const [estado, setEstado] = useState<EstadoEscritorio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const emAndamento = useRef(false);

  const recarregar = useCallback(async () => {
    if (emAndamento.current) return;
    emAndamento.current = true;
    try {
      const dados = await chamarApi<EstadoEscritorio>("/api/gestor/agentes");
      setEstado(normalizar(dados));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui carregar a equipe de agentes.");
    } finally {
      emAndamento.current = false;
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
    if (!vivo) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void recarregar();
    }, INTERVALO_MS);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void recarregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [recarregar, vivo]);

  return { estado, erro, carregando, recarregar };
}

/** Resposta parcial (rota ainda sendo escrita) não derruba a tela. */
function normalizar(d: Partial<EstadoEscritorio> | null): EstadoEscritorio {
  return {
    ativo: Boolean(d?.ativo),
    motivoInativo: d?.motivoInativo,
    mesas: Array.isArray(d?.mesas) ? d.mesas : [],
    falas: Array.isArray(d?.falas) ? d.falas : [],
    propostas: Array.isArray(d?.propostas) ? d.propostas : [],
    planoDoDia: d?.planoDoDia ?? null,
    conhecimento: {
      aprendizadosAprovados: d?.conhecimento?.aprendizadosAprovados ?? 0,
      aprendizadosSugeridos: d?.conhecimento?.aprendizadosSugeridos ?? 0,
      materiais: d?.conhecimento?.materiais ?? 0,
      trechos: d?.conhecimento?.trechos ?? 0,
      ultimaVersao: d?.conhecimento?.ultimaVersao ?? null,
      ultimoBackup: d?.conhecimento?.ultimoBackup ?? null,
    },
    custo30dUsd: d?.custo30dUsd ?? 0,
  };
}

/* ------------------------------------------------------------- comandos */

export const comandos = {
  alterar: (id: string, corpo: { ativo?: boolean; orcamentoMensalUsd?: number }) =>
    chamarApi<unknown>(`/api/gestor/agentes/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(corpo) }),
  rodar: (id: string) =>
    chamarApi<unknown>(`/api/gestor/agentes/${encodeURIComponent(id)}/rodar`, { method: "POST" }),
  decidir: (id: string, decisao: "aprovar" | "recusar") =>
    chamarApi<unknown>(`/api/gestor/agentes/propostas/${encodeURIComponent(id)}`, {
      method: "POST",
      body: JSON.stringify({ decisao }),
    }),
};

/* -------------------------------------------------------------- nomes */

export const SETORES: Array<{ id: Setor; rotulo: string; descricao: string; icone: LucideIcon }> = [
  { id: "direcao", rotulo: "Direção", descricao: "Quem planeja e cobra", icone: Crown },
  { id: "vendas", rotulo: "Vendas", descricao: "Follow-up, oportunidades e leads", icone: TrendingUp },
  { id: "atendimento", rotulo: "Atendimento", descricao: "Quem conversa com o cliente: Instagram, site e WhatsApp", icone: MessagesSquare },
  { id: "pos-venda", rotulo: "Pós-venda", descricao: "Entrega, instalação e manutenção", icone: HeartHandshake },
  { id: "marketing", rotulo: "Marketing", descricao: "Campanhas e origem dos clientes", icone: Megaphone },
  { id: "gestao", rotulo: "Gestão", descricao: "Metas, equipe e rotina das lojas", icone: Briefcase },
  { id: "conhecimento", rotulo: "Conhecimento", descricao: "O que a AURA aprende e guarda", icone: BookOpen },
  { id: "dados", rotulo: "Dados", descricao: "Qualidade, backup e saúde do sistema", icone: Database },
  { id: "seguranca", rotulo: "Equipe Vermelha", descricao: "Sabotadores do bem: procuram brecha e erro no próprio CRM e dizem como arrumar", icone: ShieldAlert },
];

export function rotuloSetor(s: Setor | string) {
  return SETORES.find((x) => x.id === s)?.rotulo ?? s;
}

export const ESTADOS: Record<EstadoMesa, { rotulo: string; tom: Tom }> = {
  trabalhando: { rotulo: "Trabalhando", tom: "sucesso" },
  ocioso: { rotulo: "Ocioso", tom: "neutro" },
  com_erro: { rotulo: "Com erro", tom: "perigo" },
  desligado: { rotulo: "Desligado", tom: "neutro" },
  aguardando_ativacao: { rotulo: "Aguardando ativação", tom: "atencao" },
};

export const TIPOS_FALA: Record<FalaEscritorio["tipo"], { rotulo: string; tom: Tom }> = {
  plano: { rotulo: "Plano", tom: "marca" },
  pedido: { rotulo: "Pedido", tom: "atencao" },
  resposta: { rotulo: "Resposta", tom: "neutro" },
  ideia: { rotulo: "Ideia", tom: "ouro" },
  alerta: { rotulo: "Alerta", tom: "perigo" },
  aprendizado: { rotulo: "Aprendizado", tom: "sucesso" },
  relato: { rotulo: "Relato", tom: "neutro" },
};

export const TIPOS_AGENTE: Record<MesaAgente["tipo"], string> = {
  nativo: "Nativo",
  sistema: "Rotina do sistema",
  configuravel: "Criado pela equipe",
};

export const CRIADO_POR: Record<MesaAgente["criadoPor"], string> = {
  sistema: "Sistema",
  diretora: "Diretora",
  agente: "Outro agente",
  gestor: "Gestor",
};

/** A Diretora tem sala própria no topo; o resto da Direção fica na planta. */
export function acharDiretora(mesas: MesaAgente[]) {
  return (
    mesas.find((m) => m.setor === "direcao" && /diretor/i.test(`${m.id} ${m.nome}`)) ??
    mesas.find((m) => m.setor === "direcao") ??
    null
  );
}

/* --------------------------------------------------------------- ícones */

/**
 * O servidor manda o nome do ícone em texto ("PhoneCall"). Só os ícones desta
 * lista viram desenho — nome desconhecido (ou de agente criado pela equipe
 * com ícone que ainda não está aqui) cai no robô, nunca quebra a tela.
 */
const ICONES: Record<string, LucideIcon> = {
  Activity, AlarmClock, Archive, BarChart3, Bell, BookOpen, Bot, Brain, Briefcase, CalendarClock,
  ClipboardCheck, Clock, CloudUpload, Compass, Crown, Database, Eye, FileText, Filter, Flame, Gauge,
  GraduationCap, Handshake, HardDrive, HeartHandshake, HeartPulse, Inbox, Layers, Lightbulb, LineChart,
  Mail, Megaphone, MessageCircle, MessagesSquare, PhoneCall, Radar, Search, ShieldCheck, Snowflake,
  Sparkles, Star, Target, Timer, TrendingUp, UserCheck, Users, Wallet, Wrench, Zap,
  // Os que os agentes já usavam e caíam no robô, e os da Equipe Vermelha.
  AtSign, BadgeCheck, Bug, CalendarCheck, DatabaseBackup, Globe, Library, MessageSquareWarning, RefreshCcw,
  ShieldAlert, Shuffle, Sun,
};

export function iconeDoAgente(nome: string | null | undefined): LucideIcon {
  return (nome && Object.prototype.hasOwnProperty.call(ICONES, nome) ? ICONES[nome] : null) ?? Bot;
}

/** Avatar do agente: ícone num quadradinho, com destaque para a Diretora. */
export function AvatarAgente({
  icone,
  tamanho = "md",
  destaque = false,
  apagado = false,
}: {
  icone: string | null | undefined;
  tamanho?: "sm" | "md" | "lg";
  destaque?: boolean;
  apagado?: boolean;
}) {
  // createElement: o ícone é escolhido da lista fixa acima, não criado agora.
  const desenho = createElement(iconeDoAgente(icone), { size: tamanho === "sm" ? 14 : tamanho === "lg" ? 18 : 16 });
  const caixa = tamanho === "sm" ? "h-7 w-7 rounded-md" : tamanho === "lg" ? "h-11 w-11 rounded-xl" : "h-9 w-9 rounded-lg";
  return (
    <span
      className={cx(
        "flex shrink-0 items-center justify-center border",
        caixa,
        destaque
          ? "border-aura-gold/30 bg-aura-gold/12 text-aura-gold-700"
          : "border-aura-mist bg-aura-sunken text-aura-petrol-600",
        apagado && "opacity-55 grayscale",
      )}
      aria-hidden
    >
      {desenho}
    </span>
  );
}

/* ---------------------------------------------------------- luz de status */

/**
 * Luz da mesa: verde pulsando = trabalhando; cinza = ocioso; vermelha = erro;
 * contorno tracejado = desligado ou aguardando ativação. O pulso respeita
 * "reduzir movimento" do sistema (motion-safe).
 */
export function LuzStatus({ estado, className }: { estado: EstadoMesa; className?: string }) {
  const rotulo = ESTADOS[estado]?.rotulo ?? estado;
  if (estado === "desligado" || estado === "aguardando_ativacao") {
    return (
      <span
        className={cx("inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-dashed border-aura-graphite-soft/70", className)}
        title={rotulo}
        aria-label={rotulo}
        role="img"
      />
    );
  }
  const cor = estado === "trabalhando" ? "bg-aura-success" : estado === "com_erro" ? "bg-aura-danger" : "bg-aura-graphite-soft/45";
  return (
    <span className={cx("relative inline-flex h-2.5 w-2.5 shrink-0", className)} title={rotulo} aria-label={rotulo} role="img">
      {estado === "trabalhando" && (
        <span className="absolute inline-flex h-full w-full rounded-full bg-aura-success opacity-60 motion-safe:animate-ping" />
      )}
      <span className={cx("relative inline-flex h-2.5 w-2.5 rounded-full", cor)} />
    </span>
  );
}

/* -------------------------------------------------------------- formatos */

export const dolar = (v: number) =>
  (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const numero = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR");

/** "agora", "há 12 min", "há 3 h", "ontem", "há 4 dias" ou a data. */
export function haQuanto(iso: string | null | undefined) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const min = Math.round((Date.now() - t) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `há ${d} dias`;
  return new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** "em 25 min", "hoje às 14:00", "amanhã às 7:40" ou a data. */
export function quandoVai(iso: string | null | undefined) {
  if (!iso) return "—";
  const data = new Date(iso);
  const t = data.getTime();
  if (!Number.isFinite(t)) return "—";
  const min = Math.round((t - Date.now()) / 60_000);
  if (min <= 0) return "a qualquer momento";
  if (min < 60) return `em ${min} min`;
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const hoje = new Date();
  const amanha = new Date();
  amanha.setDate(hoje.getDate() + 1);
  if (data.toDateString() === hoje.toDateString()) return `hoje às ${hora}`;
  if (data.toDateString() === amanha.toDateString()) return `amanhã às ${hora}`;
  return `${data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} às ${hora}`;
}

export function dataHora(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ------------------------------------------------------- barra de gasto */

/** Barra fina de gasto x orçamento: verde até 70%, âmbar até 100%, vermelha acima. */
export function BarraOrcamento({ gasto, orcamento, className }: { gasto: number; orcamento: number; className?: string }) {
  const pct = orcamento > 0 ? Math.min(100, (gasto / orcamento) * 100) : gasto > 0 ? 100 : 0;
  const cor = pct >= 100 ? "bg-aura-danger" : pct >= 70 ? "bg-aura-warning" : "bg-aura-petrol-500";
  return (
    <div
      className={cx("h-1 w-full overflow-hidden rounded-full bg-aura-sunken", className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label="Gasto do orçamento"
    >
      <div className={cx("h-full rounded-full transition-[width] duration-500", cor)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------ esqueleto */

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cx("rounded-lg bg-aura-sunken motion-safe:animate-pulse", className)} aria-hidden />;
}

/* --------------------------------------------------------- gaveta e janela */

function useFecharNoEsc(aberto: boolean, aoFechar: () => void) {
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, aoFechar]);
}

/**
 * Gaveta lateral (direita). Fecha no Esc, no X e clicando fora. No celular
 * ocupa a tela toda. Opcionais: `rotulo` (nome para leitor de tela quando o
 * título não é texto puro), `larga` (painel com mais coluna) e `faixa`
 * (conteúdo fixo logo abaixo do cabeçalho, que não rola — as abas do painel).
 */
export function Gaveta({
  aberto,
  aoFechar,
  titulo,
  subtitulo,
  icone,
  rotulo,
  larga = false,
  faixa,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: ReactNode;
  subtitulo?: ReactNode;
  icone?: ReactNode;
  rotulo?: string;
  larga?: boolean;
  faixa?: ReactNode;
  children: ReactNode;
}) {
  useFecharNoEsc(aberto, aoFechar);
  if (!aberto) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={rotulo ?? (typeof titulo === "string" ? titulo : undefined)}
    >
      <button type="button" aria-label="Fechar" onClick={aoFechar} className="absolute inset-0 bg-aura-navy-950/40 backdrop-blur-[1px]" />
      <aside
        className={cx(
          "relative flex h-full w-full flex-col border-l border-aura-mist bg-aura-surface shadow-xl",
          larga ? "max-w-xl" : "max-w-md",
        )}
      >
        <header className={cx("flex items-start gap-3 px-5 py-4", !faixa && "border-b border-aura-mist")}>
          {icone}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-aura-graphite">{titulo}</h2>
            {subtitulo && <p className="mt-0.5 text-xs text-aura-graphite-soft">{subtitulo}</p>}
          </div>
          <button type="button" onClick={aoFechar} className="aura-btn aura-btn-fantasma aura-btn-sm" aria-label="Fechar">
            <X size={15} />
          </button>
        </header>
        {faixa && <div className="border-b border-aura-mist px-5">{faixa}</div>}
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </aside>
    </div>
  );
}

/** Janela central pequena (confirmações, texto gerado). */
export function Janela({
  aberto,
  aoFechar,
  titulo,
  children,
  rodape,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: ReactNode;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  useFecharNoEsc(aberto, aoFechar);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Fechar" onClick={aoFechar} className="absolute inset-0 bg-aura-navy-950/40" />
      <div className="aura-card relative w-full max-w-lg shadow-xl">
        <header className="flex items-center gap-3 border-b border-aura-mist px-5 py-3.5">
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-aura-graphite">{titulo}</h2>
          <button type="button" onClick={aoFechar} className="aura-btn aura-btn-fantasma aura-btn-sm" aria-label="Fechar">
            <X size={15} />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {rodape && <footer className="flex flex-wrap justify-end gap-2 border-t border-aura-mist px-5 py-3">{rodape}</footer>}
      </div>
    </div>
  );
}
