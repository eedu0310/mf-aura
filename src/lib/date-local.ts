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
  // Carimbo que ja traz o fuso ("...Z", "...+00:00") aponta um instante
  // exato: quem o traduz para Brasilia e o Intl, na hora de escrever.
  // Montar a data a mao aqui jogava fora o offset, entao o UTC do banco
  // entrava como hora local e a atividade das 07:32 aparecia como 10:32
  // em "Atividades Recentes". So data solta ("2026-09-28") continua sendo
  // montada no fuso do usuario, senao ela volta um dia.
  if (/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(valor.trim())) {
    const exato = new Date(valor);
    if (!Number.isNaN(exato.getTime())) return exato;
  }
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

/**
 * Quando uma coisa aconteceu, do jeito que se fala.
 *
 * O "Atividades Recentes" do Meu Dia mostrava o carimbo cru do banco —
 * "2026-09-24T13:43:45.423+00:00" na tela do vendedor.
 */
export function quandoAconteceu(valor?: string | null): string {
  if (!valor) return "";
  const data = parseDataLocal(valor);
  if (Number.isNaN(data.getTime())) return "";

  const diaDe = (d: Date) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
    }).format(d);
  const horaDe = (d: Date) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);

  const hoje = new Date();
  const ontem = new Date(hoje.getTime() - 86400_000);

  if (diaDe(data) === diaDe(hoje)) return horaDe(data);
  if (diaDe(data) === diaDe(ontem)) return `ontem ${horaDe(data)}`;

  const mesmoAno = data.getFullYear() === hoje.getFullYear();
  return mesmoAno
    ? diaDe(data)
    : new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      }).format(data);
}
