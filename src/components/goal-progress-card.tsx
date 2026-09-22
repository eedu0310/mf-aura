function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(valor);
}

export function GoalProgressCard({
  titulo,
  realizado,
  meta,
}: {
  titulo: string;
  realizado: number;
  meta: number;
}) {
  const percentual = Math.min(100, Math.round((realizado / meta) * 100));

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-5">
      <p className="text-sm text-aura-graphite-soft">{titulo}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-2xl font-semibold text-aura-graphite">
          {formatarMoeda(realizado)}
        </span>
        <span className="text-sm text-aura-graphite-soft">
          de {formatarMoeda(meta)}
        </span>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-aura-mist">
        <div
          className="h-full rounded-full bg-aura-petrol-600"
          style={{ width: `${percentual}%` }}
        />
      </div>
      <p className="mt-1.5 font-data text-xs text-aura-graphite-soft">
        {percentual}% da meta
      </p>
    </div>
  );
}
