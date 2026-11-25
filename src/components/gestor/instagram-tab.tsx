"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, AtSign, Bot, CheckCircle2, Loader2, Link2, Unlink } from "lucide-react";
import { DIAS, horarioEmTexto, type Horario, type Turno } from "@/lib/site-mf/horario";
import { Alerta, Card, CardHeader, Selo, classeBotao } from "@/components/ui";

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
    return (
      <p className="flex items-center justify-center gap-2 py-10 text-center text-sm text-aura-graphite-soft">
        <Loader2 size={15} className="animate-spin" />
        Carregando…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          icone={AtSign}
          titulo="Instagram das lojas"
          descricao="Cada loja conecta a própria conta e você escolhe quem atende. Quem estiver ligado aqui passa a ver a aba do Instagram, com as mensagens e os comentários daquela conta."
          className="mb-3"
        />
        <p className="rounded-lg border border-aura-mist bg-aura-sunken px-3 py-2 text-xs leading-relaxed text-aura-graphite-soft">
          No Instagram quem começa a conversa é sempre o cliente, e a resposta tem prazo de 24 horas
          a partir da última mensagem dele. Passou disso, só dá para responder quando ele escrever de
          novo — é regra da Meta, não do AURA.
        </p>
      </Card>

      {retorno && (
        <div role="status">
          <Alerta
            tom={retorno.ok ? "sucesso" : "perigo"}
            titulo={retorno.msg || (retorno.ok ? "Conta conectada." : "Não consegui conectar.")}
          />
        </div>
      )}

      {erro && <Alerta tom="perigo" titulo={erro} />}

      {lojas.map((loja) => {
        const dias = diasAte(loja.expiraEm);
        const atendentes = loja.equipe.filter((p) => p.atende);
        return (
          <Card key={loja.empresa}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    loja.conectada ? "bg-aura-petrol-500/12 text-aura-petrol-600" : "bg-aura-sunken text-aura-graphite-soft"
                  }`}
                >
                  <AtSign size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-aura-graphite">{loja.empresa}</p>
                  {loja.conectada ? (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-aura-success">
                      <CheckCircle2 size={13} />
                      Conectada{loja.usuario ? ` como @${loja.usuario}` : ""}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-aura-graphite-soft">Ainda não conectada</p>
                  )}
                </div>
              </div>
              {loja.conectada ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => conectarComInstagram(loja.empresa)}
                    title="Entrar de novo no Instagram e renovar a conexão"
                    className={classeBotao("secundario", "sm")}
                  >
                    <AtSign size={13} />
                    Reconectar
                  </button>
                  <button
                    type="button"
                    onClick={() => void desconectar(loja.empresa)}
                    className={classeBotao("fantasma", "sm", "hover:text-aura-danger")}
                  >
                    <Unlink size={13} />
                    Desconectar
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => conectarComInstagram(loja.empresa)}
                    className={classeBotao("primario", "sm")}
                  >
                    <AtSign size={13} />
                    Conectar com o Instagram
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbrindo(abrindo === loja.empresa ? null : loja.empresa)}
                    className={classeBotao("fantasma", "sm")}
                  >
                    <Link2 size={13} />
                    Colar token manualmente
                  </button>
                </div>
              )}
            </div>

            {dias != null && dias <= 10 && loja.conectada && (
              <Alerta
                tom="atencao"
                icone={AlertTriangle}
                className="mt-4"
                titulo={
                  <>
                    O acesso desta conta vence em {dias} dia{dias === 1 ? "" : "s"}. Clique em Reconectar antes disso,
                    senão as mensagens param de chegar sem aviso.
                  </>
                }
              />
            )}

            {loja.conectada && <AgenteInstagram empresa={loja.empresa} />}
            {loja.conectada && <DiagnosticoInstagram empresa={loja.empresa} />}

            {abrindo === loja.empresa && (
              <div className="mt-4 space-y-2 rounded-lg border border-aura-mist bg-aura-sunken p-4">
                <input
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="@ da conta (ex.: lflareiras)"
                  className="aura-input"
                />
                <input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  type="password"
                  placeholder="Token de acesso gerado no painel da Meta"
                  className="aura-input"
                />
                <p className="text-xs text-aura-graphite-soft">
                  O token não volta a aparecer depois de salvo. Guarde uma cópia no cofre de senhas de vocês.
                </p>
                <button
                  type="button"
                  onClick={() => void conectar(loja.empresa)}
                  disabled={salvando}
                  className={classeBotao("primario")}
                >
                  {salvando && <Loader2 size={14} className="animate-spin" />}
                  Salvar conexão
                </button>
              </div>
            )}

            <div className="mt-5 border-t border-aura-mist pt-4">
              <p className="aura-rotulo">Quem atende esta conta</p>
              <p className="mb-2 mt-1 text-xs text-aura-graphite-soft">
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
                      <span className="min-w-0 text-sm text-aura-graphite">
                        {p.nome}
                        <span className="ml-2 text-xs text-aura-graphite-soft">{p.cargo}</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={p.atende}
                        aria-label={`Atendimento pelo Instagram para ${p.nome}`}
                        onClick={() => void alternarPessoa(p)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aura-petrol-500 ${
                          p.atende ? "bg-aura-petrol-600" : "bg-aura-graphite-soft/30"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-aura-surface shadow-sm transition-all ${
                            p.atende ? "left-[22px]" : "left-0.5"
                          }`}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
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
            ? `Avisos ligados. ${(d.dados?.etapas ?? []).join(" | ")}`
            : `A Meta recusou: ${(d.erros ?? [d.erro]).join(" | ")}`
          : `Histórico: ${d.conversas ?? 0} conversas, ${d.mensagens ?? 0} mensagens, ${d.comentarios ?? 0} comentários.` +
              (d.avisos?.length ? ` Avisos: ${d.avisos.join(" | ")}` : ""),
      );
      void ver();
    } finally {
      setOcupado(null);
    }
  }

  const linha = (rotulo: string, item: any, opcional = false) => (
    <li className="flex flex-wrap gap-x-2 gap-y-0.5">
      <span className={`w-12 shrink-0 font-medium ${item?.ok ? "text-aura-success" : opcional ? "text-aura-graphite-soft" : "text-aura-danger"}`}>
        {item?.ok ? "OK" : opcional ? "—" : "Falhou"}
      </span>
      <span className="text-aura-graphite">{rotulo}</span>
      {!item?.ok && item?.erros && !opcional && <span className="text-aura-graphite-soft">— {item.erros.join(" | ")}</span>}
      {!item?.ok && opcional && <span className="text-aura-graphite-soft">— não precisa: a conta recebe direto</span>}
    </li>
  );

  // O que fazer, em português, a partir do que a Meta respondeu.
  const dicas: string[] = [];
  if (dados && !dados.erro) {
    if (!dados.perfil?.ok) dicas.push("O token da conta não vale mais: clique em Reconectar.");
    if (!dados.avisosAssinados?.ok && !dados.avisosDaPagina?.ok)
      dicas.push("Os avisos não estão ligados: clique em Religar avisos.");
    if (dados.conversas?.ok && dados.conversas.quantas === 0)
      dicas.push(
        "A Meta não mostra nenhuma conversa do direct. No celular, no Instagram da loja: Configurações e atividade → Mensagens e respostas aos stories → Ferramentas conectadas → ligue “Permitir acesso às mensagens”. Depois mande uma mensagem de teste de outro perfil e clique em Puxar histórico.",
      );
    if (!dados.webhook?.segredoConfigurado) dicas.push("Falta a chave secreta do app (META_APP_SECRET) no servidor.");
  }
  const contaRecebeDireto = Boolean(dados?.avisosAssinados?.ok);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => {
          setAberto((v) => !v);
          if (!aberto && !dados) void ver();
        }}
        className="text-xs font-medium text-aura-petrol-600 underline-offset-2 hover:underline"
      >
        {aberto ? "Fechar diagnóstico" : "Diagnóstico da conexão"}
      </button>
      {aberto && (
        <div className="mt-2 space-y-3 rounded-lg border border-aura-mist bg-aura-sunken p-3 text-xs">
          {ocupado === "ver" && !dados && (
            <p className="flex items-center gap-2 text-aura-graphite-soft">
              <Loader2 size={12} className="animate-spin" />
              Consultando a Meta…
            </p>
          )}
          {dados?.erro && <p className="text-aura-danger">{dados.erro}</p>}
          {dados && !dados.erro && (
            <>
              <ul className="space-y-1">
                {linha("Token e perfil da conta", dados.perfil)}
                {linha(
                  `Página do Facebook ligada${dados.pagina?.ok ? ` (${dados.pagina.nome ?? dados.pagina.id})` : ""}`,
                  dados.pagina,
                  contaRecebeDireto,
                )}
                {linha("Avisos (webhook) assinados pela Página", dados.avisosDaPagina, contaRecebeDireto)}
                {linha("Avisos (webhook) assinados pela conta", dados.avisosAssinados)}
                {linha(`Conversas do direct${dados.conversas?.ok ? ` (${dados.conversas.quantas} visíveis)` : ""}`, dados.conversas)}
                {linha("Publicações e comentários", dados.publicacoes)}
                <li className="flex flex-wrap gap-x-2 gap-y-0.5">
                  <span className={`w-12 shrink-0 font-medium ${dados.webhook?.segredoConfigurado ? "text-aura-success" : "text-aura-danger"}`}>
                    {dados.webhook?.segredoConfigurado ? "OK" : "Falta"}
                  </span>
                  <span className="text-aura-graphite">Chave secreta do app no servidor</span>
                </li>
              </ul>
              {dicas.length > 0 && (
                <div className="rounded-lg border border-aura-warning/40 bg-aura-surface p-3">
                  <p className="flex items-center gap-1.5 font-medium text-aura-graphite">
                    <AlertTriangle size={12} className="text-aura-warning" />
                    O que fazer
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-aura-graphite">
                    {dicas.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="mb-1 font-medium text-aura-graphite">
                  Últimos avisos recebidos da Meta ({dados.webhook?.ultimosAvisos?.length ?? 0})
                </p>
                {(dados.webhook?.ultimosAvisos ?? []).slice(0, 8).map((a: any, i: number) => (
                  <p key={i} className="break-words text-aura-graphite-soft">
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
            <button type="button" onClick={() => void ver()} disabled={!!ocupado} className={classeBotao("secundario", "sm")}>
              Atualizar
            </button>
            <button type="button" onClick={() => void acao("assinar")} disabled={!!ocupado} className={classeBotao("secundario", "sm")}>
              {ocupado === "assinar" ? "Ligando…" : "Religar avisos"}
            </button>
            <button type="button" onClick={() => void acao("importar")} disabled={!!ocupado} className={classeBotao("secundario", "sm")}>
              {ocupado === "importar" ? "Puxando…" : "Puxar histórico"}
            </button>
          </div>
          {resultado && <p className="break-words text-aura-graphite">{resultado}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * O agente de IA desta conta: responde o direct quando a equipe não responde
 * no tempo combinado, como o assistente do chat do site.
 */
const HORARIO_COMERCIAL: Horario = {
  "1": [["08:00", "12:00"], ["13:30", "18:00"]],
  "2": [["08:00", "12:00"], ["13:30", "18:00"]],
  "3": [["08:00", "12:00"], ["13:30", "18:00"]],
  "4": [["08:00", "12:00"], ["13:30", "18:00"]],
  "5": [["08:00", "12:00"], ["13:30", "18:00"]],
  "6": [["09:00", "12:00"]],
  "0": [],
};

function AgenteInstagram({ empresa }: { empresa: string }) {
  const [aberto, setAberto] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [ativa, setAtiva] = useState(false);
  const [horas, setHoras] = useState("2");
  const [foraDoHorario, setForaDoHorario] = useState(true);
  const [horario, setHorario] = useState<Horario>({});
  const [comentarios, setComentarios] = useState(false);
  const [instrucoes, setInstrucoes] = useState("");
  const [naSemana, setNaSemana] = useState(0);
  const [material, setMaterial] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);
  const fabrica = empresa === "MF International";

  async function carregar() {
    const r = await fetch(`/api/gestor/instagram-agente?empresa=${encodeURIComponent(empresa)}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setRecado(d.erro ?? "Não consegui carregar.");
      return;
    }
    const c = d.config ?? {};
    setAtiva(Boolean(c.ativa));
    setHoras(String(c.esperar_horas ?? 2));
    setForaDoHorario(c.fora_do_horario !== false);
    // Nunca configurado: começa com o horário comercial de sempre, para ajustar.
    const temHorario = Object.values(c.horario ?? {}).some((t: any) => Array.isArray(t) && t.length > 0);
    setHorario(temHorario ? c.horario : HORARIO_COMERCIAL);
    setComentarios(Boolean(c.responder_comentarios));
    setInstrucoes(c.instrucoes ?? "");
    setNaSemana(Number(d.respostasNaSemana ?? 0));
    setMaterial(typeof d.trechosDeMaterial === "number" ? d.trechosDeMaterial : null);
    setCarregado(true);
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa]);

  function mudarTurno(dia: string, k: number, lado: 0 | 1, valor: string) {
    setHorario((h) => {
      const turnos: Turno[] = [...(h[dia] ?? [])].map((t) => [t[0], t[1]] as Turno);
      while (turnos.length <= k) turnos.push(["", ""]);
      turnos[k][lado] = valor;
      return { ...h, [dia]: turnos };
    });
  }

  async function salvar() {
    setSalvando(true);
    setRecado(null);
    const limpo: Horario = {};
    for (const { dia } of DIAS) limpo[dia] = (horario[dia] ?? []).filter((t) => t[0] && t[1]);
    try {
      const r = await fetch("/api/gestor/instagram-agente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa,
          ativa,
          esperar_horas: Number(horas.replace(",", ".")),
          fora_do_horario: foraDoHorario,
          horario: limpo,
          responder_comentarios: comentarios,
          instrucoes,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.erro ?? "Não consegui salvar.");
      setRecado(ativa ? "Salvo. O agente está ligado nesta conta." : "Salvo. O agente está desligado nesta conta.");
    } catch (e: any) {
      setRecado(e?.message ?? "Não consegui salvar.");
    } finally {
      setSalvando(false);
    }
  }

  const campo = "aura-input h-8 w-auto px-2 text-sm";
  const caixa = "h-4 w-4 accent-aura-petrol-600";

  return (
    <div className="mt-4 rounded-lg border border-aura-mist">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left transition hover:bg-aura-sunken"
      >
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-aura-graphite">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-aura-petrol-500/12">
            <Bot size={15} className="text-aura-petrol-600" />
          </span>
          Agente de IA
          {carregado && <Selo tom={ativa ? "sucesso" : "neutro"}>{ativa ? `ligado · entra após ${horas}h` : "desligado"}</Selo>}
        </span>
        <span className="shrink-0 text-xs font-medium text-aura-petrol-600">{aberto ? "Fechar" : "Configurar"}</span>
      </button>

      {aberto && (
        <div className="space-y-4 border-t border-aura-mist p-3 text-sm sm:p-4">
          <p className="text-xs leading-relaxed text-aura-graphite-soft">
            Responde no direct quando a equipe não responde no tempo abaixo, com o material da{" "}
            {fabrica ? "fábrica" : "loja"} que está na AURA. Fala como {fabrica ? "a fábrica (arquitetos, construtoras, revendas e cliente final)" : "a loja (cliente final, showroom e instalação)"}, se
            apresenta como assistente virtual, não fala preço e deixa tudo anotado para o vendedor. O vendedor pode pausar o agente em
            qualquer conversa. {naSemana > 0 && `Respondeu ${naSemana} vez${naSemana === 1 ? "" : "es"} nos últimos 7 dias.`}
          </p>

          <label className="flex items-center gap-2.5 text-aura-graphite">
            <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} className={caixa} />
            Ligar o agente nesta conta
          </label>

          {material !== null && (
            <p className={`rounded-lg px-3 py-2 text-xs ${material > 0 ? "border border-aura-success/25 bg-aura-success/8 text-aura-graphite" : "border border-aura-warning/30 bg-aura-warning/10 text-aura-graphite"}`}>
              {material > 0
                ? `Material que o agente usa: só o da ${empresa} (${material} trechos ligados em Materiais). Nada de outra loja.`
                : `A ${empresa} ainda não tem material ligado em Materiais. Sem material o agente só cumprimenta, pergunta o que o cliente precisa e avisa que o vendedor confirma.`}
            </p>
          )}

          <div className="space-y-2 rounded-lg border border-aura-mist bg-aura-sunken p-3">
            <p className="text-sm font-medium text-aura-graphite">Horário em que a equipe atende</p>
            <p className="text-xs text-aura-graphite-soft">
              Dentro deste horário o agente espera a equipe; fora dele, entra como você escolher abaixo.
            </p>
            {DIAS.map(({ dia, nome }) => {
              const turnos = horario[dia] ?? [];
              const abertoDia = turnos.length > 0;
              return (
                <div key={dia} className="flex flex-wrap items-center gap-2 text-xs">
                  <label className="flex w-24 items-center gap-1.5 text-sm text-aura-graphite">
                    <input
                      type="checkbox"
                      className={caixa}
                      checked={abertoDia}
                      onChange={(e) =>
                        setHorario((h) => ({ ...h, [dia]: e.target.checked ? [["08:00", "12:00"], ["13:30", "18:00"]] : [] }))
                      }
                    />
                    {nome}
                  </label>
                  {abertoDia ? (
                    [0, 1].map((k) => (
                      <span key={k} className="flex items-center gap-1">
                        {k === 1 && <span className="px-1 text-aura-graphite-soft">e</span>}
                        <input type="time" value={turnos[k]?.[0] ?? ""} onChange={(e) => mudarTurno(dia, k, 0, e.target.value)} className={campo} aria-label={`${nome} turno ${k + 1} começa`} />
                        às
                        <input type="time" value={turnos[k]?.[1] ?? ""} onChange={(e) => mudarTurno(dia, k, 1, e.target.value)} className={campo} aria-label={`${nome} turno ${k + 1} termina`} />
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-aura-graphite-soft">Ninguém atende</span>
                  )}
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setHorario((h) => ({ ...h, "2": h["1"] ?? [], "3": h["1"] ?? [], "4": h["1"] ?? [], "5": h["1"] ?? [] }))}
                className={classeBotao("secundario", "sm")}
              >
                Copiar segunda para terça a sexta
              </button>
              <button type="button" onClick={() => setHorario(HORARIO_COMERCIAL)} className={classeBotao("secundario", "sm")}>
                Voltar ao horário comercial
              </button>
            </div>
            <p className="text-[11px] text-aura-graphite-soft">
              {horarioEmTexto(horario) || "Nenhum dia marcado: conta como se a equipe atendesse sempre."} Deixe o segundo horário em branco se o dia
              tiver um turno só (ex.: sábado 09:00 às 12:00).
            </p>
          </div>

          <label className={`flex flex-wrap items-center gap-2 ${ativa ? "text-aura-graphite" : "text-aura-graphite-soft"}`}>
            Dentro do horário, responder se ninguém da equipe responder em
            <select value={horas} onChange={(e) => setHoras(e.target.value)} className={campo} disabled={!ativa}>
              {["0.25", "0.5", "1", "2", "3", "4", "6", "8", "12"].map((h) => (
                <option key={h} value={h}>
                  {Number(h) < 1 ? `${Number(h) * 60} min` : `${h} h`}
                </option>
              ))}
            </select>
          </label>

          <fieldset className={`space-y-1.5 ${ativa ? "text-aura-graphite" : "text-aura-graphite-soft"}`} disabled={!ativa}>
            <legend className="mb-1">Fora do horário (noite, fim de semana, depois do sábado ao meio-dia):</legend>
            <label className="flex items-center gap-2.5">
              <input type="radio" name={`fora-${empresa}`} checked={foraDoHorario} onChange={() => setForaDoHorario(true)} className={caixa} />
              Responder na hora, sem esperar
            </label>
            <label className="flex items-center gap-2.5">
              <input type="radio" name={`fora-${empresa}`} checked={!foraDoHorario} onChange={() => setForaDoHorario(false)} className={caixa} />
              Esperar o mesmo tempo de dentro do horário
            </label>
          </fieldset>

          <label className={`flex items-center gap-2.5 ${ativa ? "text-aura-graphite" : "text-aura-graphite-soft"}`}>
            <input type="checkbox" checked={comentarios} disabled={!ativa} onChange={(e) => setComentarios(e.target.checked)} className={caixa} />
            Também responder comentários sem resposta (em público, curto, chamando para o direct)
          </label>

          <label className="flex flex-col gap-1 text-aura-graphite">
            Instruções para o agente desta conta (opcional)
            <textarea
              rows={3}
              maxLength={2000}
              value={instrucoes}
              onChange={(e) => setInstrucoes(e.target.value)}
              placeholder={fabrica ? "Ex.: para cliente final de Porto Alegre, dizer que a LF Lareiras atende." : "Ex.: lembrar que o showroom abre sábado de manhã."}
              className="aura-input resize-y"
            />
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={salvando || !carregado}
              className={classeBotao("primario")}
            >
              {salvando && <Loader2 size={14} className="animate-spin" />}
              Salvar
            </button>
            {recado && <span className="text-xs text-aura-graphite-soft">{recado}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
