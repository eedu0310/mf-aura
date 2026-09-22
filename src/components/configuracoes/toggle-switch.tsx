"use client";

export function ToggleSwitch({
  checked,
  onChange,
  label,
  descricao,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  descricao?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-aura-graphite">{label}</p>
        {descricao && <p className="text-xs text-aura-graphite-soft">{descricao}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-aura-petrol-700" : "bg-aura-mist"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
