/**
 * SECRETÁRIA DE AGENDA — às 7h30 e às 13h30 confere a agenda de cada um.
 *
 *   - compromisso de hoje com cliente e sem confirmação anotada: "confirme
 *     com o cliente" (cliente que esquece a visita é viagem perdida). Na
 *     rodada da tarde, só o que ainda não passou;
 *   - visita/reunião/medição dos últimos 7 dias sem nenhuma atividade
 *     registrada com o cliente depois dela: "registre como foi" — sem o
 *     registro o CRM não sabe que a visita aconteceu e o follow-up se perde;
 *   - dois compromissos da mesma pessoa no mesmo horário: conflito.
 *
 * "Confirmado" é a palavra confirm… na observação ou no subtítulo: é como a
 * equipe já anota hoje. Não há campo próprio para isso no banco.
 */
import type { Achado, ContextoAgente, DefinicaoAgente, ResultadoAgente } from "../tipos";
import { chaveDe, lerPorIds, lerTudo, limitarPorPessoa, plural, responsaveisDaLoja, somarDias } from "./comum";

export interface Compromisso {
  id: string;
  owner_id: string;
  empresa: string | null;
  titulo: string;
  subtitulo: string | null;
  tipo: string;
  relacionamento_id: string | null;
  relacionamento_nome: string | null;
  data: string;
  hora: string | null;
  duracao_minutos: number | null;
  concluido: boolean;
  observacao: string | null;
}

/** Tipos de compromisso que acontecem COM o cliente e pedem registro depois. */
const COM_CLIENTE = /visita|reuni|apresenta|instala|medi[cç]|showroom/i;

