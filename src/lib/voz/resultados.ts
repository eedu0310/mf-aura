/**
 * Separa, de um evento do reconhecimento de voz do navegador, o que é texto
 * pronto NOVO e o que ainda está sendo falado.
 *
 * O BUG QUE ISTO CORRIGE: o relato por voz chegava duplicado ("fui na obra
 * fui na obra do cliente do cliente"). No Chrome do Android, com
 * `continuous = true`, o evento `onresult` vem com `resultIndex = 0` e a
 * lista `results` inteira de novo, inclusive os trechos finais que já foram
 * entregues no evento anterior. O código lia "de resultIndex até o fim" e
 * acrescentava tudo outra vez. No Chrome do computador o resultIndex avança
 * e o problema não aparece — por isso ninguém viu no teste.
 *
 * A regra agora: cada resultado final tem uma posição fixa na lista. Guardamos
 * até que posição já entregamos (`entregueAte`) e só acrescentamos finais
 * com posição a partir dali. Um final que o Android reenvia com o mesmo texto
 * logo em seguida também é ignorado.
 */

export interface ResultadoDeVoz {
  isFinal: boolean;
  transcript: string;
}

export interface Juncao {
  /** Texto pronto que ainda não tinha sido entregue (vazio se nada novo). */
  pronto: string;
  /** O que está sendo dito agora, para mostrar em cinza. */
  andando: string;
  /** Quantos finais já foram entregues, para passar na próxima chamada. */
  entregueAte: number;
}

export function juntarResultados(
  resultados: ArrayLike<ResultadoDeVoz>,
  entregueAte: number,
  ultimoEntregue = "",
): Juncao {
  const prontos: string[] = [];
  let andando = "";
  let finais = 0;
  for (let i = 0; i < resultados.length; i++) {
    const r = resultados[i];
    if (r.isFinal) {
      finais += 1;
      if (finais > entregueAte) {
        const t = r.transcript.trim();
        if (t && t !== ultimoEntregue) prontos.push(t);
      }
    } else {
      andando += r.transcript;
    }
  }
  return {
    pronto: prontos.join(" ").trim(),
    andando: andando.trim(),
    entregueAte: Math.max(entregueAte, finais),
  };
}

/** Lê o evento do navegador na forma que juntarResultados espera. */
export function resultadosDoEvento(evento: {
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}): ResultadoDeVoz[] {
  const lista: ResultadoDeVoz[] = [];
  for (let i = 0; i < evento.results.length; i++) {
    const r = evento.results[i];
    lista.push({ isFinal: !!r.isFinal, transcript: String(r[0]?.transcript ?? "") });
  }
  return lista;
}
