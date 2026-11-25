/**
 * A planta do escritório em pixel e a cara dos agentes (contas puras).
 *
 * Rodar com:
 *   node --experimental-strip-types --no-warnings --import <reg.mjs> src/components/agentes/escritorio-pixel/planta.teste.ts
 */
import { CEL_A, CEL_L, colunasDaSala, lugaresPorAgente, montarPlanta, salaDoAgente, type AgenteNaPlanta, type Planta } from "./planta";
import { apelido, aparenciaDoAgente, balaoDoAgente, escurecer, hashTexto, BLAZER_DIRETORA } from "./aparencia";

let passou = 0;
const falhas: string[] = [];
function conferir(oque: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) passou += 1;
  else falhas.push(`${oque}\n  esperado: ${b}\n  veio:     ${a}`);
}

/** A equipe de hoje (28 mesas): Diretora, 9 em vendas, 2 pós-venda, 1 marketing, 7 gestão, 5 conhecimento, 3 dados. */
const EQUIPE: AgenteNaPlanta[] = [
  { id: "followup", setor: "vendas" },
  { id: "diretora", setor: "direcao", chefe: true },
  ...["leads", "agenda", "pipeline", "reativacao", "sistema-briefing", "sistema-repasse", "sistema-instagram", "sistema-chat-site"].map(
    (id) => ({ id, setor: "vendas" }),
  ),
  { id: "pos-venda", setor: "pos-venda" },
  { id: "manutencao", setor: "pos-venda" },
  { id: "marketing", setor: "marketing" },
  ...["metas", "orcamento", "resumo-gestor", "sistema-supervisao", "sistema-cobranca", "sistema-metas", "sistema-relatorios"].map((id) => ({
    id,
    setor: "gestao",
  })),
  ...["conversas", "curador", "revisor-aprendizado", "sistema-aprendizado", "guardiao"].map((id) => ({ id, setor: "conhecimento" })),
  ...["qualidade", "sistema-sentinela", "sistema-backup"].map((id) => ({ id, setor: "dados" })),
];

