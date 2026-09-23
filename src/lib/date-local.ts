/**
 * Saudação do dia no horário de Brasília.
 *
 * O servidor roda em UTC e o navegador no fuso do usuário. Calculando a hora
 * sempre no mesmo fuso, os dois chegam ao mesmo texto e o React não acusa
 * mais o erro de hidratação ("o servidor escreveu Bom dia e o navegador
 * Boa tarde").
 */
export function saudacaoDoDia(agora: Date = new Date()): string {
  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "numeric",
      hour12: false,
    }).format(agora),
  );
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

export function parseDataLocal(valor?: string | null): Date {
  if (!valor) return new Date(NaN);
  const [data, hora] = valor.split("T");
  const partes = data?.split("-").map(Number);
  if (!partes || partes.length !== 3 || partes.some(Number.isNaN)) return new Date(valor);
  const [ano, mes, dia] = partes;
  if (hora) {
    const [h, m = 0] = hora.replace("Z", "").split(":").map(Number);
    return new Date(ano, mes - 1, dia, h || 0, m || 0);
  }
  return new Date(ano, mes - 1, dia);
}
