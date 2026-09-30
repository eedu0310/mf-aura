"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, AtSign, CheckCircle2, Loader2, Link2, Unlink } from "lucide-react";

/**
 * Instagram por loja, e quem atende cada uma.
 *
 * São quatro contas — a fábrica e as três lojas — e em cada uma só o vendedor
 * interno responde. Por isso a liberação é pessoa a pessoa: ligar por cargo
 * daria a caixa de entrada da loja a todo mundo.
 *
 * O token some da tela depois de colado. Quem o guarda é o servidor; nem o
 * gestor o lê de volta.
 */

interface Pessoa {
  id: string;
  nome: string;
  cargo: string;
  atende: boolean;
}

interface Loja {
  empresa: string;
  conectada: boolean;
  usuario: string | null;
  conectadaEm: string | null;
  expiraEm: string | null;
  equipe: Pessoa[];
}

function diasAte(iso: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000);
}

export function InstagramTab() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [usuario, setUsuario] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/gestor/instagram", { cache: "no-store" });
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.erro ?? "Não consegui carregar.");
      setLojas(dados.lojas ?? []);
      setErro(null);
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui carregar.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function conectar(empresa: string) {
    if (token.trim().length < 20) {
      setErro("Cole o token inteiro que a Meta gerou.");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/gestor/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa, token: token.trim(), usuario: usuario.trim() }),
      });
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.erro ?? "Não consegui conectar.");
      setToken("");
      setUsuario("");
      setAbrindo(null);
      setErro(null);
      void carregar();
    } catch (e: any) {
      setErro(e?.message ?? "Não consegui conectar.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarPessoa(pessoa: Pessoa) {
    // Otimista: a chave responde na hora e volta atrás se o servidor recusar.
    setLojas((atual) =>
      atual.map((l) => ({
        ...l,
        equipe: l.equipe.map((p) => (p.id === pessoa.id ? { ...p, atende: !p.atende } : p)),
      })),
    );
    const res = await fetch("/api/gestor/instagram", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pessoaId: pessoa.id, atende: !pessoa.atende }),
    });
    if (!res.ok) {
      const dados = await res.json().catch(() => ({}));
      setErro(dados.erro ?? "Não consegui salvar.");
      void carregar();
    }
  }

  async function desconectar(empresa: string) {
    await fetch(`/api/gestor/instagram?empresa=${encodeURIComponent(empresa)}`, { method: "DELETE" });
    void carregar();
  }

  if (carregando) {
    return <p className="py-10 text-center text-sm text-aura-graphite-soft">Carregando…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-aura-mist bg-white p-6">
        <div className="flex items-start gap-3">
          <AtSign size={18} className="mt-0.5 shrink-0 text-aura-petrol-600" />
          <div>
            <p className="text-lg font-semibold text-aura-graphite">Instagram das lojas</p>
            <p className="mt-0.5 text-sm text-aura-graphite-soft">
              Cada loja conecta a própria conta e você escolhe quem atende. Quem estiver ligado aqui
              passa a ver a aba do Instagram, com as mensagens e os comentários daquela conta.
            </p>
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-aura-bg px-3 py-2 text-xs text-aura-graphite-soft">
          No Instagram quem começa a conversa é sempre o cliente, e a resposta tem prazo de 24 horas
          a partir da última mensagem dele. Passou disso, só dá para responder quando ele escrever de
          novo — é regra da Meta, não do AURA.
        </p>
      </div>

      {erro && <p className="rounded-lg bg-aura-danger/10 px-4 py-2 text-sm text-aura-danger">{erro}</p>}

      {lojas.map((loja) => {
        const dias = diasAte(loja.expiraEm);
        const atendentes = loja.equipe.filter((p) => p.atende);
        return (
          <div key={loja.empresa} className="rounded-2xl border border-aura-mist bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-aura-graphite">{loja.empresa}</p>
                {loja.conectada ? (
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm text-aura-success">
                    <CheckCircle2 size={14} />
                    Conectada{loja.usuario ? ` como @${loja.usuario}` : ""}
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm text-aura-graphite-soft">Ainda não conectada</p>
                )}
              </div>
              {loja.conectada ? (
                <button
                  type="button"
                  onClick={() => void desconectar(loja.empresa)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-aura-mist px-3 py-1.5 text-sm text-aura-graphite transition hover:bg-aura-bg"
                >
                  <Unlink size={14} />
                  Desconectar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAbrindo(abrindo === loja.empresa ? null : loja.empresa)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-aura-navy-950 px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  <Link2 size={14} />
                  Conectar conta
                </button>
              )}
            </div>

            {dias != null && dias <= 10 && loja.conectada && (
              <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-aura-warning/10 px-3 py-2 text-sm text-aura-graphite">
                <AlertTriangle size={14} className="text-aura-warning" />
                O acesso desta conta vence em {dias} dia{dias === 1 ? "" : "s"}. Renove o token antes disso,
                senão as mensagens param de chegar sem aviso.
              </p>
            )}

            {abrindo === loja.empresa && (
              <div className="mt-4 space-y-2 rounded-lg bg-aura-bg p-4">
                <input
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="@ da conta (ex.: lflareiras)"
                  className="w-full rounded-lg border border-aura-mist px-3 py-2 text-sm outline-none focus:border-aura-petrol-600"
                />
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  type="password"
                  placeholder="Token de acesso gerado no painel da Meta"
                  className="w-full rounded-lg border border-aura-mist px-3 py-2 text-sm outline-none focus:border-aura-petrol-600"
                />
                <p className="text-xs text-aura-graphite-soft">
                  O token não volta a aparecer depois de salvo. Guarde uma cópia no cofre de senhas de vocês.
                </p>
                <button
                  type="button"
                  onClick={() => void conectar(loja.empresa)}
                  disabled={salvando}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-aura-navy-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {salvando && <Loader2 size={14} className="animate-spin" />}
                  Salvar conexão
                </button>
              </div>
            )}

            <div className="mt-4 border-t border-aura-mist pt-3">
              <p className="text-sm font-medium text-aura-graphite">Quem atende esta conta</p>
              <p className="mb-2 text-xs text-aura-graphite-soft">
                {atendentes.length === 0
                  ? "Ninguém ainda — a aba do Instagram não aparece para esta loja."
                  : `${atendentes.length} pessoa${atendentes.length === 1 ? "" : "s"} com acesso.`}
              </p>
              {loja.equipe.length === 0 ? (
                <p className="py-2 text-sm text-aura-graphite-soft">Nenhuma pessoa ativa nesta loja.</p>
              ) : (
                <ul className="divide-y divide-aura-mist">
                  {loja.equipe.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="text-sm text-aura-graphite">
                        {p.nome}
                        <span className="ml-2 text-xs text-aura-graphite-soft">{p.cargo}</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={p.atende}
                        aria-label={`Atendimento pelo Instagram para ${p.nome}`}
                        onClick={() => void alternarPessoa(p)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                          p.atende ? "bg-aura-success" : "bg-aura-mist"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                            p.atende ? "left-[22px]" : "left-0.5"
                          }`}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