function sobrepoe(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function conferirPlanta(nome: string, p: Planta, agentes: AgenteNaPlanta[]) {
  // Toda sala dentro do prédio, sem sobrepor outra, e o prédio todo coberto.
  let area = 0;
  for (const s of p.salas) {
    area += s.w * s.h;
    if (s.x < 0 || s.y < 0 || s.x + s.w > p.largura || s.y + s.h > p.altura) falhas.push(`${nome}: sala ${s.id} fora do prédio`);
    for (const t of p.salas) if (t !== s && sobrepoe(s, t)) falhas.push(`${nome}: ${s.id} sobrepõe ${t.id}`);
  }
  conferir(`${nome}: prédio sem buraco`, area, p.largura * p.altura);
  // Cada agente com exatamente uma mesa, e a mesa dentro da sala dele.
  const lugares = lugaresPorAgente(p);
  conferir(`${nome}: todo agente tem mesa`, agentes.every((a) => lugares.has(a.id)), true);
  conferir(`${nome}: uma mesa por agente`, lugares.size, agentes.length);
  for (const a of agentes) {
    const l = lugares.get(a.id);
    if (!l) continue;
    const sala = p.salas.find((s) => s.id === l.sala)!;
    if (l.sala !== salaDoAgente(a.setor)) falhas.push(`${nome}: ${a.id} na sala errada (${l.sala})`);
    if (l.x < sala.x + 1 || l.y < sala.y + 1 || l.x + CEL_L > sala.x + sala.w || l.y + CEL_A > sala.y + sala.h - 1) {
      falhas.push(`${nome}: mesa de ${a.id} vaza da sala ${sala.id}`);
    }
  }
  // Móvel nenhum em cima de mesa, de outro móvel ou fora da sala (tapete é chão: pode).
  for (const s of p.salas) {
    const solidos = s.decor.filter((d) => d.tipo !== "tapete");
    for (const d of solidos) {
      if (d.x < s.x || d.y < s.y + 1 || d.x + d.w > s.x + s.w || d.y + d.h > s.y + s.h - 1) {
        falhas.push(`${nome}: ${d.tipo} vaza da sala ${s.id} (${JSON.stringify(d)})`);
      }
      for (const l of s.lugares) {
        if (sobrepoe(d, { x: l.x, y: l.y, w: CEL_L, h: CEL_A })) falhas.push(`${nome}: ${d.tipo} em cima de uma mesa em ${s.id}`);
      }
      for (const e of solidos) if (e !== d && sobrepoe(d, e)) falhas.push(`${nome}: ${d.tipo} sobre ${e.tipo} em ${s.id}`);
    }
  }
}

// ---- a equipe de hoje
const planta = montarPlanta(EQUIPE);
conferirPlanta("equipe de hoje", planta, EQUIPE);
conferir(
  "salas na ordem fixa, uma por setor + Copa",
  planta.salas.map((s) => s.id),
  ["direcao", "vendas", "pos-venda", "marketing", "gestao", "conhecimento", "dados", "copa"],
);
const vendas = planta.salas.find((s) => s.id === "vendas")!;
conferir(
  "Sala de Vendas é a maior em mesas",
  planta.salas.every((s) => s.lugares.length <= vendas.lugares.length),
  true,
);
conferir("vendas: 9 agentes em 3×3", [vendas.cols, vendas.rows], [3, 3]);
const diretoria = planta.salas.find((s) => s.id === "direcao")!;
conferir("a Diretora senta na mesa de chefe", diretoria.lugares[0], { x: diretoria.x + 1, y: diretoria.y + 1, agenteId: "diretora", chefe: true });
conferir("tapete embaixo da mesa da chefe", diretoria.decor.some((d) => d.tipo === "tapete"), true);
conferir("biblioteca tem estante", planta.salas.find((s) => s.id === "conhecimento")!.decor.some((d) => d.tipo === "estante"), true);
conferir("sala de dados tem rack", planta.salas.find((s) => s.id === "dados")!.decor.some((d) => d.tipo === "servidor"), true);
const copa = planta.salas.find((s) => s.id === "copa")!;
conferir("Copa tem mesa redonda e balcão", ["mesa-redonda", "balcao"].every((t) => copa.decor.some((d) => d.tipo === t)), true);
conferir("Copa não tem mesa de trabalho", copa.lugares.length, 0);

// A Equipe Vermelha (setor "seguranca") ganha sala própria, antes de Outros e da Copa.
const comVermelha: AgenteNaPlanta[] = [...EQUIPE, { id: "cacador-brechas", setor: "seguranca" }, { id: "cacador-erros", setor: "seguranca" }];
const plantaVermelha = montarPlanta(comVermelha);
conferirPlanta("equipe com a Equipe Vermelha", plantaVermelha, comVermelha);
conferir("sala da Equipe Vermelha entra depois de Dados", plantaVermelha.salas.map((s) => s.id).slice(-3), ["dados", "seguranca", "copa"]);
conferir("caçadores na sala deles", salaDoAgente("seguranca"), "seguranca");
conferir("prédio mais largo que alto", planta.largura > planta.altura, true);
conferir("porta: primeira sala da fileira não tem porta à esquerda", diretoria.portaEsquerda, null);
conferir("fileira de cima tem janelas, as outras têm porta no topo", [diretoria.portaTopo, copa.portaTopo !== null], [null, true]);
conferir("janela só na parede de fora", planta.salas.filter((s) => s.y > 0).every((s) => s.parede.every((i) => i.tipo !== "janela")), true);
conferir("mesmos agentes, mesma planta", JSON.stringify(montarPlanta(EQUIPE)), JSON.stringify(planta));

// ---- equipe mínima e casos de borda
const so1 = [{ id: "diretora", setor: "direcao", chefe: true }];
conferirPlanta("só a Diretora", montarPlanta(so1), so1);
const estranho = [
  { id: "x", setor: "financeiro" },
  { id: "y", setor: "vendas" },
];
const pEstranho = montarPlanta(estranho);
conferirPlanta("setor desconhecido", pEstranho, estranho);
conferir("setor desconhecido vai para Outros", lugaresPorAgente(pEstranho).get("x")?.sala, "outros");
const muitos = Array.from({ length: 23 }, (_, i) => ({ id: `v${i}`, setor: "vendas" }));
const pMuitos = montarPlanta(muitos);
conferirPlanta("23 em vendas", pMuitos, muitos);
conferir("23 em vendas: 4 colunas, a sala cresce para baixo", [pMuitos.salas[0].cols, pMuitos.salas[0].rows], [4, 6]);
conferir("colunas por quantidade", [1, 2, 4, 5, 9, 10, 30].map((n) => colunasDaSala(n, 4)), [1, 2, 2, 3, 3, 4, 4]);
conferir("teto de colunas do molde", colunasDaSala(9, 2), 2);
conferirPlanta("ninguém", montarPlanta([]), []);

// ---- aparência
conferir("hash estável", hashTexto("followup"), hashTexto("followup"));
conferir("ids diferentes, hashes diferentes", hashTexto("followup") !== hashTexto("leads"), true);
conferir("mesma cara sempre", aparenciaDoAgente("leads"), aparenciaDoAgente("leads"));
const diretora = aparenciaDoAgente("diretora", { chefe: true });
conferir("Diretora: blazer próprio e cabelo longo", [diretora.camisa, diretora.penteado, diretora.chefe, diretora.oculos], [BLAZER_DIRETORA, "longo", true, false]);
const caras = new Set(EQUIPE.map((a) => JSON.stringify(aparenciaDoAgente(a.id))));
conferir("a equipe não é um exército de clones (≥ 20 caras diferentes em 28)", caras.size >= 20, true);
conferir("escurecer", escurecer("#ffffff", 0.5), "#808080");
conferir("escurecer ignora cor inválida", escurecer("azul"), "azul");

// ---- crachá
conferir(
  "apelidos",
  [
    "Analista de Follow-up",
    "Guardião dos Leads",
    "AURA Diretora",
    "Secretária de Agenda",
    "Briefing do dia",
    "Assistente do chat do site",
    "Curador do Conhecimento",
    "Sentinelas",
    "",
  ].map((n) => apelido(n)),
  ["Follow-up", "Leads", "Diretora", "Agenda", "Briefing", "Chat do site", "Curador", "Sentinelas", "Agente"],
);
conferir("apelido nunca passa do limite", ["Supercalifragilisticexpialidoso", "Abcdefghijklmnopq rst"].map((n) => apelido(n).length <= 12), [true, true]);

// ---- balão
const agora = Date.parse("2026-11-25T15:00:00Z");
const ha = (min: number) => new Date(agora - min * 60_000).toISOString();
conferir("trabalhando digita", balaoDoAgente({ id: "a", estado: "trabalhando" }, [], agora), { tipo: "digitando" });
conferir(
  "falou há 10 min",
  balaoDoAgente({ id: "a", estado: "ocioso" }, [{ de: "a", tipo: "ideia", criadoEm: ha(10) }], agora),
  { tipo: "fala", texto: "Tive uma ideia", falaTipo: "ideia" },
);
conferir(
  "a fala mais nova vence",
  balaoDoAgente(
    { id: "a", estado: "ocioso" },
    [
      { de: "a", tipo: "ideia", criadoEm: ha(20) },
      { de: "a", tipo: "alerta", criadoEm: ha(2) },
    ],
    agora,
  ),
  { tipo: "fala", texto: "Atenção!", falaTipo: "alerta" },
);
conferir("fala de 40 min atrás não aparece", balaoDoAgente({ id: "a", estado: "ocioso" }, [{ de: "a", tipo: "relato", criadoEm: ha(40) }], agora), null);
conferir("fala de outro agente não conta", balaoDoAgente({ id: "a", estado: "ocioso" }, [{ de: "b", tipo: "relato", criadoEm: ha(1) }], agora), null);
conferir(
  "aguardando ativação não fala",
  balaoDoAgente({ id: "a", estado: "aguardando_ativacao" }, [{ de: "a", tipo: "relato", criadoEm: ha(1) }], agora),
  null,
);

if (falhas.length) {
  console.error(`${falhas.length} verificação(ões) falharam:\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}
console.log(`${passou}/${passou} verificações passaram`);
if (process.argv.includes("--mostrar")) {
  console.log(`prédio ${planta.largura}×${planta.altura}`);
  for (const s of planta.salas) {
    console.log(
      `${s.id.padEnd(13)} x${s.x} y${s.y} ${s.w}×${s.h}  mesas ${s.cols}×${s.rows}  móveis: ${s.decor.map((d) => d.tipo).join(", ")}  parede: ${s.parede.map((i) => i.tipo).join(", ")}`,
    );
  }
}
