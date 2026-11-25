/**
 * As regras da Equipe Vermelha (equipe-vermelha-regras.ts): ler o esquema,
 * classificar a sondagem, conferir links e crons. Errar aqui é alarme falso
 * no Meu Dia dos gestores mestres — ou brecha que passa calada.
 *
 * Rodar com:
 *   node --experimental-strip-types --no-warnings --import <reg.mjs> src/lib/agentes/nativos/equipe-vermelha.teste.ts
 */
import {
  assinaturaDoErro,
  classificarSondagem,
  cronAtrasado,
  funcoesDoEsquema,
  linkDeTelaValido,
  ordenarRiscos,
  politicaAbertaAoPublico,
  politicasDoEsquema,
  viraCard,
  type Risco,
} from "./equipe-vermelha-regras";

let passou = 0;
const falhas: string[] = [];
function conferir(oque: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) passou += 1;
  else falhas.push(`${oque}\n  esperado: ${b}\n  veio:     ${a}`);
}

// ---- políticas (formato da aura_esquema_ddl)
const ddl = [
  'create policy "Vendors can read their own" on public.agent_notifications as permissive for select to public using ((( SELECT auth.uid() AS uid) = vendor_id));',
  "create policy config_avaliacao_ler on public.config_avaliacao as permissive for select to authenticated using (true);",
  'create policy "Aberta geral" on public.segredos as permissive for select to anon, authenticated using (true);',
  'create policy "Grava qualquer um" on public.formulario as permissive for insert to public with check (true);',
  'create policy "Atualiza" on public.atividades as permissive for update to public using ((owner_id = ( SELECT auth.uid() AS uid))) with check ((owner_id = auth.uid()));',
  'create policy "Restritiva" on public.x as restrictive for select to anon using (true);',
  'create policy "Multilinha" on public.metas as permissive for all to public using ((EXISTS ( SELECT 1',
  '   FROM profiles p',
  '  WHERE (p.id = auth.uid()))));',
  "",
  "CREATE OR REPLACE FUNCTION public.administro_a_loja(p_empresa text)",
  " RETURNS boolean",
  " LANGUAGE sql",
  " STABLE SECURITY DEFINER",
  " SET search_path TO 'public'",
  "AS $function$",
  "  select true;",
  "$function$",
  ";",
  "CREATE OR REPLACE FUNCTION public.perigosa(p uuid)",
  " RETURNS jsonb",
  " LANGUAGE plpgsql",
  " SECURITY DEFINER",
  "AS $function$ begin return null; end $function$;",
  "CREATE OR REPLACE FUNCTION public.toca()",
  " RETURNS trigger",
  " LANGUAGE plpgsql",
  " SECURITY DEFINER",
  " SET search_path TO 'public'",
  "AS $function$ begin return new; end $function$;",
  "revoke execute on function public.administro_a_loja(p_empresa text) from public; grant execute on function public.administro_a_loja(p_empresa text) to authenticated, postgres, service_role;",
  "revoke execute on function public.perigosa(p uuid) from public; grant execute on function public.perigosa(p uuid) to PUBLIC, anon, authenticated;",
  "revoke execute on function public.toca() from public; grant execute on function public.toca() to PUBLIC, anon;",
].join("\n");

const politicas = politicasDoEsquema(ddl);
conferir("lê as permissivas (a restritiva fica de fora)", politicas.map((p) => p.tabela), [
  "agent_notifications",
  "config_avaliacao",
  "segredos",
  "formulario",
  "atividades",
  "metas",
]);
conferir("papéis em minúsculas", politicas.find((p) => p.tabela === "segredos")?.papeis, ["anon", "authenticated"]);
conferir(
  "abertas ao público: só a do anon com true e o insert com check true",
  politicas.filter(politicaAbertaAoPublico).map((p) => p.tabela),
  ["segredos", "formulario"],
);
conferir("política em várias linhas é lida inteira", politicas.find((p) => p.tabela === "metas")?.comando, "all");
conferir("authenticated com true não é 'público'", politicaAbertaAoPublico(politicas[1]), false);

