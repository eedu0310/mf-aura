import { AlertTriangle } from "lucide-react";
import type { MembroEquipe } from "@/lib/supabase/team";
import { Alerta } from "@/components/ui";

export function ManagerAlerts({ equipe }: { equipe: MembroEquipe[] }) {
  const alertas = equipe
    .filter((m) => m.atividades7dias === 0 || m.vendasEsteMes < m.vendasMesPassado)
    .map((m) => {
      if (m.atividades7dias === 0) {
        return { nome: m.nome, texto: "Nenhuma atividade registrada nos últimos 7 dias." };
      }
      return { nome: m.nome, texto: "Vendas deste mês estão abaixo do mês passado." };
    });

  if (alertas.length === 0) {
    return (
      <Alerta
        tom="sucesso"
        titulo="Alertas"
        descricao="Nenhum alerta no momento — a equipe está com bom ritmo de execução."
      />
    );
  }

  return (
    <div className="aura-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-warning/12">
          <AlertTriangle size={16} className="text-aura-warning" />
        </span>
        <p className="text-sm font-semibold text-aura-graphite">
          Alertas · {alertas.length} vendedor{alertas.length > 1 ? "es" : ""} precisa
          {alertas.length > 1 ? "m" : ""} de apoio
        </p>
      </div>
      <ul className="mt-3 flex flex-col gap-2.5">
        {alertas.map((a) => (
          <li key={a.nome} className="flex items-start gap-2.5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-aura-warning" />
            <p className="text-sm text-aura-graphite">
              <span className="font-medium">{a.nome}</span> — {a.texto}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
