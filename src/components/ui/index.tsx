/**
 * Peças do visual da AURA (design system).
 *
 * Toda tela monta com estas peças, para ter o mesmo cabeçalho, o mesmo
 * cartão, o mesmo botão. As cores vêm do tema (claro/escuro) sozinhas.
 * Guia de uso: docs/design-system.md.
 */
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ página */

const LARGURAS = {
  estreita: "max-w-3xl",
  normal: "max-w-6xl",
  larga: "max-w-7xl",
  total: "max-w-none",
} as const;

/** Área útil da tela: largura máxima e respiro iguais em todas as páginas. */
export function PageContainer({
  children,
  largura = "larga",
  className,
}: {
  children: ReactNode;
  largura?: keyof typeof LARGURAS;
  className?: string;
}) {
  return (
    <div className={cx("mx-auto w-full px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pt-8", LARGURAS[largura], className)}>
      {children}
    </div>
  );
}

/**
 * Cabeçalho de página: título, uma linha de descrição e as ações à direita.
 * Substitui as faixas escuras que cada tela desenhava do seu jeito.
 */
export function PageHeader({
  titulo,
  descricao,
  icone: Icone,
  acoes,
  rotulo,
  className,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  icone?: LucideIcon;
  acoes?: ReactNode;
  /** Texto pequeno acima do título (ex.: nome da loja). */
  rotulo?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icone && (
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-aura-mist bg-aura-surface shadow-sm">
            <Icone size={18} className="text-aura-petrol-600" />
          </span>
        )}
        <div className="min-w-0">
          {rotulo && <p className="aura-rotulo mb-1">{rotulo}</p>}
          <h1 className="font-display text-2xl font-semibold text-aura-graphite">{titulo}</h1>
          {descricao && <p className="mt-1 text-sm text-aura-graphite-soft">{descricao}</p>}
        </div>
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  );
}

/* ----------------------------------------------------------------- cartão */

export function Card({
  children,
  className,
  interativo = false,
  semPadding = false,
  ...resto
}: {
  children: ReactNode;
  className?: string;
  interativo?: boolean;
  semPadding?: boolean;
} & Omit<ComponentProps<"section">, "className" | "children">) {
  return (
    <section
      className={cx("aura-card", interativo && "aura-card-interativo", !semPadding && "p-5", className)}
      {...resto}
    >
      {children}
    </section>
  );
}

