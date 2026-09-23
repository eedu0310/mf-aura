import { Suspense } from "react";
import { RelationshipsExplorer } from "@/components/relacionamentos/relationships-explorer";
import { AuraInsightCard } from "@/components/aura/aura-insight-card";

export default function RelacionamentosPage() {
  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <AuraInsightCard pagina="relacionamentos" />
      </div>
      <Suspense fallback={null}>
        <RelationshipsExplorer />
      </Suspense>
    </div>
  );
}