/** "14:30" → 870 minutos. Nulo se vazio ou inválido. */
export function minutosDaHora(hora: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hora ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

export function estaConfirmado(c: Pick<Compromisso, "observacao" | "subtitulo">): boolean {
  return /confirm/i.test(`${c.observacao ?? ""} ${c.subtitulo ?? ""}`);
}

/** Pares de compromissos da mesma pessoa, no mesmo dia, com horário sobreposto. */
export function conflitos(lista: Compromisso[]): Array<[Compromisso, Compromisso]> {
  const grupos = new Map<string, Compromisso[]>();
  for (const c of lista) {
    if (c.concluido || minutosDaHora(c.hora) === null) continue;
    const k = `${c.owner_id}|${c.data}`;
    grupos.set(k, [...(grupos.get(k) ?? []), c]);
  }
  const pares: Array<[Compromisso, Compromisso]> = [];
  for (const g of grupos.values()) {
    g.sort((a, b) => (minutosDaHora(a.hora) ?? 0) - (minutosDaHora(b.hora) ?? 0));
    for (let i = 0; i < g.length; i++) {
      const ini = minutosDaHora(g[i].hora) as number;
      const fim = ini + Math.max(15, g[i].duracao_minutos ?? 60);
      for (let j = i + 1; j < g.length; j++) {
        if ((minutosDaHora(g[j].hora) as number) < fim) pares.push([g[i], g[j]]);
      }
    }
  }
  return pares;
}

function minutosAgoraEmSaoPaulo(agora: Date): number {
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(agora)
    .split(":")
    .map(Number);
  return (h % 24) * 60 + m;
}

async function executar(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb, hoje, agora } = ctx;
  const equipe = await responsaveisDaLoja(sb);
  const desde = somarDias(hoje, -7);
  const comps = await lerTudo<Compromisso>((de, ate) =>
    sb
      .from("compromissos")
      .select("id, owner_id, empresa, titulo, subtitulo, tipo, relacionamento_id, relacionamento_nome, data, hora, duracao_minutos, concluido, observacao")
      .gte("data", desde)
      .lte("data", somarDias(hoje, 7))
      .order("id")
      .range(de, ate),
  );
  const empresaDe = (c: Compromisso) => c.empresa ?? equipe.pessoa(c.owner_id)?.empresa ?? "";
  const agoraMin = minutosAgoraEmSaoPaulo(agora);

  // Visitas passadas: houve alguma atividade com o cliente desde o dia dela?
  const passadas = comps.filter((c) => c.data < hoje && c.relacionamento_id && COM_CLIENTE.test(`${c.tipo} ${c.titulo}`));
  const atividades = await lerPorIds<{ relacionamento_id: string; ocorrida_em: string; origem: string | null }>(
    passadas.map((c) => c.relacionamento_id as string),
    (b, de, ate) =>
      sb
        .from("atividades")
        .select("relacionamento_id, ocorrida_em, origem")
        .in("relacionamento_id", b)
        .gte("ocorrida_em", `${desde}T00:00:00-03:00`)
        .order("id")
        .range(de, ate),
  );
  const ultimaAtividade = new Map<string, string>();
  for (const a of atividades) {
    if (a.origem === "whatsapp_ia") continue;
    const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(a.ocorrida_em));
    if (dia > (ultimaAtividade.get(a.relacionamento_id) ?? "")) ultimaAtividade.set(a.relacionamento_id, dia);
  }

  const achados: Achado[] = [];
  const comCliente = (c: Compromisso) => c.relacionamento_nome?.trim() || c.titulo;

  // 1. Conflitos (primeiro: é o que mais atrapalha o dia).
  const pares = conflitos(comps.filter((c) => c.data >= hoje));
  for (const [a, b] of pares) {
    if (!equipe.pessoa(a.owner_id)) continue;
    achados.push({
      chave: chaveDe("agenda", "conflito", [a.id, b.id].sort().join("-")),
      empresa: empresaDe(a),
      destinatarioId: a.owner_id,
      titulo: `Dois compromissos no mesmo horário (${a.data.slice(8, 10)}/${a.data.slice(5, 7)})`,
      descricao: `${a.hora?.slice(0, 5)} ${comCliente(a)} e ${b.hora?.slice(0, 5)} ${comCliente(b)} se sobrepõem. Remarque um deles.`,
      prioridade: a.data === hoje ? "urgente" : "alta",
      entidadeTipo: "compromisso",
      entidadeId: a.id,
      acaoUrl: "/agenda",
      expiraEmDias: 1,
    });
  }

  // 2. Hoje, com cliente, sem confirmação.
  for (const c of comps) {
    if (c.data !== hoje || c.concluido || estaConfirmado(c)) continue;
    if (!c.relacionamento_id && !c.relacionamento_nome) continue;
    const min = minutosDaHora(c.hora);
    if (min !== null && min <= agoraMin) continue; // já passou
    if (!equipe.pessoa(c.owner_id)) continue;
    achados.push({
      chave: chaveDe("agenda", "confirmar", c.id),
      empresa: empresaDe(c),
      destinatarioId: c.owner_id,
      titulo: `Confirme com o cliente: ${comCliente(c)}${c.hora ? ` às ${c.hora.slice(0, 5)}` : ""}`,
      descricao: `${c.tipo} de hoje sem confirmação anotada. Mande uma mensagem confirmando e escreva "confirmado" na observação.`,
      prioridade: "media",
      entidadeTipo: "compromisso",
      entidadeId: c.id,
      acaoUrl: "/agenda",
      expiraEmDias: 1,
      podeGerarMensagem: true,
    });
  }

  // 3. Visita passada sem registro.
  let semRegistro = 0;
  for (const c of passadas) {
    const ultima = ultimaAtividade.get(c.relacionamento_id as string);
    if (ultima && ultima >= c.data) continue;
    semRegistro++;
    if (!equipe.pessoa(c.owner_id)) continue;
    achados.push({
      chave: chaveDe("agenda", "sem-registro", c.id),
      empresa: empresaDe(c),
      destinatarioId: c.owner_id,
      titulo: `Registre como foi: ${comCliente(c)}`,
      descricao: `${c.tipo} de ${c.data.slice(8, 10)}/${c.data.slice(5, 7)} sem nenhuma atividade registrada depois. Anote o resultado e o próximo passo.`,
      prioridade: "alta",
      entidadeTipo: "compromisso",
      entidadeId: c.id,
      acaoUrl: `/registrar-atividade`,
      expiraEmDias: 3,
    });
  }

  const { achados: final, cortados } = limitarPorPessoa(achados);
  const paraConfirmar = achados.filter((a) => a.chave.startsWith("agenda:confirmar")).length;
  return {
    resumo: `${plural(paraConfirmar, "compromisso", "compromissos")} para confirmar hoje, ${plural(semRegistro, "visita")} sem registro, ${plural(pares.length, "conflito")}.`,
    achados: final,
    metricas: { paraConfirmar, visitasSemRegistro: semRegistro, conflitos: pares.length, cortadosPeloTeto: cortados },
  };
}

export const agenteAgenda: DefinicaoAgente = {
  id: "agenda",
  nome: "Secretária de Agenda",
  cargo: "Secretária de agenda",
  setor: "vendas",
  icone: "CalendarCheck",
  missao: "Confirma os compromissos do dia, cobra o registro das visitas feitas e avisa de horários em conflito.",
  // 7h30 e 13h30 (o contrato tem um minuto só para todas as horas).
  agenda: { tipo: "diario", horas: [7, 13], minuto: 30, diasSemana: [1, 2, 3, 4, 5, 6] },
  usaIA: false,
  orcamentoMensalUsd: 0,
  tipo: "nativo",
  executar,
};
