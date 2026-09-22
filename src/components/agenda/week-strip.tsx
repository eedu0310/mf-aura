"use client";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function paraChaveISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function WeekStrip({
  dataSelecionada,
  onSelecionar,
  contagemPorDia,
}: {
  dataSelecionada: string;
  onSelecionar: (data: string) => void;
  contagemPorDia: Record<string, number>;
}) {
  const hoje = new Date();
  const inicioDaSemana = new Date(hoje);
  inicioDaSemana.setDate(hoje.getDate() - hoje.getDay());

  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicioDaSemana);
    d.setDate(inicioDaSemana.getDate() + i);
    return d;
  });

  const chaveHoje = paraChaveISO(hoje);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {dias.map((d) => {
        const chave = paraChaveISO(d);
        const selecionado = chave === dataSelecionada;
        const ehHoje = chave === chaveHoje;
        const qtd = contagemPorDia[chave] ?? 0;

        return (
          <button
            key={chave}
            type="button"
            onClick={() => onSelecionar(chave)}
            className={`flex min-w-16 flex-col items-center gap-1 rounded-2xl border px-3 py-2.5 transition ${
              selecionado
                ? "border-aura-petrol-700 bg-aura-petrol-700 text-white"
                : "border-aura-mist bg-white text-aura-graphite hover:border-aura-petrol-500/50"
            }`}
          >
            <span
              className={`text-[0.65rem] uppercase tracking-wide ${
                selecionado ? "text-white/70" : "text-aura-graphite-soft"
              }`}
            >
              {DIAS_SEMANA[d.getDay()]}
            </span>
            <span className="font-display text-base font-semibold">{d.getDate()}</span>
            {ehHoje && !selecionado && (
              <span className="h-1 w-1 rounded-full bg-aura-petrol-500" />
            )}
            {qtd > 0 && (
              <span
                className={`text-[0.6rem] ${
                  selecionado ? "text-white/70" : "text-aura-graphite-soft"
                }`}
              >
                {qtd}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
