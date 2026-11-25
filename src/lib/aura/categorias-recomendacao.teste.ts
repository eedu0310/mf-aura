/**
 * Teste da separação das prioridades da Supervisora por tipo.
 * Rodar: npx tsx src/lib/aura/categorias-recomendacao.teste.ts
 */
import { agruparPorCategoria, categoriaDe, semRepetidos } from "./categorias-recomendacao";

let falhas = 0;
let total = 0;
function igual(a: unknown, b: unknown, o_que: string) {
  total++;
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    falhas++;
    console.error(`  FALHOU: ${o_que} (deu ${JSON.stringify(a)}, esperava ${JSON.stringify(b)})`);
  }
}

const r = (id: string, titulo: string, prioridade: string, extra: Record<string, string | null> = {}) => ({
  id,
  titulo,
  prioridade,
  agente: null,
  entidade_tipo: null,
  entidade_id: null,
  criado_em: "2026-11-25T10:00:00Z",
  ...extra,
});

console.log("Categorias da Supervisora:");
igual(categoriaDe(r("1", "Contatar Rudi", "media", { entidade_tipo: "relacionamento", entidade_id: "c1" })), "contatar", "supervisão: contatar cliente");
igual(categoriaDe(r("2", "Follow-up vencido: Ana", "alta", { agente: "followup", entidade_tipo: "relacionamento", entidade_id: "c2" })), "followup", "agente de follow-up");
igual(categoriaDe(r("3", "Follow-ups atrasados: 10 pessoas", "alta", { agente: "followup", entidade_tipo: "perfil" })), "equipe", "resumo de follow-up para o gestor vai para gestão");
igual(categoriaDe(r("4", "Negócio parado há 13 dias", "media", { agente: "pipeline", entidade_tipo: "oportunidade" })), "negocios", "negócio parado");
igual(categoriaDe(r("5", "Lead sem resposta há 1 h", "urgente", { agente: "leads", entidade_tipo: "lead" })), "leads", "lead esperando");
igual(categoriaDe(r("6", "Cliente esperando resposta", "alta", { agente: "conversas" })), "conversas", "conversa esperando");
igual(categoriaDe(r("7", "Aumentar o ritmo de execução", "media")), "ritmo", "orientação geral");
igual(categoriaDe(r("8", "Cadastro: 1 cliente sem origem", "baixa", { agente: "qualidade", entidade_tipo: "perfil" })), "cadastro", "cadastro");
igual(categoriaDe(r("9", "Gasto da IA disparou", "alta", { agente: "orcamento" })), "equipe", "aviso de orçamento é de gestão");

const repetidos = semRepetidos([
  r("a", "Contatar Ana", "media", { entidade_tipo: "relacionamento", entidade_id: "c2" }),
  r("b", "Follow-up vencido: Ana", "media", { agente: "followup", entidade_tipo: "relacionamento", entidade_id: "c2" }),
  r("c", "Aumentar o ritmo", "baixa"),
]);
igual(repetidos.map((x) => x.id).sort(), ["b", "c"], "cliente repetido fica uma vez, preferindo o card do agente");

const grupos = agruparPorCategoria([
  r("x1", "Contatar Rudi", "baixa", { entidade_tipo: "relacionamento", entidade_id: "c1" }),
  r("x2", "Lead sem resposta", "urgente", { agente: "leads", entidade_tipo: "lead", entidade_id: "l1" }),
  r("x3", "Contatar Bia", "alta", { entidade_tipo: "relacionamento", entidade_id: "c3" }),
]);
igual(grupos.map((g) => g.categoria.id), ["leads", "contatar"], "grupos na ordem do mais urgente para a venda");
igual(grupos[1].itens.map((i) => i.id), ["x3", "x1"], "dentro do grupo, o mais urgente primeiro");
igual(grupos[1].urgentes, 1, "conta urgentes e altas do grupo");

console.log(`  ${total - falhas}/${total} conferências ok`);
if (falhas) process.exit(1);
