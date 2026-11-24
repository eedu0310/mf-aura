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
  // Resultado da volta do Instagram (?ig=ok|erro&msg=...).
  const [retorno, setRetorno] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const ig = sp.get("ig");
    if (!ig) return;
    setRetorno({ ok: ig === "ok", msg: sp.get("msg") ?? "" });
    // Tira os parâmetros da barra para um F5 não repetir o aviso.
    window.history.replaceState(null, "", "/gestor");
  }, []);

  function conectarComInstagram(empresa: string) {
    window.location.href = `/api/meta/conectar?empresa=${encodeURIComponent(empresa)}`;
  }

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

      {retorno && (
        <p
          className={`rounded-lg px-4 py-2 text-sm ${retorno.ok ? "bg-aura-success/10 text-aura-success" : "bg-aura-danger/10 text-aura-danger"}`}
          role="status"
        >
          {retorno.msg || (retorno.ok ? "Conta conectada." : "Não consegui conectar.")}
        </p>
      )}

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
                <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => conectarComInstagram(loja.empresa)}
                  title="Entrar de novo no Instagram e renovar a conexão"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-aura-mist px-3 py-1.5 text-sm text-aura-graphite transition hover:bg-aura-bg"
                >
                  <AtSign size={14} />
                  Reconectar
                </button>
                <button
                  type="button"
                  onClick={() => void desconectar(loja.empresa)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-aura-mist px-3 py-1.5 text-sm text-aura-graphite transition hover:bg-aura-bg"
                >
                  <Unlink size={14} />
                  Desconectar
                </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => conectarComInstagram(loja.empresa)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#833ab4] via-[#e1306c] to-[#f77737] px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    <AtSign size={14} />
                    Conectar com o Instagram
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbrindo(abrindo === loja.empresa ? null : loja.empresa)}
                    className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs text-aura-graphite-soft underline-offset-2 hover:underline"
                  >
                    <Link2 size={12} />
                    Colar token manualmente
                  </button>
                </div>
              )}
            </div>

            {dias != null && dias <= 10 && loja.conectada && (
              <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-aura-warning/10 px-3 py-2 text-sm text-aura-graphite">
                <AlertTriangle size={14} className="text-aura-warning" />
                O acesso desta conta vence em {dias} dia{dias === 1 ? "" : "s"}. Clique em Reconectar antes disso,
                senão as mensagens param de chegar sem aviso.
              </p>
            )}

            {loja.conectada && <DiagnosticoInstagram empresa={loja.empresa} />}

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

/**
 * O que a Meta responde para esta conta: se o token vale, se os avisos de
 * mensagem estão ligados, se as conversas e publicações aparecem e os últimos
 * avisos que chegaram ao AURA. Feito para descobrir na hora "por que a
 * mensagem não chegou".
 */
function DiagnosticoInstagram({ empresa }: { empresa: string }) {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<any>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const q = `empresa=${encodeURIComponent(empresa)}`;

  async function ver() {
    setOcupado("ver");
    try {
      const r = await fetch(`/api/meta/diagnostico?${q}`, { cache: "no-store" });
      setDados(await r.json());
    } finally {
      setOcupado(null);
    }
  }

  async function acao(nome: "assinar" | "importar") {
    setOcupado(nome);
    setResultado(null);
    try {
      const r = await fetch(`/api/meta/diagnostico?${q}&acao=${nome}`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      setResultado(
        nome === "assinar"
          ? d.ok
            ? "Avisos de mensagem e comentário ligados."
            : `A Meta recusou: ${(d.erros ?? [d.erro]).join(" | ")}`
          : `Histórico: ${d.conversas ?? 0} conversas, ${d.mensagens ?? 0} mensagens, ${d.comentarios ?? 0} comentários.` +
              (d.avisos?.length ? ` Avisos: ${d.avisos.join(" | ")}` : ""),
      );
      void ver();
    } finally {
      setOcupado(null);
    }
  }

  const linha = (rotulo: string, item: any) => (
    <li className="flex gap-2">
      <span className={item?.ok ? "text-aura-success" : "text-aura-danger"}>{item?.ok ? "OK" : "Falhou"}</span>
      <span className="text-aura-graphite">{rotulo}</span>
      {!item?.ok && item?.erros && <span className="text-aura-graphite-soft">— {item.erros.join(" | ")}</span>}
    </li>
  );

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => {
          setAberto((v) => !v);
          if (!aberto && !dados) void ver();
        }}
        className="text-xs text-aura-petrol-600 underline-offset-2 hover:underline"
      >
        {aberto ? "Fechar diagnóstico" : "Diagnóstico da conexão"}
      </button>
      {aberto && (
        <div className="mt-2 space-y-2 rounded-lg bg-aura-bg p-3 text-xs">
          {ocupado === "ver" && !dados && <p>Consultando a Meta…</p>}
          {dados?.erro && <p className="text-aura-danger">{dados.erro}</p>}
          {dados && !dados.erro && (
            <>
              <ul className="space-y-1">
                {linha("Token e perfil da conta", dados.perfil)}
                {linha("Avisos (webhook) assinados pela conta", dados.avisosAssinados)}
                {linha(`Conversas do direct${dados.conversas?.ok ? ` (${dados.conversas.quantas} visíveis)` : ""}`, dados.conversas)}
                {linha("Publicações e comentários", dados.publicacoes)}
                <li className="flex gap-2">
                  <span className={dados.webhook?.segredoConfigurado ? "text-aura-success" : "text-aura-danger"}>
                    {dados.webhook?.segredoConfigurado ? "OK" : "Falta"}
                  </span>
                  <span className="text-aura-graphite">Chave secreta do app no servidor</span>
                </li>
              </ul>
              <div>
                <p className="font-medium text-aura-graphite">
                  Últimos avisos recebidos da Meta ({dados.webhook?.ultimosAvisos?.length ?? 0})
                </p>
                {(dados.webhook?.ultimosAvisos ?? []).slice(0, 8).map((a: any, i: number) => (
                  <p key={i} className="text-aura-graphite-soft">
                    {new Date(a.em).toLocaleString("pt-BR")} · {a.objeto ?? "?"} · {a.campos.join(", ") || "—"} ·{" "}
                    {a.assinaturaOk ? (a.lojas.some(Boolean) ? `loja: ${a.lojas.filter(Boolean).join(", ")}` : `conta ${a.contas.join(", ")} sem loja`) : "assinatura inválida"}
                    {a.erro ? ` · ${a.erro}` : ""}
                  </p>
                ))}
                {!dados.webhook?.ultimosAvisos?.length && (
                  <p className="text-aura-graphite-soft">Nenhum aviso desde o último reinício do servidor.</p>
                )}
              </div>
            </>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => void ver()} disabled={!!ocupado} className="rounded border border-aura-mist bg-white px-2 py-1 disabled:opacity-50">
              Atualizar
            </button>
            <button type="button" onClick={() => void acao("assinar")} disabled={!!ocupado} className="rounded border border-aura-mist bg-white px-2 py-1 disabled:opacity-50">
              {ocupado === "assinar" ? "Ligando…" : "Religar avisos"}
            </button>
            <button type="button" onClick={() => void acao("importar")} disabled={!!ocupado} className="rounded border border-aura-mist bg-white px-2 py-1 disabled:opacity-50">
              {ocupado === "importar" ? "Puxando…" : "Puxar histórico"}
            </button>
          </div>
          {resultado && <p className="text-aura-graphite">{resultado}</p>}
        </div>
      )}
    </div>
  );
}
