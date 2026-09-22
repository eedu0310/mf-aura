import { Brain } from "lucide-react";

export function AuraInsightCard({ texto }: { texto: string }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-aura-petrol-700/15 bg-aura-petrol-700/[0.04] p-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aura-petrol-700 text-white">
        <Brain size={17} />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-aura-petrol-700">
          Insight da AURA
        </p>
        <p className="mt-1 text-sm leading-relaxed text-aura-graphite">{texto}</p>
      </div>
    </div>
  );
}
