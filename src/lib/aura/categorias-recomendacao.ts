/**
 * As prioridades da Supervisora AURA, separadas por tipo.
 *
 * Antes era uma lista corrida: "Contatar Rudi", "Negócio parado há 13 dias",
 * "Aumentar o ritmo", "38 aprendizados precisam da sua decisão"... tudo
 * misturado, e o mesmo cliente aparecia duas vezes (a supervisão pedia
 * "Contatar" e o agente de follow-up avisava "Follow-up vencido"). Aqui cada
 * item ganha uma categoria, a lista sai em grupos na ordem do que é mais
 * urgente para a venda, e o cliente repetido aparece uma vez só.
 *
 * Sem banco: a rota e a tela usam as mesmas regras.
 */

export type Categoria =
  | "leads"
  | "conversas"
  | "followup"
  | "contatar"
  | "negocios"
  | "agenda"
  | "posvenda"
  | "cadastro"
  | "equipe"
  | "ritmo"
  | "outros";

export interface InfoCategoria {
  id: Categoria;
  nome: string;
  descricao: string;
}

/** Na ordem em que aparecem: o que esfria mais rápido vem primeiro. */
export const CATEGORIAS: InfoCategoria[] = [
  { id: "leads", nome: "Leads esperando resposta", descricao: "Quem chegou e ainda não foi atendido" },
  { id: "conversas", nome: "Conversas esperando", descricao: "Cliente aguardando resposta no WhatsApp ou Instagram" },
  { id: "followup", nome: "Follow-ups vencidos", descricao: "Retornos combinados que passaram da data" },
  { id: "negocios", nome: "Negócios parados", descricao: "Negociações sem movimento" },
  { id: "agenda", nome: "Agenda", descricao: "Compromissos para confirmar ou registrar" },
  { id: "contatar", nome: "Clientes para contatar", descricao: "Carteira sem contato recente" },
  { id: "posvenda", nome: "Pós-venda e manutenção", descricao: "Instalação, avaliação e limpeza anual" },
  { id: "cadastro", nome: "Cadastro para arrumar", descricao: "Clientes sem origem, telefone ou dono" },
  { id: "equipe", nome: "Gestão e equipe", descricao: "Resumos e avisos dos agentes para o gestor" },
  { id: "ritmo", nome: "Ritmo e rotina", descricao: "Orientações gerais da supervisão" },
  { id: "outros", nome: "Outros", descricao: "Demais recomendações" },
];

const ORDEM = new Map(CATEGORIAS.map((c, i) => [c.id, i]));
const PESO_PRIORIDADE: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };

/** Agentes que falam com o gestor sobre a equipe, não sobre um cliente. */
const AGENTES_DE_GESTAO = new Set([
  "diretora",
  "resumo-gestor",
  "revisor-aprendizado",
  "curador",
  "orcamento",
  "marketing",
  "metas",
  "guardiao",
  "cacador-brechas",
  "cacador-erros",
]);

export interface RecomendacaoBase {
  id: string;
  titulo: string;
  prioridade: string;
  agente?: string | null;
  entidade_tipo?: string | null;
  entidade_id?: string | null;
  criado_em?: string | null;
}

export function categoriaDe(r: RecomendacaoBase): Categoria {
  const agente = r.agente ?? "";
  const tipo = r.entidade_tipo ?? "";
  const titulo = (r.titulo ?? "").trim();
  if (agente === "leads" || tipo === "lead") return "leads";
  if (agente === "conversas") return "conversas";
  if (agente === "followup" && tipo !== "perfil") return "followup";
  if (agente === "pipeline" && tipo !== "perfil") return "negocios";
  if (agente === "agenda" || tipo === "compromisso") return "agenda";
  if (agente === "pos-venda" || agente === "manutencao" || tipo === "pos_venda") return "posvenda";
  if (agente === "qualidade") return "cadastro";
  if (AGENTES_DE_GESTAO.has(agente) || tipo === "perfil") return "equipe";
  if (agente === "reativacao") return "contatar";
  if (/^contatar\b/i.test(titulo) && tipo === "relacionamento") return "contatar";
  if (tipo === "relacionamento") return "followup";
  if (tipo === "oportunidade") return "negocios";
  if (!agente && !tipo) return "ritmo";
  return "outros";
}

/**
 * Mais urgente primeiro; empate, o mais novo. Estável para a tela não
 * "pular" a cada recarga.
 */
export function ordenarPorPrioridade<T extends RecomendacaoBase>(lista: T[]): T[] {
  return [...lista].sort(
    (a, b) =>
      (PESO_PRIORIDADE[a.prioridade] ?? 9) - (PESO_PRIORIDADE[b.prioridade] ?? 9) ||
      (b.criado_em ?? "").localeCompare(a.criado_em ?? "") ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Um cliente (ou negócio) aparece uma vez: fica o item mais urgente e, no
 * empate, o do agente (que traz o botão para agir) sobre o da supervisão.
 */
export function semRepetidos<T extends RecomendacaoBase>(lista: T[]): T[] {
  const melhor = new Map<string, T>();
  const soltos: T[] = [];
  for (const r of lista) {
    if (!r.entidade_tipo || !r.entidade_id || r.entidade_tipo === "perfil") {
      soltos.push(r);
      continue;
    }
    const chave = `${r.entidade_tipo}:${r.entidade_id}`;
    const atual = melhor.get(chave);
    if (!atual) {
      melhor.set(chave, r);
      continue;
    }
    const pa = PESO_PRIORIDADE[atual.prioridade] ?? 9;
    const pr = PESO_PRIORIDADE[r.prioridade] ?? 9;
    if (pr < pa || (pr === pa && !atual.agente && r.agente)) melhor.set(chave, r);
  }
  return [...soltos, ...melhor.values()];
}

export interface Grupo<T> {
  categoria: InfoCategoria;
  itens: T[];
  urgentes: number;
}

/** Separa por categoria, na ordem de CATEGORIAS, cada grupo do mais urgente ao menos. */
export function agruparPorCategoria<T extends RecomendacaoBase>(lista: T[]): Grupo<T>[] {
  const porCat = new Map<Categoria, T[]>();
  for (const r of semRepetidos(lista)) {
    const c = categoriaDe(r);
    const l = porCat.get(c) ?? [];
    l.push(r);
    porCat.set(c, l);
  }
  return [...porCat.entries()]
    .sort((a, b) => (ORDEM.get(a[0]) ?? 99) - (ORDEM.get(b[0]) ?? 99))
    .map(([id, itens]) => ({
      categoria: CATEGORIAS.find((c) => c.id === id)!,
      itens: ordenarPorPrioridade(itens),
      urgentes: itens.filter((i) => i.prioridade === "urgente" || i.prioridade === "alta").length,
    }));
}
