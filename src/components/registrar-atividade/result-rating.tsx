"use client";

const OPCOES = [
  { label: "Excelente", cor: "bg-aura-success" },
  { label: "Boa", cor: "bg-aura-warning" },
  { label: "Regular", cor: "bg-aura-gold" },
  { label: "Sem sucesso", cor: "bg-aura-danger" },
];

export function ResultRating({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="aura-label">Como foi?</p>
      <div className="flex flex-wrap gap-1.5">
        {OPCOES.map((opt) => {
          const ativo = value === opt.label;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onChange(opt.label)}
              aria-pressed={ativo}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[0.8125rem] font-medium transition ${
                ativo
                  ? "border-aura-petrol-500 bg-aura-petrol-500/10 text-aura-graphite"
                  : "border-aura-mist bg-aura-surface text-aura-graphite-soft hover:bg-aura-sunken hover:text-aura-graphite"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${opt.cor}`} />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