/** Cabeçalho de cartão: ícone num quadradinho, título, descrição e ações. */
export function CardHeader({
  titulo,
  descricao,
  icone: Icone,
  corIcone = "text-aura-petrol-600",
  acoes,
  className,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  icone?: LucideIcon;
  corIcone?: string;
  acoes?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mb-4 flex items-start gap-3", className)}>
      {Icone && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-sunken">
          <Icone size={16} className={corIcone} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-aura-graphite">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-xs text-aura-graphite-soft">{descricao}</p>}
      </div>
      {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- botões */

export type VarianteBotao = "primario" | "secundario" | "fantasma" | "perigo" | "perigo-suave";
export type TamanhoBotao = "sm" | "md" | "lg";

/** Classes de botão, para usar também em <Link> e <a>. */
export function classeBotao(variante: VarianteBotao = "secundario", tamanho: TamanhoBotao = "md", extra?: string) {
  return cx("aura-btn", `aura-btn-${variante}`, tamanho !== "md" && `aura-btn-${tamanho}`, extra);
}

export function Botao({
  variante = "secundario",
  tamanho = "md",
  icone: Icone,
  className,
  children,
  type = "button",
  ...resto
}: {
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  icone?: LucideIcon;
} & ComponentProps<"button">) {
  return (
    <button type={type} className={classeBotao(variante, tamanho, className)} {...resto}>
      {Icone && <Icone size={tamanho === "sm" ? 13 : 15} aria-hidden />}
      {children}
    </button>
  );
}

export function BotaoLink({
  href,
  variante = "secundario",
  tamanho = "md",
  icone: Icone,
  className,
  children,
}: {
  href: string;
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  icone?: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={classeBotao(variante, tamanho, className)}>
      {Icone && <Icone size={tamanho === "sm" ? 13 : 15} aria-hidden />}
      {children}
    </Link>
  );
}

/* ---------------------------------------------------------------- números */

export type Tom = "neutro" | "marca" | "sucesso" | "atencao" | "perigo" | "ouro";

const COR_DO_VALOR: Record<Tom, string> = {
  neutro: "text-aura-graphite",
  marca: "text-aura-petrol-600",
  sucesso: "text-aura-success",
  atencao: "text-aura-gold-700",
  perigo: "text-aura-danger",
  ouro: "text-aura-gold-700",
};
const COR_DO_PONTO: Record<Tom, string> = {
  neutro: "bg-aura-graphite-soft/40",
  marca: "bg-aura-petrol-500",
  sucesso: "bg-aura-success",
  atencao: "bg-aura-warning",
  perigo: "bg-aura-danger",
  ouro: "bg-aura-gold",
};

/** Cartão de número (KPI): rótulo pequeno, número grande, detalhe opcional. */
export function StatCard({
  rotulo,
  valor,
  tom = "neutro",
  detalhe,
  icone: Icone,
  className,
}: {
  rotulo: ReactNode;
  valor: ReactNode;
  tom?: Tom;
  detalhe?: ReactNode;
  icone?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cx("aura-card p-4", className)}>
      <div className="flex items-center gap-1.5">
        {Icone ? (
          <Icone size={13} className={COR_DO_VALOR[tom]} />
        ) : (
          <span className={cx("h-1.5 w-1.5 rounded-full", COR_DO_PONTO[tom])} />
        )}
        <p className="aura-rotulo truncate">{rotulo}</p>
      </div>
      <p className={cx("mt-2 font-display text-2xl font-semibold tabular-nums", COR_DO_VALOR[tom])}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-aura-graphite-soft">{detalhe}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ selos */

export function Selo({ tom = "neutro", children, className }: { tom?: Tom; children: ReactNode; className?: string }) {
  return <span className={cx("aura-selo", `aura-selo-${tom}`, className)}>{children}</span>;
}

/* ----------------------------------------------------------------- alertas */

type TomAlerta = "perigo" | "atencao" | "sucesso" | "info";

const ALERTA: Record<TomAlerta, { icone: LucideIcon; cor: string; fundo: string }> = {
  perigo: { icone: XCircle, cor: "text-aura-danger", fundo: "bg-aura-danger/10" },
  atencao: { icone: AlertTriangle, cor: "text-aura-warning", fundo: "bg-aura-warning/12" },
  sucesso: { icone: CheckCircle2, cor: "text-aura-success", fundo: "bg-aura-success/10" },
  info: { icone: Info, cor: "text-aura-petrol-600", fundo: "bg-aura-petrol-500/10" },
};

/**
 * Alerta: cartão claro com o ícone colorido num quadradinho — e não a caixa
 * inteira pintada de vermelho/verde. Vários alertas juntos continuam legíveis.
 */
export function Alerta({
  tom = "info",
  titulo,
  descricao,
  acao,
  icone,
  className,
}: {
  tom?: TomAlerta;
  titulo: ReactNode;
  descricao?: ReactNode;
  acao?: ReactNode;
  icone?: LucideIcon;
  className?: string;
}) {
  const t = ALERTA[tom];
  const Icone = icone ?? t.icone;
  return (
    <div className={cx("aura-card flex items-start gap-3 p-3.5", className)} role={tom === "perigo" ? "alert" : undefined}>
      <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", t.fundo)}>
        <Icone size={16} className={t.cor} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-aura-graphite">{titulo}</p>
        {descricao && <div className="mt-0.5 text-xs leading-relaxed text-aura-graphite-soft">{descricao}</div>}
      </div>
      {acao && <div className="shrink-0 self-center">{acao}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- filtros */

/** Trilho segmentado: uma opção ativa de cada vez (filtros, abas curtas). */
export function Segmentado<T extends string>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
  className,
}: {
  opcoes: Array<{ valor: T; rotulo: ReactNode; contagem?: number }>;
  valor: T;
  aoMudar: (valor: T) => void;
  rotulo?: string;
  className?: string;
}) {
  return (
    <div className={cx("aura-segmentado max-w-full overflow-x-auto", className)} role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          className="aura-segmento"
          aria-pressed={valor === o.valor}
          onClick={() => aoMudar(o.valor)}
        >
          {o.rotulo}
          {o.contagem !== undefined && (
            <span className="ml-1.5 tabular-nums text-aura-graphite-soft">{o.contagem}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ estado vazio */

export function EstadoVazio({
  icone: Icone,
  titulo,
  descricao,
  acao,
  className,
}: {
  icone?: LucideIcon;
  titulo: ReactNode;
  descricao?: ReactNode;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col items-center justify-center rounded-xl border border-dashed border-aura-mist px-6 py-10 text-center", className)}>
      {Icone && (
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-aura-sunken">
          <Icone size={18} className="text-aura-graphite-soft" />
        </span>
      )}
      <p className="text-sm font-medium text-aura-graphite">{titulo}</p>
      {descricao && <p className="mt-1 max-w-sm text-xs text-aura-graphite-soft">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}
