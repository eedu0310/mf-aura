/**
 * Quem anda para onde no escritório (contas puras).
 *
 * Rodar com:
 *   node --experimental-strip-types --no-warnings --import <reg.mjs> src/components/agentes/escritorio-pixel/movimento.teste.ts
 */
import { lugaresPorAgente, montarPlanta, type AgenteNaPlanta } from "./planta";
import {
  caminho,
  escolherLazer,
  ladrilhoDaMesa,
  ladrilhosDeVisita,
  montarMalha,
  pisavel,
  pontosDeLazer,
  rodadaDeLugar,
  TROCA_DE_LUGAR_MS,
} from "./movimento";

let passou = 0;
const falhas: string[] = [];
function conferir(oque: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) passou += 1;
  else falhas.push(`${oque}\n  esperado: ${b}\n  veio:     ${a}`);
}

const EQUIPE: AgenteNaPlanta[] = [
  { id: "diretora", setor: "direcao", chefe: true },
  ...["followup", "leads", "agenda", "pipeline", "reativacao", "sistema-briefing", "sistema-repasse", "sistema-instagram", "sistema-chat-site"].map(
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
  { id: "cacador-brechas", setor: "seguranca" },
  { id: "cacador-erros", setor: "seguranca" },
];

for (const [nome, equipe] of [
  ["equipe de hoje", EQUIPE],
  ["só a Diretora", [EQUIPE[0]]],
  ["equipe pequena", EQUIPE.slice(0, 4)],
] as const) {
  const planta = montarPlanta([...equipe]);
  const m = montarMalha(planta);
  const lugares = [...lugaresPorAgente(planta).values()];
  const pontos = pontosDeLazer(planta, m);

  conferir(`${nome}: toda mesa tem chão atrás da cadeira`, lugares.every((l) => pisavel(m, ladrilhoDaMesa(l))), true);
  conferir(`${nome}: copa e descanso têm lugares`, ["copa", "descanso"].map((s) => pontos.some((p) => p.sala === s)), [true, true]);
  conferir(`${nome}: lugares sem repetir`, new Set(pontos.map((p) => p.chave)).size, pontos.length);

  // De qualquer mesa se chega a qualquer lugar de lazer e a qualquer outra mesa.
  const semCaminho: string[] = [];
  for (const l of lugares) {
    for (const p of pontos) if (!caminho(m, ladrilhoDaMesa(l), [p.ladrilho])) semCaminho.push(`${l.agenteId} → ${p.chave}`);
    for (const o of lugares) if (!caminho(m, ladrilhoDaMesa(l), [ladrilhoDaMesa(o)])) semCaminho.push(`${l.agenteId} → mesa de ${o.agenteId}`);
  }
  conferir(`${nome}: tudo alcançável`, semCaminho.slice(0, 5), []);

  // Todo passo do caminho é para um vizinho e em chão.
  const a = lugares[0];
  const b = lugares[lugares.length - 1];
  const rota = caminho(m, ladrilhoDaMesa(a), [ladrilhoDaMesa(b)]) ?? [];
  conferir(
    `${nome}: caminho anda de um em um, só no chão`,
    rota.every((t, i) => pisavel(m, t) && (i === 0 || Math.abs(t.x - rota[i - 1].x) + Math.abs(t.y - rota[i - 1].y) === 1)),
    true,
  );
  conferir(`${nome}: visita tem onde ficar`, lugares.every((l) => ladrilhosDeVisita(m, ladrilhoDaMesa(l), l).flat().length > 0), true);
}

// ---- não atravessa parede: entre salas só pela porta
{
  const planta = montarPlanta(EQUIPE);
  const m = montarMalha(planta);
  const lugares = lugaresPorAgente(planta);
  const de = ladrilhoDaMesa(lugares.get("diretora")!);
  const ate = ladrilhoDaMesa(lugares.get("cacador-erros")!);
  const rota = caminho(m, de, [ate])!;
  const furou = rota.some((t, i) => {
    if (i === 0) return false;
    const p = rota[i - 1];
    const da = m.dono[p.y * m.largura + p.x];
    const db = m.dono[t.y * m.largura + t.x];
    if (da === db) return false;
    if (p.y !== t.y) {
      // Subiu ou desceu de sala: só pelo vão da porta do topo de quem está embaixo.
      const baixo = planta.salas[p.y > t.y ? da : db];
      const xs = baixo.portaTopo === null ? [] : [baixo.portaTopo, baixo.portaTopo + 1];
      return !xs.includes(t.x);
    }
    const direita = planta.salas[t.x > p.x ? db : da];
    return direita.portaEsquerda === null || (t.y !== direita.portaEsquerda && t.y !== direita.portaEsquerda + 1);
  });
  conferir("de uma ponta à outra sem atravessar parede", furou, false);
}

// ---- quem vai para onde
{
  const planta = montarPlanta(EQUIPE);
  const m = montarMalha(planta);
  const pontos = pontosDeLazer(planta, m);
  const ids = EQUIPE.map((a) => a.id);
  const agora = Date.UTC(2026, 10, 27, 15, 0, 0);
  const r1 = escolherLazer(ids, pontos, new Map(), agora);
  const chaves = [...r1.values()].map((v) => v.ponto.chave);
  conferir("um lugar por agente (sem dois no mesmo)", new Set(chaves).size, chaves.length);
  conferir("todo mundo achou lugar quando há lugar", r1.size, Math.min(ids.length, pontos.length));
  const naCopa = [...r1.values()].filter((v) => v.ponto.descanso).length;
  const vagasDeDescanso = pontos.filter((p) => p.descanso).length;
  conferir("Copa e Descanso enchem primeiro", naCopa >= Math.min(vagasDeDescanso, r1.size) - 3, true);
  conferir("mesmo momento, mesma escolha", JSON.stringify([...escolherLazer(ids, pontos, new Map(), agora)]), JSON.stringify([...r1]));

  // Um segundo depois, ninguém troca de lugar.
  const atuais = new Map([...r1].map(([id, v]) => [id, { chave: v.ponto.chave, rodada: v.rodada }]));
  const r2 = escolherLazer(ids, pontos, atuais, agora + 1000);
  const mudou = ids.filter((id) => r1.get(id)?.ponto.chave !== r2.get(id)?.ponto.chave && rodadaDeLugar(id, agora) === rodadaDeLugar(id, agora + 1000));
  conferir("ninguém pula de lugar sem a rodada virar", mudou, []);

  // Numa rodada inteira depois, cada um troca uma vez, não todos juntos.
  const rodadasViradasEm1min = ids.filter((id) => rodadaDeLugar(id, agora) !== rodadaDeLugar(id, agora + 60_000)).length;
  conferir("trocas espalhadas no tempo", rodadasViradasEm1min < ids.length / 2, true);
  conferir("toda rodada vira dentro do período", ids.every((id) => rodadaDeLugar(id, agora + TROCA_DE_LUGAR_MS) === rodadaDeLugar(id, agora) + 1), true);
  // Pouca gente: todo mundo cabe na Copa e no Descanso.
  const poucos = escolherLazer(ids.slice(0, 5), pontos, new Map(), agora);
  conferir("com pouca gente, ficam na Copa e no Descanso", [...poucos.values()].every((v) => v.ponto.descanso), true);
}

if (falhas.length) {
  console.error(`${falhas.length} verificação(ões) falharam:\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}
console.log(`${passou}/${passou} verificações passaram`);
