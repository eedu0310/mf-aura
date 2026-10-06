"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Send, AlertCircle, Loader2, Menu } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { useAppData } from "@/lib/app-data-context";
import { montarContextoDados } from "@/lib/build-coach-context";
import { BotaoMicrofone } from "@/components/voz/botao-microfone";
import {
  listarConversas,
  criarConversa,
  apagarConversa,
  carregarMensagens,
  salvarMensagemCoach,
  renomearConversa,
  type ConversaSalva,
} from "@/lib/supabase/coach-messages";
import { listarCompromissos } from "@/lib/supabase/compromissos";
import { listarPosVendas } from "@/lib/supabase/pos-venda";
import { carregarEquipe } from "@/lib/supabase/team";
import { listarLeads } from "@/lib/supabase/leads";
import { buscarCompromissoDoMes } from "@/lib/supabase/compromisso-mensal";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ConversationSidebar } from "./conversation-sidebar";
import {
  montarRaioX,
  montarRaioXDaEquipe,
  type RaioX,
  type RaioXDeUmVendedor,
} from "@/lib/raio-x/montar";
import { RaioXDaEquipe, RaioXDoDia } from "@/components/raio-x/raio-x-do-dia";
import { saudacaoDoDia } from "@/lib/date-local";

/**
 * Uma mensagem do chat. A primeira da conversa é especial: em vez de texto,
 * ela carrega o raio-x do dia, que é desenhado em blocos. Por isso `raioX`,
 * e não mais só `texto`.
 */
type Mensagem = {
  id: string;
  autor: "usuario" | "aura";
  texto: string;
  raioX?: RaioX;
  /** A visão do gestor: um raio-x por pessoa da loja. */
  equipe?: RaioXDeUmVendedor[];
};

/**
 * O que dizer ao vendedor quando a IA nao respondeu.
 *
 * A tela trocava qualquer falha por "Tente novamente em instantes", entao o
 * motivo que a rota ja mandava morria na traducao e ninguem tinha como
 * consertar. Saldo e configuracao sao recados que ele entende e resolve
 * (ou leva ao gestor); o resto vira uma frase curta com a causa, que e o
 * que se copia para quem cuida do sistema.
 */
function motivoLegivel(erro: unknown): string {
  const bruto = String((erro as { message?: string })?.message ?? erro ?? "").trim();
  if (!bruto) return "Tente novamente em instantes.";
  if (/saldo|cr[eé]dito|sobrecarregada|pedidos demais/i.test(bruto)) return bruto;
  if (/n[aã]o configurada|ANTHROPIC_API_KEY|chave/i.test(bruto)) {
    return "A chave da IA não está configurada. Avise o gestor.";
  }
  if (/autenticad/i.test(bruto)) return "Sua sessão expirou. Entre de novo.";
  const curto = bruto.replace(/^Não consegui responder agora:\s*/i, "").slice(0, 180);
  return `Motivo: ${curto}`;
}

/**
 * O raio-x em uma linha de texto, para o histórico e para a IA.
 *
 * A tela mostra os blocos; o banco guarda esta frase. Ela existe por dois
 * motivos: a conversa salva precisa de um texto para listar, e quando o
 * vendedor responde, a IA lê a primeira fala — sem isto, ela começaria sem
 * saber o que acabou de ser mostrado na tela.
 */
function resumoEmTexto(raioX: RaioX, primeiroNome: string): string {
  if (raioX.totalDeItens === 0) {
    return `Oi, ${primeiroNome}! Hoje não há nada esperando por você: sem compromisso marcado, sem follow-up vencido e sem pendência no pós-venda. Bom momento para prospectar.`;
  }
  const partes = raioX.blocos.map((b) => {
    const nomes = b.itens.slice(0, 5).map((i) => i.titulo).join(", ");
    const resto = b.total > 5 ? ` e mais ${b.total - 5}` : "";
    return `${b.titulo} (${b.total}): ${nomes}${resto}`;
  });
  return `Oi, ${primeiroNome}! Raio-x do dia — ${raioX.totalDeItens} ${
    raioX.totalDeItens === 1 ? "item" : "itens"
  }. ${partes.join(". ")}.`;
}

/** O mesmo, para a visão do gestor. */
function resumoDaEquipeEmTexto(equipe: RaioXDeUmVendedor[], primeiroNome: string): string {
  const total = equipe.reduce((s, v) => s + v.raioX.totalDeItens, 0);
  const porPessoa = equipe
    .slice(0, 10)
    .map((v) => `${v.nome}: ${v.raioX.totalDeItens}`)
    .join(", ");
  return `Oi, ${primeiroNome}! A equipe hoje — ${total} ${
    total === 1 ? "pendência" : "pendências"
  } em ${equipe.length} ${equipe.length === 1 ? "pessoa" : "pessoas"}. ${porPessoa}.`;
}

