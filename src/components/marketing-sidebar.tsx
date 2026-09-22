"use client";

import Link from "next/link";
import { BarChart3 } from "lucide-react";

export function MarketingSidebar() {
  return (
    <nav className="space-y-1">
      <Link
        href="/marketing/planilha-leads"
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/55 hover:bg-white/5 hover:text-white/90"
      >
        <BarChart3 size={18} />
        Planilha de Leads
      </Link>
    </nav>
  );
}
