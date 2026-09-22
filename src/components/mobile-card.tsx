import { ReactNode } from "react";

interface MobileCardProps {
  title?: string;
  children: ReactNode;
  actionButton?: ReactNode;
  className?: string;
}

export function MobileCard({
  title,
  children,
  actionButton,
  className = "",
}: MobileCardProps) {
  return (
    <div className={`rounded-lg border border-aura-mist bg-white p-4 md:p-6 ${className}`}>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base md:text-lg font-semibold text-aura-graphite">
            {title}
          </h2>
          {actionButton}
        </div>
      )}
      {children}
    </div>
  );
}