"use client";

import { Calendar } from "lucide-react";

export function WhenPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string) => void;
}) {
  const agora = new Date();
  const hojeLocal = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
  const dataParaInput = value?.match(/^\d{4}-\d{2}-\d{2}$/)
    ? value
    : value?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      ? `${value.slice(6, 10)}-${value.slice(3, 5)}-${value.slice(0, 2)}`
      : "";

  return (
    <div>
      <label
        htmlFor="proximo-contato-data"
        className="aura-label flex items-center gap-2"
      >
        <Calendar size={15} className="text-aura-petrol-600" />
        Data do próximo contato
      </label>
      <input
        id="proximo-contato-data"
        type="date"
        value={dataParaInput}
        min={hojeLocal}
        required
        onChange={(event) => onChange(event.target.value)}
        className="aura-input"
      />
      <p className="mt-1 text-xs text-aura-graphite-soft">
        A data será registrada no CRM e aparecerá na sua agenda.
      </p>
    </div>
  );
}
