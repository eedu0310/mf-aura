"use client";

import { useCallback, useEffect, useState } from "react";
import { ListPlus, Loader2, Plus, Trash2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/lib/user-profile-context";

/**
 * Linhas que o gestor acrescenta na planilha mensal do vendedor.
 *
 * As nove linhas originais estavam escritas no componente da planilha, então
 * medir qualquer coisa nova dependia de mexer no código. Cada loja mede coisas
 * diferentes: a linha nasce da empresa de quem a criou.
 *
 * Desligar em vez de apagar preserva o mês já preenchido — a linha some da
 * planilha daqui para a frente sem levar embora o que a equipe lançou. Apagar
 * de vez fica disponível para quem errou o nome no minuto seguinte.
 */

type Linha = {
  id: string;
  titulo: string;
  ordem: number;
  ativo: boolean;
};

export function PlanilhaLinhasCard() {
  const { profile } = useUserProfile();
  const supabase = getSupabaseBrowserClient();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [titulo, setTitulo] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!supabase) return;
    setCarregando(true);
    const { data, error } = await supabase
      .from("planilha_linhas")
      .select("id, titulo, ordem, ativo")
      .order("ordem", { ascending: true })
      .order("titulo", { ascending: true });
    if (error) setErro("Não consegui carregar as linhas.");
    else {
      setLinhas((data as Linha[]) ?? []);
      setErro(null);
    }
    setCarregando(false);
  }, [supabase]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function acrescentar() {
    const nome = titulo.trim();
    if (!supabase || !nome) return;
    if (linhas.some((l) => l.titulo.toLowerCase() === nome.toLowerCase())) {
      setErro("Já existe uma linha com esse nome.");
      return;
    }
    setSalvando(true);
    const { error } = await supabase.from("planilha_linhas").insert({
      empresa: profile.empresa,
      titulo: nome,
      ordem: linhas.length,
    });
    setSalvando(false);
    if (error) {
      setErro("Não consegui acrescentar. Confira se você é gestor desta loja.");
      return;
    }
    setTitulo("");
    setErro(null);
    void carregar();
  }

  async function alternar(linha: Linha) {
    if (!supabase) return;
    await supabase.from("planilha_linhas").update({ ativo: !linha.ativo }).eq("id", linha.id);
    void carregar();
  }

  async function apagar(id: string) {
    if (!supabase) return;
    await supabase.from("planilha_linhas").delete().eq("id", id);
    setConfirmando(null);
    void carregar();
  }

  return (
    <div className="rounded-2xl border border-aura-mist bg-white p-6">
      <div className="flex items-start gap-3">
        <ListPlus size={18} className="mt-0.5 shrink-0 text-aura-petrol-600" />
        <div>
          <p className="text-lg font-semibold text-aura-graphite">Linhas da planilha</p>
          <p className="mt-0.5 text-sm text-aura-graphite-soft">
            As nove linhas padrão vêm de fábrica. Aqui você acrescenta o que a sua loja
            também quer medir — a linha aparece na planilha de todo mundo da {profile.empresa}.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void acrescentar();
          }}
          placeholder="Ex.: Visitas a arquitetos"
          maxLength={80}
          className="flex-1 rounded-lg border border-aura-mist px-3 py-2 text-sm text-aura-graphite outline-none focus:border-aura-petrol-600"
        />
        <button
          type="button"
          onClick={() => void acrescentar()}
          disabled={salvando || !titulo.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-aura-navy-950 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Acrescentar
        </button>
      </div>

      {erro && <p className="mt-2 text-sm text-aura-danger">{erro}</p>}

      <div className="mt-4">
        {carregando ? (
          <p className="py-6 text-center text-sm text-aura-graphite-soft">Carregando…</p>
        ) : linhas.length === 0 ? (
          <p className="py-6 text-center text-sm text-aura-graphite-soft">
            Nenhuma linha própria ainda. A planilha está com as nove padrão.
          </p>
        ) : (
          <ul className="divide-y divide-aura-mist">
            {linhas.map((linha) => (
              <li key={linha.id} className="flex items-center justify-between gap-3 py-2.5">
                <span
                  className={`text-sm ${
                    linha.ativo ? "text-aura-graphite" : "text-aura-graphite-soft line-through"
                  }`}
                >
                  {linha.titulo}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void alternar(linha)}
                    className="rounded-lg border border-aura-mist px-2.5 py-1 text-xs font-medium text-aura-graphite transition hover:bg-aura-bg"
                  >
                    {linha.ativo ? "Desligar" : "Ligar"}
                  </button>
                  {confirmando === linha.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void apagar(linha.id)}
                        className="rounded-lg bg-aura-danger px-2.5 py-1 text-xs font-semibold text-white"
                      >
                        Apagar mesmo
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmando(null)}
                        className="rounded-lg px-2 py-1 text-xs text-aura-graphite-soft"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmando(linha.id)}
                      aria-label={`Apagar a linha ${linha.titulo}`}
                      className="rounded-lg p-1.5 text-aura-graphite-soft transition hover:bg-aura-danger/10 hover:text-aura-danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 text-xs text-aura-graphite-soft">
        Desligar tira a linha da planilha daqui para a frente e guarda o que já foi
        preenchido. Apagar leva junto o histórico dela.
      </p>
    </div>
  );
}
