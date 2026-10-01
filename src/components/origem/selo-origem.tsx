"use client";

/**
 * O selo e o seletor de origem do lead.
 *
 * O selo é o ícone que o vendedor pediu para bater o olho e saber se aquele
 * card veio da loja, da MF ou de campanha, sem abrir nada. O seletor é onde a
 * origem é informada — uma vez, no lead, e dali ela é estampada em tudo que
 * nasce daquele lead (oportunidade, atividade, venda) pelo trigger do banco.
 */
import { Store, Factory, Megaphone, Footprints, Users } from "lucide-react";
import { INFO_ORIGEM, ORIGENS, type OrigemLead } from "@/lib/origem-lead";

const ICONES = { Store, Factory, Megaphone, Footprints, Users } as const;

export function SeloOrigem({
  origem,
  tamanho = 13,
  comTexto = true,
}: {
  origem: string | null | undefined;
  tamanho?: number;
  comTexto?: boolean;
}) {
  if (!origem) return null;
  const info = INFO_ORIGEM[origem as OrigemLead];
  if (!info) return null;
  const Icone = ICONES[info.icone];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${info.cor}`}
      title={info.ajuda}
    >
      <Icone size={tamanho} />
      {comTexto && info.label}
    </span>
  );
}

export function SeletorOrigem({
  valor,
  onChange,
  campanhas,
  campanhaId,
  onCampanhaChange,
}: {
  valor: OrigemLead | null;
  onChange: (v: OrigemLead) => void;
  campanhas?: { id: string; nome: string }[];
  campanhaId?: string | null;
  onCampanhaChange?: (id: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-aura-graphite">
        De onde veio este lead?
      </label>
      <div className="flex flex-wrap gap-2">
        {ORIGENS.map((o) => {
          const info = INFO_ORIGEM[o];
          const Icone = ICONES[info.icone];
          const ativo = valor === o;
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              title={info.ajuda}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                ativo
                  ? info.cor
                  : "border border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-400"
              }`}
            >
              <Icone size={15} />
              {info.label}
            </button>
          );
        })}
      </div>

      {valor && (
        <p className="text-xs text-aura-graphite-soft">{INFO_ORIGEM[valor].ajuda}</p>
      )}

      {/* Campanha só faz sentido quando a origem é marketing: é o que permite
          dizer depois quanto cada campanha custou e quanto voltou. */}
      {valor === "marketing" && campanhas && campanhas.length > 0 && (
        <select
          value={campanhaId ?? ""}
          onChange={(e) => onCampanhaChange?.(e.target.value || null)}
          className="w-full rounded-lg border border-aura-mist px-3 py-2 text-sm outline-none focus:border-aura-petrol-500"
        >
          <option value="">Qual campanha? (opcional)</option>
          {campanhas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      )}
      {valor === "marketing" && (!campanhas || campanhas.length === 0) && (
        <p className="text-xs text-aura-graphite-soft">
          Nenhuma campanha cadastrada ainda — o gestor cadastra na aba Marketing,
          e aí dá para medir o retorno de cada uma.
        </p>
      )}
    </div>
  );
}
