export function AuraMark({ tone = "light" }: { tone?: "light" | "dark" }) {
  const ring = tone === "light" ? "stroke-white/70" : "stroke-aura-petrol-700";
  const wordColor = tone === "light" ? "text-white" : "text-aura-petrol-900";

  return (
    <div className="flex items-center gap-3">
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
        <circle cx="15" cy="15" r="13.5" className={ring} strokeWidth="1" opacity="0.5" />
        <circle cx="15" cy="15" r="9" className={ring} strokeWidth="1.25" opacity="0.8" />
        <circle cx="15" cy="15" r="3.5" fill="currentColor" className={tone === "light" ? "text-white" : "text-aura-petrol-700"} />
      </svg>
      <span className={`font-display font-semibold text-[1.35rem] tracking-tight ${wordColor}`}>
        AURA
      </span>
    </div>
  );
}