const funcoes = funcoesDoEsquema(ddl);
const f = (n: string) => funcoes.find((x) => x.nome === n);
conferir("definer com search_path", [f("administro_a_loja")?.definer, f("administro_a_loja")?.comSearchPath], [true, true]);
conferir("definer SEM search_path", [f("perigosa")?.definer, f("perigosa")?.comSearchPath], [true, false]);
conferir("quem executa a perigosa", f("perigosa")?.executam, ["public", "anon", "authenticated"]);
conferir("gatilho marcado", f("toca")?.gatilho, true);
conferir("administro_a_loja não é do anon", f("administro_a_loja")?.executam.includes("anon"), false);

// ---- sondagem
conferir("401 protegida", classificarSondagem(401), "protegida");
conferir("403 protegida", classificarSondagem(403), "protegida");
conferir("307 para o login é protegida", classificarSondagem(307, "/login?volta=/gestor"), "protegida");
conferir("200 sem login é aberta", classificarSondagem(200), "aberta");
conferir("500 é erro do servidor", classificarSondagem(500), "erro_servidor");
conferir("404 sumiu", classificarSondagem(404), "sumiu");
conferir("0 sem resposta", classificarSondagem(0), "sem_resposta");
conferir("302 para outro lugar é estranho", classificarSondagem(302, "https://fora.com"), "estranho");

// ---- links dos cards
conferir("link com query", linkDeTelaValido("/relacionamentos?id=abc"), true);
conferir("gestor com aba", linkDeTelaValido("/gestor?aba=aprendizado"), true);
conferir("pós-venda com seção", linkDeTelaValido("/pos-venda?secao=manutencoes"), true);
conferir("registrar atividade", linkDeTelaValido("/registrar-atividade"), true);
conferir("tela que não existe", linkDeTelaValido("/clientes"), false);
conferir("link externo", linkDeTelaValido("https://fora.com"), false);
conferir("// também é externo", linkDeTelaValido("//fora.com"), false);
conferir("vazio vale", linkDeTelaValido(null), true);
conferir("prefixo dinâmico", linkDeTelaValido("/avaliar/xyz"), true);
conferir("prefixo sem o pedaço", linkDeTelaValido("/avaliar/"), false);

// ---- crons
const agora = new Date("2026-11-25T15:00:00-03:00");
conferir("nunca rodou", cronAtrasado("backup", null, agora), "nunca");
conferir("backup ontem 22h: ok", cronAtrasado("backup", "2026-11-24T22:00:00-03:00", agora), null);
conferir("backup há 3 dias: parou", cronAtrasado("backup", "2026-11-22T22:00:00-03:00", agora), "parou");
conferir("agentes há 2 h: parou", cronAtrasado("agentes", "2026-11-25T13:00:00-03:00", agora), "parou");
conferir("cron que não está na lista", cronAtrasado("inventado", null, agora), null);

// ---- erros parecidos contam uma vez
conferir(
  "assinatura ignora números e ids",
  assinaturaDoErro("Resposta cortada no limite de 2500 tokens"),
  assinaturaDoErro("Resposta cortada no limite de 6000 tokens"),
);

// ---- ordem e corte
const r = (chave: string, severidade: Risco["severidade"]): Risco => ({ chave, severidade, titulo: chave, detalhe: "", comoArrumar: "" });
conferir("mais grave primeiro, depois pela chave", ordenarRiscos([r("b", "media"), r("z", "urgente"), r("a", "media")]).map((x) => x.chave), ["z", "a", "b"]);
conferir("só alta e urgente viram card", [r("a", "urgente"), r("b", "alta"), r("c", "media"), r("d", "baixa")].map(viraCard), [true, true, false, false]);

if (falhas.length) {
  console.error(`${falhas.length} verificação(ões) falharam:\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}
console.log(`${passou}/${passou} verificações passaram`);
