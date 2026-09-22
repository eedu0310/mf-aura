"use client";

import { ReactNode } from "react";
import { MobileLayout } from "./mobile-layout";

interface RootLayoutClientProps {
  children: ReactNode;
}

export function RootLayoutClient({ children }: RootLayoutClientProps) {
  return (
    <MobileLayout>
      {children}
    </MobileLayout>
  );
}