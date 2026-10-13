/**
 * Dinheiro em um lugar só.
 *
 * O campo de meta de faturamento era um `<input type="number">` cru. Isso tem
 * dois defeitos que confundem quem preenche:
 *
 *   1. Em HTML o ponto é separador DECIMAL. Quem digita "200.000" achando que
 *      escreveu duzentos mil está salvando duzentos.
 *   2. O campo não agrupa milhar. Quem digita "200000" olha para uma fileira de
 *      zeros e não tem como conferir se são cinco ou seis antes de salvar.
 *
 * A correção não é um parse mais esperto: é o campo mostrar, enquanto a pessoa
 * digita, o número que vai para o banco — agrupado e escrito por extenso.
 * Metas são valores redondos, então trabalhamos em reais inteiros e não em
 * centavos: máscara de centavos é justamente a que produz erro de fator 100.
 */

export function formatarReais(valor: number, comCentavos = false): string {
  const n = Number.isFinite(valor) ? valor : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: comCentavos ? 2 : 0,
    maximumFractionDigits: comCentavos ? 2 : 0,
  }).format(n);
}

/** Só os dígitos, agrupados como o pt-BR escreve. "200000" -> "200.000" */
export function agruparDigitos(texto: string): string {
  const digitos = String(texto ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digitos) return "";
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function digitosParaNumero(texto: string): number {
  const digitos = String(texto ?? "").replace(/\D/g, "");
  if (!digitos) return 0;
  const n = Number(digitos);
  return Number.isSafeInteger(n) ? n : 0;
}

/**
 * O valor por extenso, curto. É a trava contra zero sobrando: quem queria
 * duzentos mil e digitou um zero a mais lê "2 milhões de reais" embaixo do
 * campo e corrige antes de salvar.
 */
export function escreverValor(valor: number): string {
  if (!Number.isFinite(valor) || valor <= 0) return "";
  const enxugar = (n: number, casas: number) =>
    (Number.isInteger(n) ? String(n) : n.toFixed(casas).replace(/0+$/, "").replace(/\.$/, ""))
      .replace(".", ",");
  if (valor >= 1_000_000_000) return `${enxugar(valor / 1_000_000_000, 2)} bilhões de reais`;
  if (valor >= 1_000_000) {
    const m = valor / 1_000_000;
    return `${enxugar(m, 2)} ${m === 1 ? "milhão" : "milhões"} de reais`;
  }
  if (valor >= 1_000) return `${enxugar(valor / 1_000, 1)} mil reais`;
  return `${valor} ${valor === 1 ? "real" : "reais"}`;
}
