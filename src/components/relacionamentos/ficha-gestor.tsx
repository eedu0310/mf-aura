"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  Bot,
  CalendarClock,
  Loader2,
  Megaphone,
  MessageCircle,
  Send,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { SeloOrigem } from "@/components/origem/selo-origem";

/**
 * A visão do gestor dentro da ficha do relacionamento.
 *
 * Pedido de 21/10: clicar no relacionamento e ver de onde veio o lead, para
 * quem chegou, com quem está, quanto vale, como está — e os sinais de que
 * está esfriando, com um botão para pedir atenção ao vendedor.
 *
 * Os dados vêm de /api/gestor/relacionamento, que confere se a pessoa é
 * gestora aprovada. Para quem não é, a rota responde 403 e este bloco não
 * aparece.
 */

interface Ficha {
  contato: { nome: string; empresa: string; temperatura: string | null; cadastradoEm: string; ultimoContatoEm: string | null; proximoContatoEm: string | null };
  pessoas: { vendedor: string | null; parceiro: string | null; percentualParceiro: number | null; recebidoPor: string | null; recebidoEm: string | null; respondidoEm: string | null; repassado: boolean };
  origem: { tipo: string | null; descricao: string | null; campanha: string | null; anuncio: { titulo: string; plataforma: string | null; em: string | null } | null; canalDeEntrada: string | null; classificacaoIa: string | null; urgencia: string | null };
  valores: { emAberto: number; vendido: number; estimadoPelaIa: number | null; negociosAbertos: number; negociosGanhos: number };
  negocios: { id: string; etapa: string; valor: number; produto: string | null; aberto: boolean; diasNaEtapa: number | null; motivoPerda: string | null }[];
  vendas: { id: string; valor: number; produto: string | null; data: string }[];
  whatsapp: { resumo: string | null; proximaAcao: string | null; interesse: string | null; alertas: string[]; analisadoEm: string | null; ultimaMensagem: { deQuem: "cliente" | "vendedor"; em: string; texto: string } | null } | null;
  atividades: { total: number; ultimas: { id: string; tipo: string; titulo: string; resultado: string | null; proximoPasso: string | null; quem: string | null; em: string }[] };
  agenda: { id: string; titulo: string; tipo: string | null; data: string; hora: string | null; concluido: boolean }[];
  sinais: { gravidade: "alta" | "media" | "baixa"; texto: string }[];
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function quando(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const dias = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
  if (dias <= 0) return `hoje (${data})`;
  if (dias === 1) return `ontem (${data})`;
  return dias > 0 ? `há ${dias} dias (${data})` : data;
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-aura-graphite-soft">{rotulo}</span>
      <span className="min-w-0 text-right font-medium text-aura-graphite">{children}</span>
    </div>
  );
}

function Bloco({ icone, titulo, children }: { icone: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-aura-mist bg-white p-4">
      <h4 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-aura-petrol-700">
        {icone}
        {titulo}
      </h4>
      {children}
    </section>
  );
}

const COR_SINAL = {
  alta: "border-aura-danger/30 bg-aura-danger/10 text-aura-danger",
  media: "border-amber-300 bg-amber-50 text-amber-800",
  baixa: "border-aura-mist bg-aura-bg text-aura-graphite-soft",
};

