"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Link as LinkIcon,
  Check,
  X,
  MessageCircleWarning,
  Calendar,
  ChevronLeft,
  ChevronRight,
  List,
  CalendarDays,
  Trash2,
} from "lucide-react";
import {
  listarPostagens,
  criarPostagem,
  atualizarPostagem,
  apagarPostagem,
  type PostagemMarketing,
  type StatusPostagem,
} from "@/lib/supabase/postagens-marketing";
import { useUserProfile } from "@/lib/user-profile-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Botao, Card, CardHeader, EstadoVazio, Segmentado, Selo, StatCard, classeBotao } from "@/components/ui";
import { diaEmSaoPaulo } from "@/lib/fuso";
import { STATUS_POSTAGEM, dataCurta } from "@/components/marketing/rotulos";

const DIAS_SEMANA = [
  { curto: "D", longo: "Dom" },
  { curto: "S", longo: "Seg" },
  { curto: "T", longo: "Ter" },
  { curto: "Q", longo: "Qua" },
  { curto: "Q", longo: "Qui" },
  { curto: "S", longo: "Sex" },
  { curto: "S", longo: "Sáb" },
];
const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

type Visualizacao = "calendario" | "lista";
type FiltroStatus = "todas" | StatusPostagem;

function isoDoDia(ano: number, mes: number, dia: number) {
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Calendário do mês com células grandes: no computador cada dia mostra o
 * título das postagens (até duas e um "+N"); no celular, só bolinhas com a cor
 * da situação. O dia de hoje tem o número destacado e o dia escolhido ganha
 * contorno, para não confundir os dois.
 */
function CalendarioMensal({
  postagens,
  mesRef,
  setMesRef,
  diaSelecionado,
  setDiaSelecionado,
}: {
  postagens: PostagemMarketing[];
  mesRef: Date;
  setMesRef: (d: Date) => void;
  diaSelecionado: string | null;
  setDiaSelecionado: (d: string | null) => void;
}) {
  const ano = mesRef.getFullYear();
  const mes = mesRef.getMonth();
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const hojeISO = diaEmSaoPaulo(); // dia de Brasília (em UTC virava amanhã depois das 21h)

  const postagensPorDia = useMemo(() => {
    const mapa = new Map<string, PostagemMarketing[]>();
    for (const p of postagens) {
      const lista = mapa.get(p.dataPlanejada) ?? [];
      lista.push(p);
      mapa.set(p.dataPlanejada, lista);
    }
    return mapa;
  }, [postagens]);

  const totalCelulas = Math.ceil((primeiroDia + totalDias) / 7) * 7;
  const celulas: (number | null)[] = Array.from({ length: totalCelulas }, (_, i) => {
    const dia = i - primeiroDia + 1;
    return dia >= 1 && dia <= totalDias ? dia : null;
  });

  function irParaHoje() {
    const [a, m] = hojeISO.split("-").map(Number);
    setMesRef(new Date(a, m - 1, 1));
    setDiaSelecionado(null);
  }

  return (
    <Card semPadding className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-aura-mist px-4 py-3">
        {/* Sem `capitalize`: ele virava "Novembro De 2026". Só o mês sobe a inicial. */}
        <p className="text-sm font-semibold text-aura-graphite">
          {MESES[mes].charAt(0).toUpperCase() + MESES[mes].slice(1)} de {ano}
        </p>
        <div className="flex items-center gap-1">
          <Botao tamanho="sm" variante="fantasma" onClick={irParaHoje}>
            Hoje
          </Botao>
          <button
            type="button"
            onClick={() => {
              setMesRef(new Date(ano, mes - 1, 1));
              setDiaSelecionado(null);
            }}
            className="rounded-lg p-1.5 text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-graphite"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              setMesRef(new Date(ano, mes + 1, 1));
              setDiaSelecionado(null);
            }}
            className="rounded-lg p-1.5 text-aura-graphite-soft transition hover:bg-aura-sunken hover:text-aura-graphite"
            aria-label="Próximo mês"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-aura-mist bg-aura-sunken/60">
        {DIAS_SEMANA.map((d, i) => (
          <p key={i} className="py-2 text-center text-[0.68rem] font-medium uppercase tracking-wide text-aura-graphite-soft">
            <span className="sm:hidden">{d.curto}</span>
            <span className="hidden sm:inline">{d.longo}</span>
          </p>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {celulas.map((dia, i) => {
          const bordas = `${i % 7 !== 6 ? "border-r" : ""} ${i < totalCelulas - 7 ? "border-b" : ""} border-aura-mist`;
          if (dia === null) {
            return <div key={`vazio-${i}`} className={`min-h-12 bg-aura-sunken/40 sm:min-h-24 ${bordas}`} />;
          }
          const iso = isoDoDia(ano, mes, dia);
          const doDia = postagensPorDia.get(iso) ?? [];
          const ehHoje = iso === hojeISO;
          const selecionado = iso === diaSelecionado;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setDiaSelecionado(selecionado ? null : iso)}
              aria-pressed={selecionado}
              aria-label={`${dia} de ${MESES[mes]}${doDia.length ? `, ${doDia.length} ${doDia.length === 1 ? "postagem" : "postagens"}` : ""}`}
              className={`relative flex min-h-12 flex-col items-center gap-1 p-1 text-left transition sm:min-h-24 sm:items-stretch sm:p-1.5 ${bordas} ${
                selecionado ? "bg-aura-petrol-500/10" : "hover:bg-aura-sunken/70"
              }`}
            >
              {selecionado && (
                <span className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-aura-petrol-500" aria-hidden />
              )}
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums ${
                  ehHoje
                    ? "bg-aura-petrol-600 font-semibold text-white"
                    : selecionado
                      ? "font-semibold text-aura-petrol-600"
                      : "text-aura-graphite"
                }`}
              >
                {dia}
              </span>

              {doDia.length > 0 && (
                <>
                  {/* Celular: bolinhas com a cor da situação */}
                  <span className="flex gap-0.5 sm:hidden">
                    {doDia.slice(0, 3).map((p) => (
                      <span key={p.id} className={`h-1.5 w-1.5 rounded-full ${STATUS_POSTAGEM[p.status].ponto}`} />
                    ))}
                  </span>
                  {/* Computador: o título de cada postagem */}
                  <span className="hidden flex-col gap-0.5 sm:flex">
                    {doDia.slice(0, 2).map((p) => (
                      <span
                        key={p.id}
                        title={`${p.titulo} · ${STATUS_POSTAGEM[p.status].texto}`}
                        className="flex items-center gap-1 rounded bg-aura-sunken px-1 py-0.5 text-[0.68rem] leading-tight text-aura-graphite"
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_POSTAGEM[p.status].ponto}`} />
                        <span className="truncate">{p.titulo}</span>
                      </span>
                    ))}
                    {doDia.length > 2 && (
                      <span className="px-1 text-[0.68rem] text-aura-graphite-soft">+{doDia.length - 2} mais</span>
                    )}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Legenda das cores */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-aura-mist px-4 py-2.5">
        {(Object.keys(STATUS_POSTAGEM) as StatusPostagem[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-xs text-aura-graphite-soft">
            <span className={`h-2 w-2 rounded-full ${STATUS_POSTAGEM[s].ponto}`} />
            {STATUS_POSTAGEM[s].texto}
          </span>
        ))}
      </div>
    </Card>
  );
}

