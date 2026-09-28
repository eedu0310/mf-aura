"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Send, AlertCircle, Loader2, Menu } from "lucide-react";
import { useUserProfile } from "@/lib/user-profile-context";
import { useAppData } from "@/lib/app-data-context";
import { montarContextoDados } from "@/lib/build-coach-context";
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

type Mensagem = { id: string; autor: "usuario" | "aura"; texto: string };

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

export function AuraCoachChat() {
  const { profile } = useUserProfile();
  const { relacionamentos, oportunidades, vendas, atividades, playbook } = useAppData();
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

  const gerarSaudacaoInicial = useCallback(async (): Promise<Mensagem[]> => {
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

    try {
      const resp = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modo: "chat",
          contexto,
          playbook,
          mensagens: [
            {
              autor: "usuario",
              texto:
                "Monte meu resumo do dia: o que eu preciso priorizar agora (follow-ups atrasados, contatos marcados para hoje, oportunidades paradas, relacionamentos esfriando). Seja direto, use nomes reais, e feche perguntando se pode ajudar em algo específico.",
            },
          ],
        }),
      });
      const dados = await resp.json();
      if (!resp.ok || !dados.resposta) {
        throw new Error(dados.erro ?? "AURA IA não está disponível.");
      }

      return [{ id: "boas-vindas", autor: "aura", texto: `Oi, ${primeiroNome}! ${dados.resposta}` }];
    } catch (error) {
      console.error("AURA: falha ao carregar saudação com dados reais", error);
      return [
        {
          id: "erro-aura",
          autor: "aura",
          texto: `Oi, ${primeiroNome}! Não consegui carregar seus dados reais agora. ${motivoLegivel(error)}`,
        },
      ];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primeiroNome, profile.nome, profile.empresa, playbook]);

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
              {mensagens.map((m) => (
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
              ))}
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
            placeholder="Pergunte algo à AURA..."
            className="flex-1 rounded-full border border-aura-mist bg-aura-bg px-4 py-2.5 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft focus:border-aura-petrol-500"
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
