import type { LucideIcon } from "lucide-react";
import Link from "next/link";

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
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <div className="flex items-center gap-2">
        <Icon size={16} className={iconColor} />
        <p className="text-sm font-medium text-aura-graphite">{titulo}</p>
        {badge}
        {acaoLabel && (
          <Link
            href={acaoHref ?? "#"}
            className="ml-auto text-xs font-medium text-aura-petrol-600 hover:underline"
          >
            {acaoLabel}
          </Link>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
