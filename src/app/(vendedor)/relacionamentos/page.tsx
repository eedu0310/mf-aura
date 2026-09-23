import { Suspense } from "react";
import { RelationshipsExplorer } from "@/components/relacionamentos/relationships-explorer";

export default function RelacionamentosPage() {
  return (
    <Suspense fallback={null}>
      <RelationshipsExplorer />
    </Suspense>
  );
}
