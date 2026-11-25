"use client";

/**
 * "Seus agentes" no Meu Dia: as recomendações abertas desta pessoa que vieram
 * da equipe de agentes, cada uma com o botão para a tela certa e, quando faz
 * sentido, "Gerar mensagem" — a IA escreve o texto do WhatsApp e o VENDEDOR
 * copia e envia. Nada é enviado sozinho (regra 1 dos agentes).
 *
 * A fonte é a mesma do AURA Coach (GET /api/aura/supervisao). Se a rota já
 * disser de qual agente veio cada recomendação (campo `agente`), o cartão
 * mostra só as dos agentes; se ainda não disser, mostra as abertas.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Check, Copy, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { Botao, Card, CardHeader, Selo, classeBotao, type Tom } from "@/components/ui";
import { Janela, chamarApi } from "./comum";

interface RecomendacaoBruta {
  id: string;
  titulo: string;
  descricao?: string | null;
  prioridade?: string | null;
  entidade_tipo?: string | null;
  entidade_id?: string | null;
  // Campos que a rota passa a mandar com a equipe de agentes (opcionais aqui).
  agente?: string | null;
  agente_nome?: string | null;
  agenteNome?: string | null;
  acao_url?: string | null;
  acaoUrl?: string | null;
  pode_gerar_mensagem?: boolean | null;
  podeGerarMensagem?: boolean | null;
}

interface Recomendacao {
  id: string;
  titulo: string;
  descricao: string;
  prioridade: string;
  agenteNome: string | null;
  href: string | null;
  podeGerar: boolean;
}

const COM_MENSAGEM = new Set(["relacionamento", "oportunidade", "manutencao", "pos_venda"]);

/** Sem acaoUrl, leva para a lista do tipo de registro (melhor que nada). */
const TELA_DO_TIPO: Record<string, string> = {
  relacionamento: "/relacionamentos",
  oportunidade: "/pipeline",
  lead: "/leads",
  pos_venda: "/pos-venda",
  manutencao: "/pos-venda",
  compromisso: "/agenda",
};

const PRIORIDADE: Record<string, { rotulo: string; tom: Tom }> = {
  urgente: { rotulo: "Urgente", tom: "perigo" },
  alta: { rotulo: "Alta", tom: "atencao" },
  media: { rotulo: "Média", tom: "neutro" },
  baixa: { rotulo: "Baixa", tom: "neutro" },
};
const ORDEM: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };

/** Só caminho interno: um link vindo do banco nunca leva para fora do CRM. */
function caminhoInterno(url: string | null | undefined) {
  return url && url.startsWith("/") && !url.startsWith("//") ? url : null;
}

function normalizar(lista: RecomendacaoBruta[]): Recomendacao[] {
  const rotaSabeAgente = lista.some((r) => "agente" in r);
  return lista
    .filter((r) => !rotaSabeAgente || Boolean(r.agente))
    .map((r) => {
      const tipo = r.entidade_tipo ?? "";
      const flag = r.podeGerarMensagem ?? r.pode_gerar_mensagem;
      return {
        id: r.id,
        titulo: r.titulo,
        descricao: r.descricao ?? "",
        prioridade: r.prioridade ?? "media",
        agenteNome: r.agenteNome ?? r.agente_nome ?? null,
        href: caminhoInterno(r.acaoUrl ?? r.acao_url) ?? TELA_DO_TIPO[tipo] ?? null,
        podeGerar: typeof flag === "boolean" ? flag : COM_MENSAGEM.has(tipo),
      };
    })
    .sort((a, b) => (ORDEM[a.prioridade] ?? 9) - (ORDEM[b.prioridade] ?? 9));
}

