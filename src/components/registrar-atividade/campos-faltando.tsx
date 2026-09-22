import { AlertCircle } from "lucide-react";

export function CamposFaltando({ campos }: { campos: string[] }) {
  if (campos.length === 0) return null;

  return (
    <p className="flex items-start gap-1.5 text-xs text-aura-warning">
      <AlertCircle size={13} className="mt-0.5 shrink-0" />
      Falta preencher: {campos.join(", ")}
    </p>
  );
}
