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
      <p className="mb-1.5 text-sm font-medium text-aura-graphite">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const ativo = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                ativo
                  ? "border-aura-petrol-700 bg-aura-petrol-700 text-white"
                  : "border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-500/50"
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
