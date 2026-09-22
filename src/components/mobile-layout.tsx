"use client";

import { ReactNode } from "react";
import { MobileNavbar } from "./mobile-navbar";

interface MobileLayoutProps {
  children: ReactNode;
}

export function MobileLayout({ children }: MobileLayoutProps) {
  return (
    <>
      <MobileNavbar />
      <main className="pb-20 md:pb-0">
        {children}
      </main>
    </>
  );
}