export function AuraCoachChat() {
  const { profile } = useUserProfile();
  const { relacionamentos, oportunidades, vendas, atividades, playbook, funil, nomesPorOwnerId } =
    useAppData();
  const primeiroNome = profile.nome.split(" ")[0] || "";
  const usandoSupabase = Boolean(getSupabaseBrowserClient());

  const [conversas, setConversas] = useState<ConversaSalva[]>([]);
  const [conversaAtualId, setConversaAtualId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [rascunho, setRascunho] = useState("");
  const [digitando, setDigitando] = useState(false);
  const [mostrarSidebarMobile, setMostrarSidebarMobile] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  /**
   * A primeira mensagem da conversa: o raio-x do dia.
   *
   * ANTES ISTO ERA UMA CHAMADA À IA. Ela recebia ~25 mil tokens de contexto
   * (a chamada mais cara do sistema, por chamada) e devolvia um parágrafo
   * corrido com os mesmos dados que já estavam na tela. Três problemas:
   *
   *  - saía desorganizado, e o vendedor tinha que ler tudo para achar um nome
   *  - saía CORTADO quando a lista era grande, porque batia no teto de tokens
   *    (foi assim que apareceu um "Aguardar retor" no meio da tela)
   *  - custava caro, todo dia, para cada pessoa que abria o chat
   *
   * Contar quantos follow-ups estão atrasados não é trabalho de IA. Agora a
   * conta é feita aqui, sempre igual, instantânea e de graça — e a IA fica
   * inteira para o que ela faz bem, que é responder quando o vendedor
   * pergunta.
   */
  const gerarSaudacaoInicial = useCallback(async (): Promise<Mensagem[]> => {
    const supabase = getSupabaseBrowserClient();
    const [compromissos, posVendasRaw, leads, userRes] = await Promise.all([
      listarCompromissos().then((r) => r ?? []),
      ["Pós-venda", "Gestor"].includes(profile.cargo) ? listarPosVendas() : Promise.resolve(null),
      listarLeads(),
      supabase ? supabase.auth.getUser() : Promise.resolve(null),
    ]);
    const meuId = userRes?.data?.user?.id ?? null;

    /**
     * Só o que é meu. O gestor enxerga a loja inteira pela RLS, e sem este
     * filtro o raio-x DELE viria com o follow-up atrasado de todo mundo —
     * uma lista que ele não tem como executar e que esconderia a dele.
     */
    // O dono do registro vem como ownerId em umas tabelas e vendedorId em
    // outras — por isso a função olha os dois em vez de escolher um.
    const meu = <T,>(lista: T[]): T[] =>
      meuId
        ? lista.filter((x) => {
            const r = x as { ownerId?: string; vendedorId?: string; responsavelId?: string };
            return (r.ownerId ?? r.responsavelId ?? r.vendedorId) === meuId;
          })
        : lista;

    const raioX = montarRaioX({
      compromissos: meu(compromissos ?? []),
      relacionamentos: meu(relacionamentos),
      oportunidades: meu(oportunidades),
      posVendas: posVendasRaw ? meu(posVendasRaw) : undefined,
      leadsPendentes: (leads ?? [])
        .filter((l: any) => !meuId || l.vendedorId === meuId || l.atribuidoPara === meuId)
        .filter((l: any) => !l.status || l.status === "pendente" || l.status === "novo")
        .map((l: any) => ({ id: l.id, nome: l.nome, telefone: l.telefone })),
      funil,
    });

    /**
     * O gestor vê a loja, não a carteira dele.
     *
     * Ele enxerga tudo pela RLS, então o raio-x pessoal dele viria quase
     * vazio enquanto a equipe inteira tem pendência. O que ele precisa é
     * saber DE QUEM é cada uma, para cobrar a pessoa certa — por isso aqui a
     * lista é quebrada por vendedor.
     */
    const souGestor = profile.cargo === "Gestor" || profile.cargo === "Diretor";
    const dono = (x: unknown) => {
      const r = x as { ownerId?: string; responsavelId?: string; vendedorId?: string };
      return r.ownerId ?? r.responsavelId ?? r.vendedorId ?? null;
    };

    const equipe = souGestor
      ? montarRaioXDaEquipe(
          {
            compromissos: (compromissos ?? []).map((c) => ({ ...c, dono: dono(c) })),
            relacionamentos: relacionamentos.map((r) => ({ ...r, dono: dono(r) })),
            oportunidades: oportunidades.map((o) => ({ ...o, dono: dono(o) })),
            posVendas: (posVendasRaw ?? []).map((p) => ({ ...p, dono: dono(p) })),
            leadsPendentes: (leads ?? [])
              .filter((l: any) => !l.status || l.status === "pendente" || l.status === "novo")
              .map((l: any) => ({
                id: l.id,
                nome: l.nome,
                telefone: l.telefone,
                dono: l.vendedorId ?? l.atribuidoPara ?? null,
              })),
            funil,
          },
          Object.entries(nomesPorOwnerId).map(([id, nome]) => ({ id, nome })),
        )
      : null;

    return [
      {
        id: "raio-x-do-dia",
        autor: "aura",
        // O texto continua existindo: é ele que fica salvo no histórico da
        // conversa e o que a IA lê como primeira fala quando o vendedor
        // responde. Sem isto, a conversa começaria sem memória do que foi
        // mostrado.
        texto: equipe?.length
          ? resumoDaEquipeEmTexto(equipe, primeiroNome)
          : resumoEmTexto(raioX, primeiroNome),
        raioX: equipe?.length ? undefined : raioX,
        equipe: equipe?.length ? equipe : undefined,
      },
    ];
     
  }, [primeiroNome, profile.cargo, relacionamentos, oportunidades, funil, nomesPorOwnerId]);

  useEffect(() => {
    async function iniciar() {
      if (!usandoSupabase) {
        setMensagens(await gerarSaudacaoInicial());
        setCarregandoHistorico(false);
        return;
      }

      const lista = await listarConversas();
      setConversas(lista ?? []);

      if (lista && lista.length > 0) {
        await abrirConversa(lista[0].id);
      } else {
        await iniciarNovaConversa();
      }
      setCarregandoHistorico(false);
    }

    iniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, digitando]);

  async function abrirConversa(id: string) {
    setCarregandoHistorico(true);
    setConversaAtualId(id);
    setMostrarSidebarMobile(false);
    const historico = await carregarMensagens(id);
    setMensagens(historico && historico.length > 0 ? historico : await gerarSaudacaoInicial());
    setCarregandoHistorico(false);
  }

  async function iniciarNovaConversa() {
    setCarregandoHistorico(true);
    const mensagensIniciais = await gerarSaudacaoInicial();
    setMensagens(mensagensIniciais);
    setMostrarSidebarMobile(false);
    setCarregandoHistorico(false);

    if (!usandoSupabase) return;

    const novoId = await criarConversa();
    if (!novoId) return;

    setConversaAtualId(novoId);
    for (const m of mensagensIniciais) {
      await salvarMensagemCoach(novoId, m.autor, m.texto);
    }
    const listaAtualizada = await listarConversas();
    setConversas(listaAtualizada ?? []);
  }

  async function apagarConversaAtual(id: string) {
    await apagarConversa(id);
    const listaAtualizada = await listarConversas();
    setConversas(listaAtualizada ?? []);

    if (id === conversaAtualId) {
      if (listaAtualizada && listaAtualizada.length > 0) {
        await abrirConversa(listaAtualizada[0].id);
      } else {
        await iniciarNovaConversa();
      }
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const texto = rascunho.trim();
    if (!texto) return;

    let idConversa = conversaAtualId;
    const primeiraMensagemDoUsuario = !mensagens.some((m) => m.autor === "usuario");

    if (usandoSupabase && !idConversa) {
      idConversa = await criarConversa(texto);
      setConversaAtualId(idConversa);
    }

    const novaMensagem: Mensagem = { id: crypto.randomUUID(), autor: "usuario", texto };
    const historico = [...mensagens, novaMensagem];
    setMensagens(historico);
    setRascunho("");
    setDigitando(true);

    if (idConversa) {
      void salvarMensagemCoach(idConversa, "usuario", texto);
      if (primeiraMensagemDoUsuario) {
        await renomearConversa(idConversa, texto);
        const listaAtualizada = await listarConversas();
        setConversas(listaAtualizada ?? []);
      }
    }

    try {
      const supabase = getSupabaseBrowserClient();
      const [compromissos, posVendasRaw, equipe, leads, userRes, compromissoMensal] = await Promise.all([
        listarCompromissos().then((r) => r ?? []),
        ["Pós-venda", "Gestor"].includes(profile.cargo) ? listarPosVendas() : Promise.resolve(null),
        carregarEquipe(),
        listarLeads(),
        supabase ? supabase.auth.getUser() : Promise.resolve(null),
        buscarCompromissoDoMes(),
      ]);
      const meuId = userRes?.data?.user?.id;
      const contexto = montarContextoDados({
        nome: profile.nome,
        empresa: profile.empresa,
        relacionamentos,
        oportunidades,
        vendas,
        atividades,
        compromissos,
        posVendas: posVendasRaw ?? undefined,
        equipe: equipe ?? undefined,
        leads: leads ?? undefined,
        meuId,
        compromissoMensal,
      });

      const resp = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modo: "chat",
          contexto,
          playbook,
          mensagens: historico.map((m) => ({ autor: m.autor, texto: m.texto })),
        }),
      });
      const dados = await resp.json();

      if (!resp.ok || !dados.resposta) {
        throw new Error(dados.erro ?? "AURA IA não está disponível.");
      }
      setMensagens((prev) => [
        ...prev,
        { id: crypto.randomUUID(), autor: "aura", texto: dados.resposta },
      ]);
      if (idConversa) void salvarMensagemCoach(idConversa, "aura", dados.resposta);
    } catch (error) {
      console.error("AURA: falha ao responder com dados reais", error);
      const textoErro = `Não consegui responder com os dados reais agora. ${motivoLegivel(error)}`;
      setMensagens((prev) => [...prev, { id: crypto.randomUUID(), autor: "aura", texto: textoErro }]);
    } finally {
      setDigitando(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-4xl gap-4">
      {usandoSupabase && (
        <ConversationSidebar
          conversas={conversas}
          conversaAtualId={conversaAtualId}
          onSelecionar={abrirConversa}
          onNovaConversa={iniciarNovaConversa}
          onApagar={apagarConversaAtual}
        />
      )}

      <div className="flex flex-1 flex-col rounded-2xl border border-aura-mist bg-white">
        <div className="flex items-center gap-2 border-b border-aura-mist px-5 py-4">
          {usandoSupabase && (
            <button
              type="button"
              onClick={() => setMostrarSidebarMobile((v) => !v)}
              className="text-aura-graphite-soft sm:hidden"
              aria-label="Ver conversas"
            >
              <Menu size={18} />
            </button>
          )}
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-aura-navy-950 text-aura-gold">
            <Sparkles size={15} />
          </span>
          <div>
            <p className="font-display text-sm font-semibold text-aura-graphite">
              AURA Coach
            </p>
            <p className="text-xs text-aura-graphite-soft">Seu mentor de vendas, 24h por dia</p>
          </div>
        </div>

        {mostrarSidebarMobile && usandoSupabase && (
          <div className="border-b border-aura-mist p-2 sm:hidden">
            <ConversationSidebar
              conversas={conversas}
              conversaAtualId={conversaAtualId}
              onSelecionar={abrirConversa}
              onNovaConversa={iniciarNovaConversa}
              onApagar={apagarConversaAtual}
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {carregandoHistorico ? (
            <div className="flex h-full items-center justify-center text-aura-graphite-soft">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {mensagens.map((m) =>
                // O raio-x não é um balão de conversa: é um painel. Fica mais
                // largo e sem fundo de bolha, para os blocos respirarem.
                m.raioX || m.equipe ? (
                  <div key={m.id} className="w-full">
                    {m.equipe ? (
                      <RaioXDaEquipe
                        vendedores={m.equipe}
                        nome={profile.nome}
                        saudacao={saudacaoDoDia()}
                      />
                    ) : (
                      <RaioXDoDia
                        raioX={m.raioX!}
                        nome={profile.nome}
                        saudacao={saudacaoDoDia()}
                      />
                    )}
                  </div>
                ) : (
                  <div
                    key={m.id}
                    className={`flex ${m.autor === "usuario" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        m.autor === "usuario"
                          ? "bg-aura-petrol-700 text-white"
                          : "bg-aura-bg text-aura-graphite"
                      }`}
                    >
                      {m.texto}
                    </div>
                  </div>
                ),
              )}
              {digitando && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl bg-aura-bg px-4 py-3">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-aura-graphite-soft [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-aura-graphite-soft [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-aura-graphite-soft" />
                  </div>
                </div>
              )}
              <div ref={fimRef} />
            </div>
          )}
        </div>

        <form onSubmit={enviar} className="flex items-center gap-2 border-t border-aura-mist p-4">
          <input
            type="text"
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            placeholder="Pergunte algo à AURA, ou toque no microfone e fale..."
            className="flex-1 rounded-full border border-aura-mist bg-aura-bg px-4 py-2.5 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft focus:border-aura-petrol-500"
          />
          {/* Falar em vez de digitar. O texto é ACRESCENTADO ao que já está
              escrito, nunca substitui: quem começa digitando e termina falando
              não perde o começo. */}
          <BotaoMicrofone
            aoTexto={(trecho) =>
              setRascunho((atual) => (atual.trim() ? `${atual.trim()} ${trecho}` : trecho))
            }
            titulo="Falar a pergunta"
          />
          <button
            type="submit"
            disabled={!rascunho.trim()}
            aria-label="Enviar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-aura-petrol-700 text-white transition hover:bg-aura-petrol-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
