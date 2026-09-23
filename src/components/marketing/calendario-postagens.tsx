"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Link as LinkIcon,
  Check,
  X,
  MessageCircleWarning,
  Calendar,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  List,
  Grid3x3,
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

const LABEL_STATUS: Record<StatusPostagem, { texto: string; cor: string; dot: string }> = {
  planejado: { texto: "Planejado", cor: "bg-aura-graphite-soft/15 text-aura-graphite-soft", dot: "bg-aura-graphite-soft" },
  aguardando_aprovacao: { texto: "Aguardando aprovação", cor: "bg-aura-warning/10 text-aura-warning", dot: "bg-aura-warning" },
  aprovado: { texto: "Aprovado", cor: "bg-aura-petrol-700/10 text-aura-petrol-700", dot: "bg-aura-petrol-600" },
  publicado: { texto: "Publicado", cor: "bg-aura-success/10 text-aura-success", dot: "bg-aura-success" },
  rejeitado: { texto: "Rejeitado", cor: "bg-aura-danger/10 text-aura-danger", dot: "bg-aura-danger" },
};

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatarData(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(ano, mes - 1, dia)
  );
}

function MiniCalendario({
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
  const hojeISO = new Date().toISOString().slice(0, 10);

  const postagensPorDia = useMemo(() => {
    const mapa = new Map<string, PostagemMarketing[]>();
    for (const p of postagens) {
      const lista = mapa.get(p.dataPlanejada) ?? [];
      lista.push(p);
      mapa.set(p.dataPlanejada, lista);
    }
    return mapa;
  }, [postagens]);

  const celulas: (number | null)[] = [
    ...Array(primeiroDia).fill(null),
    ...Array.from({ length: totalDias }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMesRef(new Date(ano, mes - 1, 1))}
          className="rounded-lg p-1.5 text-aura-graphite-soft hover:bg-aura-bg"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-medium text-aura-graphite">
          {MESES[mes]} {ano}
        </p>
        <button
          type="button"
          onClick={() => setMesRef(new Date(ano, mes + 1, 1))}
          className="rounded-lg p-1.5 text-aura-graphite-soft hover:bg-aura-bg"
          aria-label="Próximo mês"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {DIAS_SEMANA.map((d, i) => (
          <p key={i} className="text-[0.65rem] font-medium text-aura-graphite-soft">
            {d}
          </p>
        ))}
        {celulas.map((dia, i) => {
          if (dia === null) return <div key={`vazio-${i}`} />;
          const iso = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
          const doDia = postagensPorDia.get(iso) ?? [];
          const ehHoje = iso === hojeISO;
          const selecionado = iso === diaSelecionado;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setDiaSelecionado(selecionado ? null : iso)}
              title={doDia.map((p) => p.titulo).join(", ")}
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-xs transition ${
                selecionado
                  ? "bg-aura-petrol-700 text-white"
                  : ehHoje
                    ? "bg-aura-petrol-700/10 font-semibold text-aura-petrol-700"
                    : "text-aura-graphite hover:bg-aura-bg"
              }`}
            >
              {dia}
              {doDia.length > 0 && (
                <span className="flex gap-0.5">
                  {doDia.slice(0, 3).map((p) => (
                    <span
                      key={p.id}
                      className={`h-1 w-1 rounded-full ${selecionado ? "bg-white" : LABEL_STATUS[p.status].dot}`}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
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
  const [visualizacao, setVisualizacao] = useState<"lista" | "calendario">("calendario");
  const [mesRef, setMesRef] = useState(() => new Date());
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

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
    if (!titulo.trim() || !dataPlanejada) return;
    setSalvando(true);
    await criarPostagem({
      empresa: profile.empresa,
      titulo: titulo.trim(),
      descricao: descricao.trim() || undefined,
      dataPlanejada,
      linkDrive: linkDrive.trim() || undefined,
      status: linkDrive.trim() ? "aguardando_aprovacao" : "planejado",
    });
    setTitulo("");
    setDataPlanejada("");
    setLinkDrive("");
    setDescricao("");
    setSalvando(false);
    setFormAberto(false);
  }

  async function marcarPublicado(p: PostagemMarketing) {
    await atualizarPostagem(p.id, { status: "publicado", dataPublicacao: new Date().toISOString().slice(0, 10) });
  }

  async function aprovar(p: PostagemMarketing) {
    await atualizarPostagem(p.id, { status: "aprovado", feedbackGestor: null });
  }

  async function pedirAjuste(p: PostagemMarketing) {
    const feedback = prompt("O que precisa ajustar nessa postagem?");
    if (!feedback) return;
    await atualizarPostagem(p.id, { status: "planejado", feedbackGestor: feedback });
  }

  async function rejeitar(p: PostagemMarketing) {
    if (!confirm(`Rejeitar a postagem "${p.titulo}"?`)) return;
    await atualizarPostagem(p.id, { status: "rejeitado" });
  }

  async function excluir(id: string) {
    if (!confirm("Excluir essa postagem?")) return;
    await apagarPostagem(id);
  }

  const publicadas = postagens.filter((p) => p.status === "publicado").length;
  const aguardando = postagens.filter((p) => p.status === "aguardando_aprovacao").length;

  const postagensExibidas = diaSelecionado
    ? postagens.filter((p) => p.dataPlanejada === diaSelecionado)
    : postagens;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-aura-mist bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs text-aura-graphite-soft">
            <BarChart3 size={12} />
            Publicadas
          </p>
          <p className="mt-1 font-display text-xl font-bold text-aura-graphite">{publicadas}</p>
        </div>
        <div className="rounded-2xl border border-aura-mist bg-white p-4">
          <p className="text-xs text-aura-graphite-soft">Aguardando aprovação</p>
          <p className="mt-1 font-display text-xl font-bold text-aura-graphite">{aguardando}</p>
        </div>
        <div className="rounded-2xl border border-aura-mist bg-white p-4">
          <p className="text-xs text-aura-graphite-soft">Total no calendário</p>
          <p className="mt-1 font-display text-xl font-bold text-aura-graphite">{postagens.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {visualizacao === "calendario" && (
          <div className="rounded-2xl border border-aura-mist bg-white p-4">
            <MiniCalendario
              postagens={postagens}
              mesRef={mesRef}
              setMesRef={setMesRef}
              diaSelecionado={diaSelecionado}
              setDiaSelecionado={setDiaSelecionado}
            />
          </div>
        )}

        <div className="rounded-2xl border border-aura-mist bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-medium text-aura-graphite">
              <Calendar size={15} className="text-aura-petrol-600" />
              {diaSelecionado ? `Postagens em ${formatarData(diaSelecionado)}` : "Calendário de Postagens"}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex rounded-full border border-aura-mist p-0.5">
                <button
                  type="button"
                  onClick={() => setVisualizacao("calendario")}
                  aria-label="Ver em calendário"
                  className={`rounded-full p-1.5 ${visualizacao === "calendario" ? "bg-aura-petrol-700 text-white" : "text-aura-graphite-soft"}`}
                >
                  <Grid3x3 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setVisualizacao("lista")}
                  aria-label="Ver em lista"
                  className={`rounded-full p-1.5 ${visualizacao === "lista" ? "bg-aura-petrol-700 text-white" : "text-aura-graphite-soft"}`}
                >
                  <List size={13} />
                </button>
              </div>
              {podeCriar && (
                <button
                  type="button"
                  onClick={() => setFormAberto((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full bg-aura-petrol-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-aura-petrol-600"
                >
                  <Plus size={13} />
                  Nova
                </button>
              )}
            </div>
          </div>

          {formAberto && (
            <form onSubmit={salvarNova} className="mt-4 flex flex-col gap-3 rounded-xl border border-aura-mist bg-aura-bg p-4">
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Título da postagem"
                className="rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={dataPlanejada}
                  onChange={(e) => setDataPlanejada(e.target.value)}
                  className="rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500"
                />
                <input
                  type="text"
                  value={linkDrive}
                  onChange={(e) => setLinkDrive(e.target.value)}
                  placeholder="Link do Google Drive (opcional)"
                  className="rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
                />
              </div>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
                placeholder="Descrição / legenda (opcional)"
                className="resize-none rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none placeholder:text-aura-graphite-soft/60 focus:border-aura-petrol-500"
              />
              <p className="text-xs text-aura-graphite-soft">
                {linkDrive.trim()
                  ? "Como já tem link do Drive, essa postagem já entra como 'Aguardando aprovação'."
                  : "Sem link ainda, essa postagem fica só 'Planejada' no calendário."}
              </p>
              <button
                type="submit"
                disabled={salvando}
                className="self-start rounded-lg bg-aura-petrol-700 px-4 py-2 text-xs font-medium text-white hover:bg-aura-petrol-600 disabled:opacity-60"
              >
                {salvando ? "Salvando..." : "Adicionar ao calendário"}
              </button>
            </form>
          )}

          {carregando ? (
            <p className="mt-4 text-center text-sm text-aura-graphite-soft">Carregando...</p>
          ) : postagensExibidas.length === 0 ? (
            <p className="mt-4 text-center text-sm text-aura-graphite-soft">
              {diaSelecionado ? "Nenhuma postagem nesse dia." : "Nenhuma postagem cadastrada ainda."}
            </p>
          ) : (
            <ul className="mt-4 flex flex-col divide-y divide-aura-mist">
              {postagensExibidas.map((p) => (
                <li key={p.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-aura-graphite">{p.titulo}</p>
                      <p className="text-xs text-aura-graphite-soft">
                        Planejado: {formatarData(p.dataPlanejada)}
                        {p.dataPublicacao ? ` · Publicado: ${formatarData(p.dataPublicacao)}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${LABEL_STATUS[p.status].cor}`}>
                      {LABEL_STATUS[p.status].texto}
                    </span>
                  </div>
                  {p.descricao && <p className="text-xs text-aura-graphite-soft">{p.descricao}</p>}
                  {p.feedbackGestor && (
                    <p className="rounded-lg bg-aura-danger/5 px-2.5 py-1.5 text-xs text-aura-danger">
                      Feedback do gestor: {p.feedbackGestor}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {p.linkDrive && (
                      <a
                        href={p.linkDrive}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-medium text-aura-petrol-600 hover:underline"
                      >
                        <LinkIcon size={11} />
                        Ver no Drive
                      </a>
                    )}
                    {podeCriar && p.status !== "publicado" && p.status !== "rejeitado" && (
                      <button
                        type="button"
                        onClick={() => marcarPublicado(p)}
                        className="rounded-full border border-aura-mist px-2.5 py-1 text-[0.65rem] font-medium text-aura-graphite hover:bg-aura-bg"
                      >
                        Marcar como publicado
                      </button>
                    )}
                    {podeAprovar && p.status === "aguardando_aprovacao" && (
                      <>
                        <button
                          type="button"
                          onClick={() => aprovar(p)}
                          className="flex items-center gap-1 rounded-full bg-aura-success px-2.5 py-1 text-[0.65rem] font-medium text-white hover:opacity-90"
                        >
                          <Check size={10} />
                          Aprovar
                        </button>
                        <button
                          type="button"
                          onClick={() => pedirAjuste(p)}
                          className="flex items-center gap-1 rounded-full border border-aura-warning/40 px-2.5 py-1 text-[0.65rem] font-medium text-aura-warning hover:bg-aura-warning/10"
                        >
                          <MessageCircleWarning size={10} />
                          Pedir ajuste
                        </button>
                        <button
                          type="button"
                          onClick={() => rejeitar(p)}
                          className="flex items-center gap-1 rounded-full border border-aura-danger/40 px-2.5 py-1 text-[0.65rem] font-medium text-aura-danger hover:bg-aura-danger/10"
                        >
                          <X size={10} />
                          Rejeitar
                        </button>
                      </>
                    )}
                    {podeCriar && (
                      <button
                        type="button"
                        onClick={() => excluir(p.id)}
                        className="ml-auto text-[0.65rem] text-aura-graphite-soft hover:text-aura-danger"
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
