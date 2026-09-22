import { ReactNode } from "react";

interface MobileGridProps {
  children: ReactNode;
  cols?: 1 | 2 | 3;
}

export function MobileGrid({ children, cols = 1 }: MobileGridProps) {
  const gridClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  }[cols];

  return (
    <div className={`grid ${gridClass} gap-4`}>
      {children}
    </div>
  );
}