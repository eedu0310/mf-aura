/**
 * Peças pequenas e puras do motor dos agentes (testáveis sem banco).
 */

/**
 * A tabela (ou a coluna) ainda não existe no banco?
 *
 * É o sinal de que a migração 110 não foi aplicada. Nesse caso o motor
 * responde "aguardando migração 110" em vez de lançar erro: o cron continua
 * verde, a tela mostra a equipe com o aviso, e nada fica meio gravado.
 *
 *   42P01     relação não existe (Postgres)
 *   42703     coluna não existe (Postgres)
 *   PGRST205  tabela fora do cache de esquema do PostgREST
 *   PGRST204  coluna fora do cache de esquema do PostgREST
 */
export function faltaNoBanco(erro: { code?: string; message?: string } | null | undefined): boolean {
  if (!erro) return false;
  const codigo = String(erro.code ?? "");
  if (["42P01", "42703", "PGRST205", "PGRST204"].includes(codigo)) return true;
  const msg = String(erro.message ?? "");
  return /does not exist|could not find the (table|.*column)|schema cache/i.test(msg);
}

export const MOTIVO_SEM_108 =
  "Aguardando a migração 110 no banco: a equipe aparece, mas ninguém trabalha até ela ser aplicada.";

/**
 * Lê o JSON que a IA devolveu, sem confiar nela.
 *
 * Tira cerca de código, pega do primeiro "{" (ou "[") ao último "}" (ou "]")
 * e tenta o parse. Lista vira { itens: [...] }, para quem chama sempre receber
 * um objeto. Qualquer coisa fora disso vira null — nunca lança.
 */
export function lerJsonDaIA(texto: string | null | undefined): Record<string, unknown> | null {
  if (!texto) return null;
  const limpo = texto.replace(/^\s*```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const tentativas: string[] = [];
  const iObj = limpo.indexOf("{");
  const fObj = limpo.lastIndexOf("}");
  if (iObj !== -1 && fObj > iObj) tentativas.push(limpo.slice(iObj, fObj + 1));
  const iLista = limpo.indexOf("[");
  const fLista = limpo.lastIndexOf("]");
  if (iLista !== -1 && fLista > iLista) tentativas.push(limpo.slice(iLista, fLista + 1));
  // Se a lista vem antes do objeto, ela é a resposta (o objeto está dentro dela).
  if (iLista !== -1 && (iObj === -1 || iLista < iObj)) tentativas.reverse();
  for (const t of tentativas) {
    try {
      const v: unknown = JSON.parse(t);
      if (Array.isArray(v)) return { itens: v };
      if (v && typeof v === "object") return v as Record<string, unknown>;
    } catch {
      /* tenta a próxima forma */
    }
  }
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function ehUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

/**
 * Os números de um texto, normalizados ("1.234,5" → "1234.5", "12%" → "12").
 * Serve para conferir a regra 5 do contrato: número em texto de IA tem de
 * ter vindo dos dados de entrada.
 */
export function numerosDoTexto(texto: string): string[] {
  const achados = texto.match(/\d[\d.,]*/g) ?? [];
  return achados
    .map((n) => n.replace(/[.,]$/, ""))
    .map((n) => {
      // "1.234" e "1.234,56" (pt-BR): ponto é milhar, vírgula é decimal.
      if (/,\d+$/.test(n)) return n.replace(/\./g, "").replace(",", ".");
      if (/^\d{1,3}(\.\d{3})+$/.test(n)) return n.replace(/\./g, "");
      return n.replace(/,/g, "");
    })
    .map((n) => String(Number(n)))
    .filter((n) => n !== "NaN");
}

/**
 * Todo número do texto está entre os permitidos? Datas e horas do próprio
 * dia (dia do mês, hora do plano) entram na lista de quem chama.
 */
export function numerosConferem(texto: string, permitidos: Iterable<number | string>): boolean {
  const ok = new Set<string>();
  for (const p of permitidos) {
    const n = Number(p);
    if (Number.isFinite(n)) {
      ok.add(String(n));
      ok.add(String(Math.round(n)));
    }
  }
  return numerosDoTexto(texto).every((n) => ok.has(n));
}

/** "id-legivel" a partir de um nome: sem acento, minúsculo, só letra/número/hífen. */
export function slug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
