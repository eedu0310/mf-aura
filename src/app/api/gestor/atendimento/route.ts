/**
 * Onde a loja atende pessoalmente, e o que oferecer a quem está longe.
 *
 * GET  — a configuração da loja.
 * PUT  — o gestor grava os textos e os estados.
 *
 * O texto que o gestor escreve aqui entra no prompt da AURA como está. Não há
 * roteiro escondido no código: se ele quiser oferecer outra coisa amanhã,
 * muda aqui e a IA passa a oferecer aquilo, sem deploy.
 */
import { NextRequest, NextResponse } from "next/server";
import { getEmpresaAutenticada } from "@/lib/auth-empresa";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Siglas válidas, para não gravar "Rio Grande do Sul" onde se espera "RS". */
const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB",
  "PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

async function somenteGestor() {
  const auth = await getEmpresaAutenticada();
  if (!auth) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }) };

  const sb = getSupabaseServiceClient();
  if (!sb) return { erro: NextResponse.json({ erro: "Serviço indisponível." }, { status: 500 }) };

  const { data: eu } = await sb
    .from("profiles")
    .select("cargo, empresa, gestor_mestre, gestor_aprovado, ativo")
    .eq("id", auth.userId)
    .maybeSingle();

  // Mesma régua do banco: gestor só vale depois de aprovado.
  const pode =
    !!eu && eu.ativo !== false &&
    (eu.cargo === "Diretor" || (eu.cargo === "Gestor" && eu.gestor_aprovado));
  if (!pode) {
    return { erro: NextResponse.json({ erro: "Só o gestor aprovado edita isto." }, { status: 403 }) };
  }
  return { auth, sb, eu };
}

export async function GET(req: NextRequest) {
  const { erro, sb, eu } = await somenteGestor();
  if (erro) return erro;

  const pedida = req.nextUrl.searchParams.get("loja");
  const loja = eu!.gestor_mestre && pedida ? pedida : (eu!.empresa as string);

  const { data } = await sb!
    .from("config_atendimento")
    .select(
      "estados_presenciais, texto_presencial, texto_remoto, envio_automatico, texto_automatico, auto_hora_inicio, auto_hora_fim, atualizado_em",
    )
    .eq("empresa", loja)
    .maybeSingle();

  return NextResponse.json({
    loja,
    estadosPresenciais: data?.estados_presenciais ?? ["RS"],
    textoPresencial: data?.texto_presencial ?? "",
    textoRemoto: data?.texto_remoto ?? "",
    envioAutomatico: data?.envio_automatico === true,
    textoAutomatico: data?.texto_automatico ?? "",
    horaInicio: data?.auto_hora_inicio ?? null,
    horaFim: data?.auto_hora_fim ?? null,
    atualizadoEm: data?.atualizado_em ?? null,
    ufs: UFS,
  });
}

export async function PUT(req: NextRequest) {
  const { erro, sb, auth, eu } = await somenteGestor();
  if (erro) return erro;

  let c: {
    loja?: string;
    estadosPresenciais?: string[];
    textoPresencial?: string;
    textoRemoto?: string;
    envioAutomatico?: boolean;
    textoAutomatico?: string;
    horaInicio?: number | null;
    horaFim?: number | null;
  };
  try {
    c = await req.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const loja = eu!.gestor_mestre && c.loja ? c.loja : (eu!.empresa as string);

  const estados = (c.estadosPresenciais ?? [])
    .map((e) => String(e).toUpperCase().trim())
    .filter((e) => UFS.includes(e));

  /**
   * Lista vazia seria "a loja não atende ninguém pessoalmente", e todo contato
   * viraria atendimento a distância — inclusive o vizinho que mora a dois
   * quarteirões do showroom. Mais provável que seja engano do que intenção.
   */
  if (estados.length === 0) {
    return NextResponse.json(
      { erro: "Escolha ao menos um estado onde a loja atende pessoalmente." },
      { status: 400 },
    );
  }

  const textoAutomatico = (c.textoAutomatico ?? "").trim();

  /**
   * Ligar o envio sem ter o que enviar deixaria a AURA abrindo conversa com
   * uma mensagem em branco em nome do vendedor.
   */
  if (c.envioAutomatico && !textoAutomatico) {
    return NextResponse.json(
      { erro: "Escreva a mensagem antes de ligar o envio automático." },
      { status: 400 },
    );
  }

  const hora = (v: number | null | undefined): number | null => {
    if (v === null || v === undefined || v === ("" as unknown)) return null;
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) && n >= 0 && n <= 24 ? n : null;
  };
  const inicio = hora(c.horaInicio);
  const fim = hora(c.horaFim);

  // Uma hora sozinha não define janela nenhuma; as duas ou nenhuma.
  if ((inicio === null) !== (fim === null)) {
    return NextResponse.json(
      { erro: "Preencha as duas horas da janela, ou deixe as duas em branco para responder a qualquer hora." },
      { status: 400 },
    );
  }

  const { error } = await sb!.from("config_atendimento").upsert(
    {
      empresa: loja,
      estados_presenciais: estados,
      texto_presencial: (c.textoPresencial ?? "").trim() || null,
      texto_remoto: (c.textoRemoto ?? "").trim() || null,
      envio_automatico: c.envioAutomatico === true,
      texto_automatico: textoAutomatico || null,
      auto_hora_inicio: inicio,
      auto_hora_fim: fim,
      atualizado_em: new Date().toISOString(),
      atualizado_por: auth!.userId,
    },
    { onConflict: "empresa" },
  );
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, estadosPresenciais: estados, envioAutomatico: c.envioAutomatico === true });
}
