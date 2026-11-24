import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Cartão padrão dos painéis (Meu Dia e afins): cabeçalho com ícone num
 * quadradinho, título e atalho à direita; linha fina separando do conteúdo.
 */
export function PanelCard({
  icon: Icon,
  iconColor = "text-aura-petrol-600",
  titulo,
  acaoLabel,
  acaoHref,
  badge,
  children,
}: {
  icon: LucideIcon;
  iconColor?: string;
  titulo: string;
  acaoLabel?: string;
  acaoHref?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-aura-mist bg-aura-surface shadow-sm">
      <header className="flex items-center gap-2.5 border-b border-aura-mist px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-aura-sunken">
          <Icon size={15} className={iconColor} />
        </span>
        <h2 className="text-sm font-semibold text-aura-graphite">{titulo}</h2>
        {badge}
        {acaoLabel && (
          <Link
            href={acaoHref ?? "#"}
            className="group ml-auto flex items-center gap-1 text-xs font-medium text-aura-graphite-soft transition hover:text-aura-petrol-600"
          >
            {acaoLabel}
            <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
          </Link>
        )}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
