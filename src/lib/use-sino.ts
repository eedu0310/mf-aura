"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppData } from "@/lib/app-data-context";
import { computePendingTasks, type TarefaPendente } from "@/lib/compute-pending-tasks";
import { useAvisoMissoes } from "@/lib/use-aviso-missoes";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Notificacao } from "@/lib/supabase/notificacoes";

/**
 * O sininho, igual no computador e no celular.
 *
 * O NÚMERO É DO QUE AINDA NÃO FOI VISTO, e abrir o sino é ver. Antes o número
 * só baixava clicando em cada aviso, um por um, e abrir o sino zerava apenas a
 * tela: no F5 voltava tudo. Com aviso chegando o dia inteiro (lead novo, lead
 * sem resposta, aprendizado da AURA), ninguém dava conta de clicar em todos e
 * o número só subia — 202 não lidos numa conta, desde 13/10. Um número que
 * nunca baixa deixa de avisar.
 *
 * Agora, como no WhatsApp: abriu o sino, os avisos do banco são marcados como
 * lidos e o número zera de vez. A lista continua mostrando os recentes (os já
 * vistos em cinza), para nada sumir de quem quer reler.
 *
 * Os lembretes calculados na hora (follow-up atrasado, de hoje, esfriando,
 * missões) não existem no banco. Ficam "vistos" no aparelho até o fim do dia;
 * no dia seguinte, se ainda estiverem pendentes, contam de novo.
 */
const AVISOS_NA_LISTA = 30;
const ATUALIZA_MS = 60_000;

function chaveDoDia() {
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return `aura:sino:vistos:${hoje}`;
}

function lerVistos(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(chaveDoDia()) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function gravarVistos(ids: Set<string>) {
  try {
    // Só o dia de hoje fica guardado; os dias anteriores saem.
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith("aura:sino:vistos:") && k !== chaveDoDia()) localStorage.removeItem(k);
    }
    localStorage.setItem(chaveDoDia(), JSON.stringify([...ids]));
  } catch {
    /* sem armazenamento: o lembrete volta a contar no próximo carregamento */
  }
}

function daLinha(n: Record<string, unknown>): Notificacao {
  return {
    id: String(n.id),
    titulo: String(n.titulo ?? ""),
    mensagem: String(n.mensagem ?? ""),
    tipo: n.tipo as Notificacao["tipo"],
    lida: !!n.lida,
    acaoUrl: (n.acao_url as string | null) ?? undefined,
    criadaEm: String(n.criada_em ?? ""),
    lidaEm: (n.lida_em as string | null) ?? undefined,
  };
}

export interface Sino {
  /** Avisos do banco, mais novos primeiro, lidos e não lidos. */
  avisos: Notificacao[];
  /** Lembretes calculados (follow-up, missões). */
  lembretes: TarefaPendente[];
  /** O que entra no número vermelho. */
  numero: number;
  /** Ids que chegaram depois da última abertura, para destacar na lista. */
  novos: Set<string>;
  /** Chamar ao abrir o sino: zera o número. */
  abrir: () => void;
}

export function useSino(): Sino {
  const { relacionamentos } = useAppData();
  const avisoMissoes = useAvisoMissoes();

  // Respeita o interruptor "Follow-ups atrasados" das Configurações.
  const [avisarFollowUp, setAvisarFollowUp] = useState(true);
  useEffect(() => {
    try {
      setAvisarFollowUp(localStorage.getItem("aura:avisoFollowUp") !== "false");
    } catch {
      /* sem armazenamento: mantém ligado */
    }
  }, []);

  const lembretes = useMemo(
    () => [...(avisoMissoes ? [avisoMissoes] : []), ...(avisarFollowUp ? computePendingTasks(relacionamentos) : [])],
    [avisoMissoes, avisarFollowUp, relacionamentos],
  );

  const [avisos, setAvisos] = useState<Notificacao[]>([]);
  const [naoLidosNoBanco, setNaoLidosNoBanco] = useState(0);
  const [vistos, setVistos] = useState<Set<string>>(new Set());
  const [novos, setNovos] = useState<Set<string>>(new Set());

  useEffect(() => {
    setVistos(lerVistos());
  }, []);

  const carregar = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return;
    const [lista, conta] = await Promise.all([
      sb
        .from("notificacoes")
        .select("*")
        .eq("vendedor_id", user.id)
        .order("criada_em", { ascending: false })
        .limit(AVISOS_NA_LISTA),
      // A conta vem do banco, não da lista: a lista mostra só os mais novos,
      // e quem tem mais não lidos do que cabem nela veria um número errado.
      sb
        .from("notificacoes")
        .select("id", { count: "exact", head: true })
        .eq("vendedor_id", user.id)
        .eq("lida", false),
    ]);
    if (lista.data) {
      const linhas = lista.data.map(daLinha);
      setAvisos(linhas);
      setNovos(new Set(linhas.filter((a) => !a.lida).map((a) => a.id)));
    }
    setNaoLidosNoBanco(conta.count ?? 0);
  }, []);

  useEffect(() => {
    void carregar();
    const t = setInterval(() => void carregar(), ATUALIZA_MS);
    return () => clearInterval(t);
  }, [carregar]);

  const lembretesNaoVistos = lembretes.filter((l) => !vistos.has(l.id)).length;
  const numero = naoLidosNoBanco + lembretesNaoVistos;

  const abrir = useCallback(() => {
    // Lembretes de hoje: vistos neste aparelho.
    const todos = new Set([...vistos, ...lembretes.map((l) => l.id)]);
    setVistos(todos);
    gravarVistos(todos);

    if (naoLidosNoBanco === 0) return;
    // Avisos do banco: lidos de verdade, todos de uma vez. A lista continua
    // destacando os que eram novos até a próxima atualização.
    setNaoLidosNoBanco(0);
    setAvisos((atual) => atual.map((a) => ({ ...a, lida: true })));
    void (async () => {
      const sb = getSupabaseBrowserClient();
      if (!sb) return;
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return;
      const { error } = await sb
        .from("notificacoes")
        .update({ lida: true, lida_em: new Date().toISOString() })
        .eq("vendedor_id", user.id)
        .eq("lida", false);
      if (error) {
        console.error("Erro ao marcar avisos como lidos:", error);
        void carregar();
      }
    })();
  }, [vistos, lembretes, naoLidosNoBanco, carregar]);

  return { avisos, lembretes, numero, novos, abrir };
}

/** "99+" quando passa de 99, para a bolinha não estourar. */
export function numeroDoSino(n: number): string {
  return n > 99 ? "99+" : String(n);
}
