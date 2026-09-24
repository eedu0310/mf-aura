import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Calendário do vendedor no formato iCalendar (.ics).
 *
 * O endereço é secreto (tem o token do usuário) e não pede login, porque
 * quem consome é o Google Agenda ou o calendário do iPhone: eles buscam
 * esta URL de tempos em tempos e atualizam sozinhos. Assim, o compromisso
 * marcado no CRM aparece no celular e lembra a pessoa na hora certa.
 *
 * Entram no calendário:
 *  - os compromissos da agenda;
 *  - os próximos contatos (follow-ups) marcados nas atividades.
 */

/** O Brasil não tem mais horário de verão, então o fuso é fixo em -03:00. */
const FUSO_HORAS = 3;

function paraUtc(dia: string, hora: string | null, minutosDepois = 0): string {
  const [ano, mes, d] = dia.split("-").map(Number);
  const [h, m] = (hora ?? "00:00").split(":").map(Number);
  const base = Date.UTC(ano, (mes || 1) - 1, d || 1, (h || 0) + FUSO_HORAS, m || 0);
  const quando = new Date(base + minutosDepois * 60_000);
  return quando.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function diaSolto(dia: string): string {
  return dia.replace(/-/g, "");
}

/** Escapa os caracteres que o formato iCalendar trata de forma especial. */
function esc(texto: string | null | undefined): string {
  return String(texto ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** O formato exige linhas de no máximo 75 octetos. */
function dobrar(linha: string): string {
  if (linha.length <= 73) return linha;
  const partes: string[] = [];
  let resto = linha;
  partes.push(resto.slice(0, 73));
  resto = resto.slice(73);
  while (resto.length > 72) {
    partes.push(" " + resto.slice(0, 72));
    resto = resto.slice(72);
  }
  if (resto) partes.push(" " + resto);
  return partes.join("\r\n");
}

export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(token ?? "")) {
    return new NextResponse("Endereço inválido.", { status: 404 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) return new NextResponse("Indisponível.", { status: 500 });

  const { data: perfil } = await supabase
    .from("profiles")
    .select("id, nome, empresa")
    .eq("agenda_token", token)
    .maybeSingle();

  if (!perfil) return new NextResponse("Endereço inválido.", { status: 404 });

  // Últimos 60 dias e próximos 365: o suficiente para o app do celular.
  const de = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
  const ate = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10);

  const [{ data: compromissos }, { data: atividades }] = await Promise.all([
    supabase
      .from("compromissos")
      .select("id, titulo, subtitulo, tipo, relacionamento_nome, data, hora, duracao_minutos, local, observacao, concluido, created_at")
      .eq("owner_id", perfil.id)
      .gte("data", de)
      .lte("data", ate),
    supabase
      .from("atividades")
      .select("id, tipo, titulo, cliente_nome, proximo_contato_em, proximo_passo, created_at")
      .eq("owner_id", perfil.id)
      .not("proximo_contato_em", "is", null)
      .gte("proximo_contato_em", de),
  ]);

  const linhas: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AURA Sales OS//Agenda//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    dobrar(`X-WR-CALNAME:AURA — ${esc(perfil.nome || "Minha agenda")}`),
    "X-WR-TIMEZONE:America/Sao_Paulo",
    "REFRESH-INTERVAL;VALUE=DURATION:PT30M",
    "X-PUBLISHED-TTL:PT30M",
  ];

  const carimbo = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  for (const c of compromissos ?? []) {
    const titulo = [c.titulo, c.relacionamento_nome].filter(Boolean).join(" · ");
    const descricao = [c.subtitulo, c.observacao, c.concluido ? "(concluído)" : null]
      .filter(Boolean)
      .join("\n");

    linhas.push("BEGIN:VEVENT");
    linhas.push(`UID:compromisso-${c.id}@aura`);
    linhas.push(`DTSTAMP:${carimbo}`);
    if (c.hora) {
      linhas.push(`DTSTART:${paraUtc(c.data, c.hora)}`);
      linhas.push(`DTEND:${paraUtc(c.data, c.hora, Number(c.duracao_minutos ?? 60))}`);
    } else {
      linhas.push(`DTSTART;VALUE=DATE:${diaSolto(c.data)}`);
    }
    linhas.push(dobrar(`SUMMARY:${esc(`${c.tipo}: ${titulo}`)}`));
    if (descricao) linhas.push(dobrar(`DESCRIPTION:${esc(descricao)}`));
    if (c.local) linhas.push(dobrar(`LOCATION:${esc(c.local)}`));
    linhas.push(`STATUS:${c.concluido ? "CONFIRMED" : "TENTATIVE"}`);
    // Lembrete 30 minutos antes.
    if (c.hora && !c.concluido) {
      linhas.push("BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:Lembrete AURA", "END:VALARM");
    }
    linhas.push("END:VEVENT");
  }

  for (const a of atividades ?? []) {
    const quando = new Date(a.proximo_contato_em as string);
    if (Number.isNaN(quando.getTime())) continue;
    const dia = quando.toISOString().slice(0, 10);
    const hora = quando.toISOString().slice(11, 16);

    linhas.push("BEGIN:VEVENT");
    linhas.push(`UID:followup-${a.id}@aura`);
    linhas.push(`DTSTAMP:${carimbo}`);
    // Este campo já está em hora absoluta, então vai direto em UTC.
    linhas.push(`DTSTART:${quando.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`);
    linhas.push(
      `DTEND:${new Date(quando.getTime() + 30 * 60_000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
    );
    linhas.push(dobrar(`SUMMARY:${esc(`Follow-up: ${a.cliente_nome || a.titulo || "cliente"}`)}`));
    if (a.proximo_passo) linhas.push(dobrar(`DESCRIPTION:${esc(`Próximo passo: ${a.proximo_passo}`)}`));
    linhas.push("BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:Lembrete AURA", "END:VALARM");
    linhas.push("END:VEVENT");
    void dia;
    void hora;
  }

  linhas.push("END:VCALENDAR");

  return new NextResponse(linhas.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="aura-agenda.ics"',
      "Cache-Control": "public, max-age=300",
    },
  });
}
