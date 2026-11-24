/**
 * Sentinelas: agentes que vigiam a saúde do AURA todo dia.
 *
 * Nasceram da auditoria de 24/11/2026, que achou um padrão repetido: as
 * falhas mais caras do sistema eram SILENCIOSAS. O teto de gasto da IA que
 * nunca bloqueava, a busca no manual que voltava vazia, a leitura que falhava
 * e virava "nenhum cliente", o cron que podia parar sem ninguém saber. Nada
 * quebrava na tela; só ficava errado.
 *
 * Cada sentinela olha uma área e devolve achados. Elas não consertam nada
 * sozinhas e não usam IA (custo zero): conferem fatos no banco e avisam o
 * gestor mestre, que decide.
 */
export type Nivel = "ok" | "atencao" | "critico";

export interface Achado {
  nivel: Exclude<Nivel, "ok">;
  /** Frase curta e estável: é por ela que a sentinela sabe se o achado é novo. */
  titulo: string;
  detalhe: string;
  /** O que fazer, em uma linha. */
  acao?: string;
}

export interface ResultadoSentinela {
  sentinela: NomeSentinela;
  nivel: Nivel;
  achados: Achado[];
  resumo: string;
  /** Números que a sentinela quer lembrar para comparar na próxima rodada. */
  memoria?: Record<string, unknown>;
}

export type NomeSentinela = "operacao" | "dados" | "seguranca";

export const NOMES_DAS_SENTINELAS: Record<NomeSentinela, string> = {
  operacao: "Sentinela de Operação",
  dados: "Sentinela de Dados",
  seguranca: "Sentinela de Segurança",
};

export function nivelGeral(achados: Achado[]): Nivel {
  if (achados.some((a) => a.nivel === "critico")) return "critico";
  if (achados.length) return "atencao";
  return "ok";
}

export function horasAtras(horas: number, agora = new Date()): string {
  return new Date(agora.getTime() - horas * 3_600_000).toISOString();
}
