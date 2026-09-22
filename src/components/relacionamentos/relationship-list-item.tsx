import type { Relacionamento } from "@/lib/types";

const COR_TEMPERATURA: Record<string, string> = {
  quente: "bg-aura-success",
  morno: "bg-aura-gold",
  esfriando: "bg-aura-warning",
  frio: "bg-aura-danger",
};

function iniciais(nome: string) {
  const partes = nome.replace(/^(Arq\.|Eng\.)\s*/, "").split(" ");
  return (partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "");
}

export function RelationshipListItem({
  relacionamento,
  ativo,
  onClick,
  vendedorNome,
}: {
  relacionamento: Relacionamento;
  ativo: boolean;
  onClick: () => void;
  vendedorNome?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
        ativo ? "bg-aura-petrol-700/8" : "hover:bg-aura-bg"
      }`}
    >
      <div className="relative shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-aura-petrol-700/10 font-display text-xs font-semibold text-aura-petrol-700">
          {iniciais(relacionamento.nome)}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
            COR_TEMPERATURA[relacionamento.temperatura]
          }`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-aura-graphite">
          {relacionamento.nome}
        </p>
        <p className="truncate text-xs text-aura-graphite-soft">
          {relacionamento.categoria} · {relacionamento.cidade}
          {vendedorNome ? ` · ${vendedorNome}` : ""}
        </p>
      </div>
    </button>
  );
}