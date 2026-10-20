/**
 * Rodar com: npx tsx src/lib/voz/resultados.teste.ts
 *
 * Reproduz a sequência de eventos que o Chrome do Android manda (lista
 * inteira a cada evento, resultIndex = 0) e a do Chrome do computador
 * (só o que mudou), e confere que o texto sai UMA vez nas duas.
 */
import { juntarResultados, type ResultadoDeVoz } from "./resultados";

let passou = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const a = JSON.stringify(obtido);
  const b = JSON.stringify(esperado);
  if (a !== b) {
    console.error(`FALHOU: ${nome}\n  esperado ${b}\n  obtido   ${a}`);
    process.exit(1);
  }
  passou += 1;
}

const f = (t: string): ResultadoDeVoz => ({ isFinal: true, transcript: t });
const p = (t: string): ResultadoDeVoz => ({ isFinal: false, transcript: t });

// ---- Android: a lista inteira volta a cada evento
{
  let entregue = 0;
  let texto = "";
  const entregar = (lista: ResultadoDeVoz[]) => {
    const j = juntarResultados(lista, entregue);
    entregue = j.entregueAte;
    if (j.pronto) texto = `${texto} ${j.pronto}`.trim();
    return j;
  };
  conferir("android: parcial não entrega", entregar([p("fui na")]).pronto, "");
  conferir("android: primeiro final", entregar([f("fui na obra")]).pronto, "fui na obra");
  conferir("android: reenvio do mesmo final não duplica", entregar([f("fui na obra")]).pronto, "");
  conferir("android: final velho + parcial nova", entregar([f("fui na obra"), p("do cli")]).pronto, "");
  conferir("android: segundo final só ele", entregar([f("fui na obra"), f("do cliente")]).pronto, "do cliente");
  conferir("android: lista inteira de novo, nada", entregar([f("fui na obra"), f("do cliente")]).pronto, "");
  conferir("android: texto final sem repetição", texto, "fui na obra do cliente");
}

// ---- Computador: cada evento só traz o que mudou (resultIndex avança), mas
// a lista acumulada ainda é a mesma — a função lê a lista inteira e funciona.
{
  let entregue = 0;
  const j1 = juntarResultados([f("bom dia")], entregue);
  entregue = j1.entregueAte;
  const j2 = juntarResultados([f("bom dia"), f("tudo bem")], entregue);
  conferir("pc: segundo final", j2.pronto, "tudo bem");
  conferir("pc: contador avança", j2.entregueAte, 2);
}

// ---- Parcial em andamento aparece em cinza e não vai para o texto
{
  const j = juntarResultados([f("ok"), p("espera "), p("um pouco")], 1);
  conferir("parcial junta as fatias", j.andando, "espera um pouco");
  conferir("parcial não entrega final já dado", j.pronto, "");
}

// ---- Final idêntico ao último entregue, em posição nova (Android repete)
{
  const j = juntarResultados([f("sim"), f("sim")], 1, "sim");
  conferir("repetição imediata ignorada", j.pronto, "");
  const k = juntarResultados([f("sim"), f("sim senhor")], 1, "sim");
  conferir("texto diferente passa", k.pronto, "sim senhor");
}

console.log(`${passou}/${passou} verificações passaram`);
