"use client";

export function ChoiceChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="aura-label">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const ativo = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              aria-pressed={ativo}
              className={`rounded-lg border px-3 py-1.5 text-[0.8125rem] font-medium transition ${
                ativo
                  ? "border-aura-petrol-500 bg-aura-petrol-500/10 text-aura-petrol-600"
                  : "border-aura-mist bg-aura-surface text-aura-graphite-soft hover:bg-aura-sunken hover:text-aura-graphite"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
