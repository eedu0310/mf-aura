/**
 * Logo da AURA.
 *
 * O texto acompanha o tema (escuro no claro, claro no escuro). Antes ele era
 * branco fixo e sumia em fundo claro — a página de avaliação que o CLIENTE
 * abre mostrava só o triângulo, sem o nome.
 *
 * `sobreEscuro` é para faixas que são escuras nos dois temas.
 */
export function AuraLogoFull({ sobreEscuro = false, compacto = false }: { sobreEscuro?: boolean; compacto?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={compacto ? 26 : 30} height={compacto ? 26 : 30} viewBox="0 0 34 34" fill="none" aria-hidden="true">
        <rect width="34" height="34" rx="9" className="aura-logo-quadro fill-aura-petrol-600" />
        <path d="M17 8 L26.5 25.5 H7.5 Z" fill="none" stroke="#F1D58F" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M17 14.5 L22.8 25.5 H11.2 Z" fill="#F1D58F" />
      </svg>
      {!compacto && (
        <div className="leading-none">
          <p className={`font-display text-[0.95rem] font-semibold tracking-tight ${sobreEscuro ? "text-white" : "text-aura-graphite"}`}>
            AURA
          </p>
          <p className={`mt-0.5 text-[0.6rem] font-medium uppercase tracking-[0.16em] ${sobreEscuro ? "text-white/50" : "text-aura-graphite-soft"}`}>
            Sales OS
          </p>
        </div>
      )}
    </div>
  );
}
