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
      <p className="mb-1.5 text-sm font-medium text-aura-graphite">Como foi?</p>
      <div className="flex flex-wrap gap-2">
        {OPCOES.map((opt) => {
          const ativo = value === opt.label;
          return (
            <button
              key={opt.label}
              type="button"
              onClick={() => onChange(opt.label)}
              className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition ${
                ativo
                  ? "border-aura-graphite bg-aura-graphite text-white"
                  : "border-aura-mist bg-white text-aura-graphite hover:border-aura-graphite/40"
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
