export function agoraIso() {
  return new Date().toISOString();
}

export function prazoParaIso(valor: string | null | undefined) {
  if (!valor || valor === "a definir") return undefined;

  const prazo = valor.match(/^(\d+)\s+dias?$/i);
  if (prazo) {
    const data = new Date();
    data.setDate(data.getDate() + Number(prazo[1]));
    data.setHours(9, 0, 0, 0);
    return data.toISOString();
  }

  const brasileira = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brasileira) {
    const [, dia, mes, ano] = brasileira;
    const data = new Date(
      Number(ano),
      Number(mes) - 1,
      Number(dia),
      9,
      0,
      0,
      0,
    );
    return Number.isNaN(data.getTime()) ? undefined : data.toISOString();
  }

  const isoData = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoData) {
    const [, ano, mes, dia] = isoData;
    const data = new Date(Number(ano), Number(mes) - 1, Number(dia), 12, 0, 0, 0);
    return Number.isNaN(data.getTime()) ? undefined : data.toISOString();
  }

  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? undefined : data.toISOString();
}

export function dataHoraLocalParaIso(data: string, hora = "12:00") {
  const resultado = new Date(`${data}T${hora}:00`);
  return Number.isNaN(resultado.getTime())
    ? new Date().toISOString()
    : resultado.toISOString();
}

export function moedaParaNumero(valor: string) {
  const limpo = valor.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  if (!limpo) return 0;

  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;
  const numero = Number(normalizado.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numero) ? numero : 0;
}