export function CalendarioPostagens() {
  const { profile } = useUserProfile();
  const podeAprovar = profile.cargo === "Gestor";
  const podeCriar = profile.cargo === "Marketing" || podeAprovar;

  const [postagens, setPostagens] = useState<PostagemMarketing[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [formAberto, setFormAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [dataPlanejada, setDataPlanejada] = useState("");
  const [linkDrive, setLinkDrive] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [visualizacao, setVisualizacao] = useState<Visualizacao>("calendario");
  const [mesRef, setMesRef] = useState(() => new Date());
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todas");

  async function carregar() {
    const lista = await listarPostagens();
    setPostagens(lista);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const canal = supabase
      .channel("aura-postagens-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "postagens_marketing" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  async function salvarNova(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim() || !dataPlanejada || salvando) return;
    setSalvando(true);
    const ok = await criarPostagem({
      empresa: profile.empresa,
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      dataPlanejada,
      linkDrive: linkDrive.trim() || undefined,
      status: linkDrive.trim() ? "aguardando_aprovacao" : "planejado",
    });
    setSalvando(false);
    // Antes o formulário era limpo e fechado mesmo quando o banco recusava:
    // a postagem sumia sem aviso e a pessoa achava que tinha salvo.
    if (!ok) {
      window.alert("Não consegui salvar a postagem. Confira a conexão e tente de novo.");
      return;
    }
    setTitulo("");
    setDataPlanejada("");
    setLinkDrive("");
    setDescricao("");
    setFormAberto(false);
    // Não depende só do tempo real: a lista volta certa mesmo se ele cair.
    void carregar();
  }

  /** Muda a postagem e avisa se o banco recusar (antes falhava calado). */
  async function atualizar(p: PostagemMarketing, patch: Partial<PostagemMarketing>) {
    const ok = await atualizarPostagem(p.id, patch);
    if (!ok) {
      window.alert("Não consegui atualizar a postagem. Tente de novo.");
      return;
    }
    void carregar();
  }

  async function marcarPublicado(p: PostagemMarketing) {
    await atualizar(p, { status: "publicado", dataPublicacao: diaEmSaoPaulo() });
  }

  async function aprovar(p: PostagemMarketing) {
    await atualizar(p, { status: "aprovado", feedbackGestor: null });
  }

  async function pedirAjuste(p: PostagemMarketing) {
    const feedback = prompt("O que precisa ajustar nessa postagem?");
    if (!feedback) return;
    await atualizar(p, { status: "planejado", feedbackGestor: feedback });
  }

  async function rejeitar(p: PostagemMarketing) {
    if (!confirm(`Rejeitar a postagem "${p.titulo}"?`)) return;
    await atualizar(p, { status: "rejeitado" });
  }

  async function excluir(id: string) {
    if (!confirm("Excluir essa postagem?")) return;
    if (!(await apagarPostagem(id))) window.alert("Não consegui excluir a postagem. Tente de novo.");
    void carregar();
  }

  const hojeISO = diaEmSaoPaulo();
  const daquiA7 = diaEmSaoPaulo(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const publicadas = postagens.filter((p) => p.status === "publicado").length;
  const aguardando = postagens.filter((p) => p.status === "aguardando_aprovacao").length;
  const proximos7 = postagens.filter(
    (p) =>
      p.dataPlanejada >= hojeISO &&
      p.dataPlanejada <= daquiA7 &&
      p.status !== "publicado" &&
      p.status !== "rejeitado",
  ).length;

  const prefixoMes = `${mesRef.getFullYear()}-${String(mesRef.getMonth() + 1).padStart(2, "0")}`;
  const nomeMes = `${MESES[mesRef.getMonth()]} de ${mesRef.getFullYear()}`;

  /*
   * No calendário a lista acompanha o que está na tela: o dia escolhido ou,
   * sem dia escolhido, o mês aberto. Na lista, vêm todas.
   */
  const postagensExibidas = postagens
    .filter((p) => {
      if (visualizacao === "calendario") {
        return diaSelecionado ? p.dataPlanejada === diaSelecionado : p.dataPlanejada.startsWith(prefixoMes);
      }
      return true;
    })
    .filter((p) => filtroStatus === "todas" || p.status === filtroStatus);

  const tituloLista =
    visualizacao === "lista"
      ? "Todas as postagens"
      : diaSelecionado
        ? `Postagens em ${dataCurta(diaSelecionado)}`
        : `Postagens de ${nomeMes}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard rotulo="Próximos 7 dias" valor={proximos7} tom="marca" detalhe="ainda por publicar" />
        <StatCard
          rotulo="Aguardando aprovação"
          valor={aguardando}
          tom={aguardando > 0 ? "atencao" : "neutro"}
          detalhe={podeAprovar && aguardando > 0 ? "Esperando você" : undefined}
        />
        <StatCard rotulo="Publicadas" valor={publicadas} tom="sucesso" />
        <StatCard rotulo="Total no calendário" valor={postagens.length} />
      </div>

      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmentado
          rotulo="Modo de ver as postagens"
          valor={visualizacao}
          aoMudar={(v) => {
            setVisualizacao(v);
            setDiaSelecionado(null);
          }}
          opcoes={[
            {
              valor: "calendario",
              rotulo: (
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={14} aria-hidden />
                  Calendário
                </span>
              ),
            },
            {
              valor: "lista",
              rotulo: (
                <span className="flex items-center gap-1.5">
                  <List size={14} aria-hidden />
                  Lista
                </span>
              ),
            },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <label>
            <span className="sr-only">Filtrar por situação</span>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
              className="aura-input h-8 w-auto text-xs"
            >
              <option value="todas">Todas as situações</option>
              {(Object.keys(STATUS_POSTAGEM) as StatusPostagem[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_POSTAGEM[s].texto}
                </option>
              ))}
            </select>
          </label>
          {podeCriar && (
            <Botao
              variante={formAberto ? "secundario" : "primario"}
              tamanho="sm"
              icone={formAberto ? X : Plus}
              onClick={() => setFormAberto((v) => !v)}
            >
              {formAberto ? "Cancelar" : "Nova postagem"}
            </Botao>
          )}
        </div>
      </div>

      {formAberto && (
        <Card>
          <CardHeader
            titulo="Nova postagem"
            descricao={
              linkDrive.trim()
                ? "Com o link do Drive, ela já entra como “Aguardando aprovação”."
                : "Sem link do Drive ainda, ela fica só “Planejada” no calendário."
            }
            icone={Plus}
          />
          <form onSubmit={salvarNova} className="flex flex-col gap-3">
            <label className="block">
              <span className="aura-label">Título</span>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Reels da lareira Prime"
                className="aura-input"
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="aura-label">Data planejada</span>
                <input
                  type="date"
                  value={dataPlanejada}
                  onChange={(e) => setDataPlanejada(e.target.value)}
                  className="aura-input"
                />
              </label>
              <label className="block">
                <span className="aura-label">Link do Google Drive (opcional)</span>
                <input
                  type="text"
                  value={linkDrive}
                  onChange={(e) => setLinkDrive(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="aura-input"
                />
              </label>
            </div>
            <label className="block">
              <span className="aura-label">Descrição ou legenda (opcional)</span>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
                className="aura-input resize-none"
              />
            </label>
            <Botao type="submit" variante="primario" disabled={salvando} className="self-start">
              {salvando ? "Salvando..." : "Adicionar ao calendário"}
            </Botao>
          </form>
        </Card>
      )}

      {visualizacao === "calendario" && (
        <CalendarioMensal
          postagens={postagens}
          mesRef={mesRef}
          setMesRef={setMesRef}
          diaSelecionado={diaSelecionado}
          setDiaSelecionado={setDiaSelecionado}
        />
      )}

      <Card>
        <CardHeader
          titulo={tituloLista}
          icone={Calendar}
          acoes={
            visualizacao === "calendario" && diaSelecionado ? (
              <Botao tamanho="sm" variante="fantasma" onClick={() => setDiaSelecionado(null)}>
                Ver o mês todo
              </Botao>
            ) : (
              <span className="text-xs tabular-nums text-aura-graphite-soft">
                {postagensExibidas.length} {postagensExibidas.length === 1 ? "postagem" : "postagens"}
              </span>
            )
          }
        />

        {carregando ? (
          <p className="py-6 text-center text-sm text-aura-graphite-soft">Carregando...</p>
        ) : postagensExibidas.length === 0 ? (
          <EstadoVazio
            icone={Calendar}
            titulo={
              postagens.length === 0
                ? "Nenhuma postagem cadastrada ainda"
                : diaSelecionado
                  ? "Nenhuma postagem nesse dia"
                  : "Nenhuma postagem por aqui"
            }
            descricao={podeCriar && postagens.length === 0 ? "Use “Nova postagem” para planejar a primeira." : undefined}
          />
        ) : (
          <ul className="flex flex-col divide-y divide-aura-mist">
            {postagensExibidas.map((p) => {
              const status = STATUS_POSTAGEM[p.status];
              const atrasada =
                p.dataPlanejada < hojeISO && (p.status === "planejado" || p.status === "aprovado");
              return (
                <li key={p.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-aura-mist py-1">
                        <span className="text-sm font-semibold leading-none tabular-nums text-aura-graphite">
                          {p.dataPlanejada.slice(8, 10)}
                        </span>
                        <span className="mt-0.5 text-[0.62rem] uppercase text-aura-graphite-soft">
                          {MESES[Number(p.dataPlanejada.slice(5, 7)) - 1]?.slice(0, 3)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-aura-graphite">{p.titulo}</p>
                        <p className="text-xs text-aura-graphite-soft">
                          Planejada para {dataCurta(p.dataPlanejada)}
                          {p.dataPublicacao ? ` · publicada em ${dataCurta(p.dataPublicacao)}` : ""}
                          {atrasada && <span className="text-aura-gold-700"> · data já passou</span>}
                        </p>
                        {p.descricao && <p className="mt-1 text-xs text-aura-graphite-soft">{p.descricao}</p>}
                      </div>
                    </div>
                    <Selo tom={status.tom} className="shrink-0">
                      {status.texto}
                    </Selo>
                  </div>

                  {p.feedbackGestor && (
                    <p className="ml-14 rounded-md border-l-2 border-aura-warning bg-aura-sunken px-2.5 py-1.5 text-xs text-aura-graphite">
                      <span className="font-medium">Ajuste pedido pelo gestor:</span> {p.feedbackGestor}
                    </p>
                  )}

                  <div className="ml-14 flex flex-wrap items-center gap-2">
                    {p.linkDrive && (
                      <a
                        href={p.linkDrive}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={classeBotao("fantasma", "sm", "text-aura-petrol-600")}
                      >
                        <LinkIcon size={12} />
                        Ver no Drive
                      </a>
                    )}
                    {podeAprovar && p.status === "aguardando_aprovacao" && (
                      <>
                        <Botao tamanho="sm" icone={Check} className="text-aura-success" onClick={() => aprovar(p)}>
                          Aprovar
                        </Botao>
                        <Botao
                          tamanho="sm"
                          icone={MessageCircleWarning}
                          className="text-aura-gold-700"
                          onClick={() => pedirAjuste(p)}
                        >
                          Pedir ajuste
                        </Botao>
                        <Botao tamanho="sm" variante="perigo-suave" icone={X} onClick={() => rejeitar(p)}>
                          Rejeitar
                        </Botao>
                      </>
                    )}
                    {podeCriar && p.status !== "publicado" && p.status !== "rejeitado" && (
                      <Botao tamanho="sm" onClick={() => marcarPublicado(p)}>
                        Marcar como publicada
                      </Botao>
                    )}
                    {podeCriar && (
                      <button
                        type="button"
                        onClick={() => excluir(p.id)}
                        aria-label={`Excluir a postagem ${p.titulo}`}
                        title="Excluir postagem"
                        className="ml-auto rounded-md p-1.5 text-aura-graphite-soft transition hover:bg-aura-danger/10 hover:text-aura-danger"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