/** wa.me só com dígitos; número brasileiro sem DDI ganha o 55. */
function linkWhatsApp(telefone: string | null | undefined, texto: string) {
  let n = (telefone ?? "").replace(/\D/g, "");
  if (n.length === 10 || n.length === 11) n = `55${n}`;
  if (n.length < 12) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(texto)}`;
}

export function SeusAgentesCard() {
  const [itens, setItens] = useState<Recomendacao[] | null>(null);
  const [todos, setTodos] = useState(false);
  const [gerando, setGerando] = useState<Recomendacao | null>(null);

  useEffect(() => {
    let vivo = true;
    chamarApi<{ recomendacoes?: RecomendacaoBruta[] }>("/api/aura/supervisao")
      .then((d) => {
        if (vivo) setItens(normalizar(Array.isArray(d?.recomendacoes) ? d.recomendacoes : []));
      })
      .catch(() => {
        if (vivo) setItens([]);
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Carregando ou sem nada: o Meu Dia já é cheio, então o cartão nem aparece.
  if (!itens || itens.length === 0) return null;

  const visiveis = todos ? itens : itens.slice(0, 3);

  return (
    <Card>
      <CardHeader
        icone={Bot}
        titulo="Seus agentes"
        descricao="O que a equipe de IA separou para você. Eles sugerem; quem envia é você."
        acoes={<Selo tom="marca">{itens.length}</Selo>}
      />
      <ul className="divide-y divide-aura-mist">
        {visiveis.map((r) => {
          const p = PRIORIDADE[r.prioridade] ?? PRIORIDADE.media;
          return (
            <li key={r.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-medium text-aura-graphite">{r.titulo}</p>
                  {(r.prioridade === "urgente" || r.prioridade === "alta") && <Selo tom={p.tom}>{p.rotulo}</Selo>}
                </div>
                {r.descricao && <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-aura-graphite-soft">{r.descricao}</p>}
                {r.agenteNome && (
                  <p className="mt-1 inline-flex items-center gap-1 text-[0.6875rem] text-aura-graphite-soft">
                    <Bot size={11} aria-hidden /> {r.agenteNome}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {r.podeGerar && (
                  <Botao tamanho="sm" variante="secundario" icone={Sparkles} onClick={() => setGerando(r)}>
                    Gerar mensagem
                  </Botao>
                )}
                {r.href && (
                  <Link href={r.href} className={classeBotao("fantasma", "sm")}>
                    Abrir <ArrowRight size={13} aria-hidden />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {itens.length > 3 && (
        <button
          type="button"
          onClick={() => setTodos((v) => !v)}
          className="mt-3 text-xs font-medium text-aura-petrol-600 hover:underline"
        >
          {todos ? "Mostrar menos" : `Ver todas (${itens.length})`}
        </button>
      )}

      {gerando && <JanelaMensagem recomendacao={gerando} aoFechar={() => setGerando(null)} />}
    </Card>
  );
}

function JanelaMensagem({ recomendacao, aoFechar }: { recomendacao: Recomendacao; aoFechar: () => void }) {
  const [texto, setTexto] = useState("");
  const [telefone, setTelefone] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    chamarApi<{ mensagem?: string; telefone?: string | null }>("/api/agentes/mensagem", {
      method: "POST",
      body: JSON.stringify({ recomendacaoId: recomendacao.id }),
    })
      .then((d) => {
        if (!vivo) return;
        if (!d?.mensagem) throw new Error("A IA não devolveu texto desta vez. Tente de novo.");
        setTexto(d.mensagem);
        setTelefone(d.telefone ?? null);
      })
      .catch((e) => {
        if (vivo) setErro(e instanceof Error ? e.message : "Não consegui gerar a mensagem.");
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [recomendacao.id]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Navegador sem permissão de área de transferência: seleciona o texto.
      const campo = document.getElementById("mensagem-gerada") as HTMLTextAreaElement | null;
      campo?.select();
      document.execCommand?.("copy");
    }
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2000);
  }

  const whats = texto ? linkWhatsApp(telefone, texto) : null;

  return (
    <Janela
      aberto
      aoFechar={aoFechar}
      titulo="Mensagem sugerida"
      rodape={
        <>
          {whats && (
            <a href={whats} target="_blank" rel="noopener noreferrer" className={classeBotao("secundario")}>
              <MessageCircle size={15} aria-hidden /> Abrir WhatsApp
            </a>
          )}
          <Botao variante="primario" icone={copiado ? Check : Copy} onClick={copiar} disabled={!texto}>
            {copiado ? "Copiado" : "Copiar"}
          </Botao>
        </>
      }
    >
      <p className="mb-3 text-xs text-aura-graphite-soft">{recomendacao.titulo}</p>
      {carregando ? (
        <div className="flex items-center gap-2 rounded-lg bg-aura-sunken px-3 py-6 text-sm text-aura-graphite-soft">
          <Loader2 size={15} className="animate-spin" aria-hidden /> A AURA está escrevendo…
        </div>
      ) : erro ? (
        <p className="rounded-lg bg-aura-danger/10 px-3 py-3 text-sm text-aura-danger">{erro}</p>
      ) : (
        <>
          <label htmlFor="mensagem-gerada" className="aura-label">
            Revise antes de enviar
          </label>
          <textarea
            id="mensagem-gerada"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={7}
            className="aura-input resize-y text-sm leading-relaxed"
          />
          <p className="mt-2 text-[0.6875rem] text-aura-graphite-soft">
            Nada é enviado sozinho: copie, ajuste se quiser e mande você mesmo{whats ? " (o WhatsApp abre com o texto pronto)" : ""}.
          </p>
        </>
      )}
    </Janela>
  );
}