export function FichaGestor({ relacionamentoId }: { relacionamentoId: string }) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "oculto" | "erro">("carregando");
  const [erro, setErro] = useState("");
  const [pedido, setPedido] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [avisado, setAvisado] = useState("");

  useEffect(() => {
    let vivo = true;
    setEstado("carregando");
    fetch(`/api/gestor/relacionamento?id=${encodeURIComponent(relacionamentoId)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!vivo) return;
        if (res.status === 403 || res.status === 401) return setEstado("oculto");
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErro(j.erro ?? "Não consegui carregar a ficha.");
          return setEstado("erro");
        }
        setFicha(j);
        setEstado("pronto");
      })
      .catch(() => vivo && (setErro("Sem conexão com o servidor."), setEstado("erro")));
    return () => {
      vivo = false;
    };
  }, [relacionamentoId]);

  async function pedirAtencao() {
    if (!pedido.trim()) return;
    setEnviando(true);
    setAvisado("");
    try {
      const res = await fetch("/api/gestor/relacionamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: relacionamentoId, mensagem: pedido }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.erro ?? "Não consegui avisar.");
      setAvisado(`${ficha?.pessoas.vendedor ?? "O vendedor"} foi avisado.`);
      setPedido("");
    } catch (e) {
      setAvisado(e instanceof Error ? e.message : "Não consegui avisar.");
    } finally {
      setEnviando(false);
    }
  }

  if (estado === "oculto") return null;
  if (estado === "carregando") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-aura-bg p-4 text-sm text-aura-graphite-soft">
        <Loader2 size={16} className="animate-spin" /> Montando a visão do gestor…
      </div>
    );
  }
  if (estado === "erro" || !ficha) {
    return <p className="rounded-xl bg-aura-danger/10 p-3 text-sm text-aura-danger">{erro}</p>;
  }

  const f = ficha;
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-aura-graphite-soft">Visão do gestor</p>

      {/* Atenção primeiro: é o motivo de o gestor abrir a ficha. */}
      {f.sinais.length > 0 ? (
        <div className="space-y-1.5">
          {f.sinais.map((s, i) => (
            <p key={i} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${COR_SINAL[s.gravidade]}`}>
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              {s.texto}
            </p>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Em dia: contato recente e nada parado.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Bloco icone={<UserRound size={14} />} titulo="Quem atende">
          <Linha rotulo="Vendedor">{f.pessoas.vendedor ?? "Sem vendedor"}</Linha>
          {f.pessoas.parceiro && (
            <Linha rotulo="Em dupla com">
              {f.pessoas.parceiro} ({f.pessoas.percentualParceiro}%)
            </Linha>
          )}
          <Linha rotulo="Lead chegou para">
            {f.pessoas.recebidoPor ?? "Cadastrado direto"}
            {f.pessoas.repassado && <span className="ml-1 text-xs text-amber-700">(repassado)</span>}
          </Linha>
          <Linha rotulo="Chegou em">{quando(f.pessoas.recebidoEm ?? f.contato.cadastradoEm)}</Linha>
          {f.pessoas.recebidoEm && <Linha rotulo="Primeira resposta">{f.pessoas.respondidoEm ? quando(f.pessoas.respondidoEm) : "não registrada"}</Linha>}
          <Linha rotulo="Loja">{f.contato.empresa}</Linha>
        </Bloco>

        <Bloco icone={<Megaphone size={14} />} titulo="De onde veio">
          <Linha rotulo="Origem">
            <span className="inline-flex items-center gap-1.5">
              <SeloOrigem origem={f.origem.tipo} tamanho={11} />
              {!f.origem.tipo && (f.origem.descricao ?? "não informada")}
            </span>
          </Linha>
          {f.origem.campanha && <Linha rotulo="Campanha">{f.origem.campanha}</Linha>}
          {f.origem.anuncio && (
            <Linha rotulo="Anúncio">
              {f.origem.anuncio.titulo}
              {f.origem.anuncio.plataforma ? ` · ${f.origem.anuncio.plataforma}` : ""}
            </Linha>
          )}
          {f.origem.canalDeEntrada && <Linha rotulo="Entrou por">{f.origem.canalDeEntrada}</Linha>}
          {f.origem.classificacaoIa && (
            <Linha rotulo="Classificação da IA">
              {f.origem.classificacaoIa}
              {f.origem.urgencia ? ` · urgência ${f.origem.urgencia}` : ""}
            </Linha>
          )}
        </Bloco>

        <Bloco icone={<TrendingUp size={14} />} titulo="Valor">
          <Linha rotulo="Em negociação">{moeda(f.valores.emAberto)}</Linha>
          <Linha rotulo="Já vendido">{moeda(f.valores.vendido)}</Linha>
          {f.valores.estimadoPelaIa != null && <Linha rotulo="Estimado pela IA">{moeda(f.valores.estimadoPelaIa)}</Linha>}
          <div className="mt-1 space-y-1">
            {f.negocios.map((n) => (
              <div key={n.id} className="flex items-center justify-between gap-2 rounded-lg bg-aura-bg px-2.5 py-1.5 text-xs">
                <span className="min-w-0 truncate text-aura-graphite">
                  <b>{n.etapa}</b>
                  {n.produto ? ` · ${n.produto}` : ""}
                </span>
                <span className="shrink-0 text-aura-graphite-soft">
                  {n.valor ? moeda(n.valor) : <span className="text-amber-700">sem valor</span>}
                  {n.aberto && n.diasNaEtapa != null ? ` · ${n.diasNaEtapa}d` : ""}
                </span>
              </div>
            ))}
            {f.negocios.length === 0 && <p className="text-xs text-aura-graphite-soft">Nenhum negócio aberto no pipeline.</p>}
          </div>
        </Bloco>

        <Bloco icone={<CalendarClock size={14} />} titulo="Como está">
          <Linha rotulo="Temperatura">{f.contato.temperatura ?? "—"}</Linha>
          <Linha rotulo="Último contato">{quando(f.contato.ultimoContatoEm)}</Linha>
          <Linha rotulo="Próximo contato">{f.contato.proximoContatoEm ? new Date(f.contato.proximoContatoEm).toLocaleDateString("pt-BR") : "não marcado"}</Linha>
          <Linha rotulo="Atividades">{f.atividades.total}</Linha>
          {f.agenda.filter((c) => !c.concluido).slice(0, 2).map((c) => (
            <Linha key={c.id} rotulo="Agendado">
              {c.titulo} · {new Date(`${c.data}T12:00:00`).toLocaleDateString("pt-BR")}
              {c.hora ? ` ${c.hora.slice(0, 5)}` : ""}
            </Linha>
          ))}
        </Bloco>
      </div>

      {f.whatsapp && (
        <Bloco icone={<Bot size={14} />} titulo="WhatsApp — leitura da IA">
          {f.whatsapp.ultimaMensagem && (
            <p className="mb-2 flex items-start gap-2 rounded-lg bg-aura-bg px-3 py-2 text-xs text-aura-graphite">
              <MessageCircle size={14} className="mt-0.5 shrink-0 text-aura-petrol-600" />
              <span>
                <b>Última mensagem: {f.whatsapp.ultimaMensagem.deQuem}</b>, {quando(f.whatsapp.ultimaMensagem.em)}
                {f.whatsapp.ultimaMensagem.texto ? ` — “${f.whatsapp.ultimaMensagem.texto}”` : ""}
              </span>
            </p>
          )}
          {f.whatsapp.resumo && <p className="text-sm text-aura-graphite">{f.whatsapp.resumo}</p>}
          {f.whatsapp.proximaAcao && (
            <p className="mt-2 text-sm">
              <span className="text-aura-graphite-soft">Próxima ação sugerida: </span>
              <span className="font-medium text-aura-graphite">{f.whatsapp.proximaAcao}</span>
            </p>
          )}
          {f.whatsapp.alertas.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-aura-danger">
              {f.whatsapp.alertas.map((a, i) => (
                <li key={i}>{typeof a === "string" ? a : JSON.stringify(a)}</li>
              ))}
            </ul>
          )}
        </Bloco>
      )}

      {f.atividades.ultimas.length > 0 && (
        <Bloco icone={<CalendarClock size={14} />} titulo="Últimas atividades">
          <ul className="divide-y divide-aura-mist">
            {f.atividades.ultimas.map((a) => (
              <li key={a.id} className="py-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-aura-graphite">{a.tipo} · {a.titulo}</span>
                  <span className="shrink-0 text-aura-graphite-soft">{quando(a.em)}</span>
                </div>
                {(a.resultado || a.proximoPasso) && (
                  <p className="mt-0.5 text-aura-graphite-soft">
                    {a.resultado}
                    {a.proximoPasso ? ` → ${a.proximoPasso}` : ""}
                  </p>
                )}
                {a.quem && <p className="text-aura-graphite-soft">por {a.quem}</p>}
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      {/* Pedir atenção: o gestor manda o recado direto para o vendedor. */}
      <Bloco icone={<BellRing size={14} />} titulo="Pedir atenção ao vendedor">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={pedido}
            onChange={(e) => setPedido(e.target.value)}
            placeholder={`Ex.: Liga hoje para ${f.contato.nome.split(" ")[0]}, o orçamento venceu`}
            className="min-w-0 flex-1 rounded-lg border border-aura-mist px-3 py-2 text-sm outline-none focus:border-aura-petrol-500"
          />
          <button
            type="button"
            onClick={pedirAtencao}
            disabled={enviando || !pedido.trim()}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-aura-petrol-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Avisar
          </button>
        </div>
        {avisado && <p className="mt-2 text-xs text-aura-graphite-soft">{avisado}</p>}
      </Bloco>
    </div>
  );
}
