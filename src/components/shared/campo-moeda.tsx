"use client";

import { agruparDigitos, digitosParaNumero, escreverValor } from "@/lib/formato/moeda";

interface CampoMoedaProps {
  /** Só dígitos. Quem usa guarda a string crua e lê o número com digitosParaNumero. */
  valor: string;
  onChange: (digitos: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  autoFocus?: boolean;
}

/**
 * Campo de dinheiro em reais inteiros.
 *
 * Guarda só dígitos e mostra agrupado, então o que a pessoa lê é exatamente o
 * que vai ser salvo. `type="text"` com `inputMode="numeric"` abre o teclado
 * numérico no celular sem herdar o parse de `type="number"`, que trata ponto
 * como separador decimal e transformaria "200.000" em 200.
 */
export function CampoMoeda({
  valor,
  onChange,
  id,
  placeholder,
  className,
  required,
  autoFocus,
}: CampoMoedaProps) {
  const numero = digitosParaNumero(valor);
  const extenso = escreverValor(numero);
  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-aura-graphite-soft">
          R$
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          required={required}
          value={agruparDigitos(valor)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          placeholder={placeholder ?? "200.000"}
          className={
            className ??
            "w-full rounded-lg border border-aura-mist py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-aura-petrol-500"
          }
        />
      </div>
      {extenso && (
        <p className="mt-1 text-xs font-medium text-aura-petrol-700">{extenso}</p>
      )}
    </div>
  );
}
