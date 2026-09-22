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
