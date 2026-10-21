/**
 * Os sinais de atenção da ficha do relacionamento, para o gestor.
 *
 * Pedido de 21/10: o gestor abre o relacionamento e vê de onde o lead veio,
 * como está, quanto vale, com quem está — e, principalmente, se está
 * esfriando, para "chegar no vendedor e ajudar na venda" antes de perder.
 *
 * Função pura: recebe as datas e números já buscados e devolve a lista de
 * alertas em ordem de gravidade. Fica fora da rota para ser testada.
 */

export type Gravidade = "alta" | "media" | "baixa";

export interface Sinal {
  gravidade: Gravidade;
  texto: string;
}

export interface EntradaDosSinais {
  agora: Date;
  /** Último contato registrado (atividade, WhatsApp ou o campo do cadastro). */
  ultimoContatoEm: string | null;
  /** Próximo contato combinado, se houver. */
  proximoContatoEm: string | null;
  /** Negócios em aberto (nem ganho nem perdido). */
  negociosAbertos: { etapa: string; valor: number; atualizadoEm: string | null; exigeValor: boolean }[];
  /** Lead que chegou e ainda não teve resposta registrada. */
  leadSemResposta: { chegouEm: string } | null;
  /** O cliente mandou a última mensagem no WhatsApp e ninguém respondeu. */
  clienteEsperandoDesde: string | null;
  temperatura: string | null;
}

function diasEntre(de: string, ate: Date): number {
  return Math.floor((ate.getTime() - new Date(de).getTime()) / 86_400_000);
}

function horasEntre(de: string, ate: Date): number {
  return Math.floor((ate.getTime() - new Date(de).getTime()) / 3_600_000);
}

const ORDEM: Record<Gravidade, number> = { alta: 0, media: 1, baixa: 2 };

export function sinaisDoRelacionamento(e: EntradaDosSinais): Sinal[] {
  const s: Sinal[] = [];

  if (e.clienteEsperandoDesde) {
    const h = horasEntre(e.clienteEsperandoDesde, e.agora);
    if (h >= 2) {
      s.push({
        gravidade: h >= 24 ? "alta" : "media",
        texto: h >= 24 ? `Cliente esperando resposta no WhatsApp há ${Math.floor(h / 24)} dia(s)` : `Cliente esperando resposta no WhatsApp há ${h} h`,
      });
    }
  }

  if (e.leadSemResposta) {
    const h = horasEntre(e.leadSemResposta.chegouEm, e.agora);
    s.push({ gravidade: h >= 4 ? "alta" : "media", texto: `Lead chegou há ${h >= 48 ? `${Math.floor(h / 24)} dias` : `${h} h`} e não tem resposta registrada` });
  }

  const temNegocioAberto = e.negociosAbertos.length > 0;
  if (e.ultimoContatoEm) {
    const d = diasEntre(e.ultimoContatoEm, e.agora);
    // Com negócio aberto, uma semana sem falar já é risco; sem negócio, um mês.
    const limiteAlto = temNegocioAberto ? 7 : 30;
    const limiteMedio = temNegocioAberto ? 4 : 15;
    if (d >= limiteAlto) s.push({ gravidade: "alta", texto: `Sem contato há ${d} dias${temNegocioAberto ? " com negócio em aberto" : ""}` });
    else if (d >= limiteMedio) s.push({ gravidade: "media", texto: `Sem contato há ${d} dias — esfriando` });
  } else {
    s.push({ gravidade: temNegocioAberto ? "alta" : "baixa", texto: "Nenhum contato registrado" });
  }

  if (e.proximoContatoEm) {
    const d = diasEntre(e.proximoContatoEm, e.agora);
    if (d >= 1) s.push({ gravidade: d >= 3 ? "alta" : "media", texto: `Próximo contato combinado venceu há ${d} dia(s)` });
  }

  for (const n of e.negociosAbertos) {
    if (n.exigeValor && !(n.valor > 0)) {
      s.push({ gravidade: "media", texto: `Negócio em ${n.etapa} sem valor` });
    }
    if (n.atualizadoEm) {
      const d = diasEntre(n.atualizadoEm, e.agora);
      if (d >= 14) s.push({ gravidade: d >= 30 ? "alta" : "media", texto: `Negócio parado em ${n.etapa} há ${d} dias` });
    }
  }

  if (e.temperatura === "frio" && temNegocioAberto) {
    s.push({ gravidade: "media", texto: "Marcado como frio, mas tem negócio em aberto" });
  }

  return s.sort((a, b) => ORDEM[a.gravidade] - ORDEM[b.gravidade]);
}
