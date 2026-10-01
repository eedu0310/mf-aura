/**
 * De onde veio o lead — vocabulário único da casa.
 *
 * Fica em um só lugar porque este rótulo aparece em muitos cantos (cadastro do
 * lead, cartão do pipeline, registro de atividade, planilha do Meu Dia,
 * relatório do marketing). Se cada tela escrevesse o seu, "MF" viraria
 * "Fábrica" numa e "MF Int." em outra, e o relatório do marketing somaria
 * coisas com nomes diferentes como se fossem origens distintas.
 *
 * Os valores batem com o enum origem_lead do banco (migration 037).
 */
export const ORIGENS = ["loja", "mf", "marketing", "proprio", "indicacao"] as const;

export type OrigemLead = (typeof ORIGENS)[number];

export interface InfoOrigem {
  valor: OrigemLead;
  label: string;
  /** Explicação curta, para o vendedor não ter dúvida de qual escolher. */
  ajuda: string;
  /** Nome do ícone do lucide-react, resolvido no componente. */
  icone: "Store" | "Factory" | "Megaphone" | "Footprints" | "Users";
  /** Classes do selo. */
  cor: string;
}

export const INFO_ORIGEM: Record<OrigemLead, InfoOrigem> = {
  loja: {
    valor: "loja",
    label: "Loja",
    ajuda: "O cliente procurou a loja — passou, ligou ou escreveu por conta.",
    icone: "Store",
    cor: "bg-aura-petrol-700 text-white",
  },
  mf: {
    valor: "mf",
    label: "MF",
    ajuda: "Indicação que veio da MF International, a fábrica.",
    icone: "Factory",
    cor: "bg-aura-navy-800 text-white",
  },
  marketing: {
    valor: "marketing",
    label: "Marketing",
    ajuda: "Veio de campanha. Escolha qual campanha ao lado.",
    icone: "Megaphone",
    cor: "bg-aura-gold text-aura-graphite",
  },
  proprio: {
    valor: "proprio",
    label: "Prospecção própria",
    ajuda: "Você garimpou este cliente — prospecção, visita ou ligação sua.",
    icone: "Footprints",
    cor: "bg-aura-success text-white",
  },
  indicacao: {
    valor: "indicacao",
    label: "Indicação",
    ajuda: "Indicado por um cliente, arquiteto ou parceiro.",
    icone: "Users",
    cor: "bg-aura-petrol-500 text-white",
  },
};

export function rotuloOrigem(v: string | null | undefined): string {
  if (!v) return "Sem origem";
  return INFO_ORIGEM[v as OrigemLead]?.label ?? v;
}

export function ehOrigemValida(v: unknown): v is OrigemLead {
  return typeof v === "string" && (ORIGENS as readonly string[]).includes(v);
}
