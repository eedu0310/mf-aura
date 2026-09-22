const CORES = {
  vermelho: "bg-aura-danger",
  amarelo: "bg-aura-warning",
  verde: "bg-aura-success",
  petroleo: "bg-aura-petrol-500",
} as const;

export function StatCard({
  label,
  valor,
  cor,
  legenda,
}: {
  label: string;
  valor: number | string;
  cor: keyof typeof CORES;
  legenda: string;
}) {
  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${CORES[cor]}`} />
        <p className="text-sm text-aura-graphite-soft">{label}</p>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold text-aura-graphite">
        {valor}
      </p>
      <p className="mt-1 text-xs text-aura-graphite-soft">{legenda}</p>
    </div>
  );
}
