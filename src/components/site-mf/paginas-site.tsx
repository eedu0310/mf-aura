"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Check, Copy, ExternalLink, Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  EMPRESA_DO_SITE,
  ROTULO_DO_BLOCO,
  TIPOS_DE_BLOCO,
  blocoNovo,
  paraSlug,
  slugValido,
  type Bloco,
  type Formulario,
  type Pagina,
  type TipoBloco,
} from "@/lib/site-mf/tipos";
import { PaginaPublica } from "./pagina-publica";
import { UploadArquivo } from "./upload-arquivo";

const entrada = "min-h-10 w-full rounded-xl border border-aura-mist bg-white px-3 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500";

export function PaginasSite() {
  const [lista, setLista] = useState<Pagina[]>([]);
  const [formularios, setFormularios] = useState<Formulario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState<Pagina | null>(null);

  const carregar = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    const [p, f] = await Promise.all([
      sb.from("site_paginas").select("*").order("created_at", { ascending: false }),
      sb.from("site_formularios").select("*").order("nome"),
    ]);
    setLista((p.data ?? []) as Pagina[]);
    setFormularios((f.data ?? []) as Formulario[]);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (editando) {
    return (
      <EditorPagina
        inicial={editando}
        formularios={formularios}
        onVoltar={async () => {
          setEditando(null);
          await carregar();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-aura-graphite-soft">
          Páginas de captura (LPs) da MF: catálogo, Black Friday, lançamento. Ficam no ar em <span className="font-data">/s/endereço</span>.
        </p>
        <button
          type="button"
          onClick={() =>
            setEditando({
              id: "",
              empresa: EMPRESA_DO_SITE,
              titulo: "Nova página",
              slug: "",
              blocos: [blocoNovo("hero"), blocoNovo("beneficios"), blocoNovo("chamada")],
              formulario_id: formularios[0]?.id ?? null,
              cor: "#CD1C1B",
              tema: "escuro",
              seo_titulo: null,
              seo_descricao: null,
              publicada: false,
            })
          }
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-aura-petrol-700 px-4 text-sm font-medium text-white hover:bg-aura-petrol-600"
        >
          <Plus size={16} /> Nova página
        </button>
      </div>

      {carregando ? (
        <div className="flex justify-center py-16 text-aura-graphite-soft">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : lista.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-aura-mist bg-white/60 px-6 py-12 text-center text-sm text-aura-graphite-soft">
          Nenhuma LP ainda. Comece por “Nova página”. Os formulários e as páginas de materiais que já estão no ar ficam logo abaixo.
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 rounded-2xl border border-aura-mist bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-aura-graphite">{p.titulo}</p>
                <span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${p.publicada ? "bg-emerald-100 text-emerald-900" : "bg-aura-mist text-aura-graphite-soft"}`}>
                  {p.publicada ? "No ar" : "Rascunho"}
                </span>
              </div>
              <p className="font-data text-xs text-aura-graphite-soft">/s/{p.slug}</p>
              <p className="text-xs text-aura-graphite-soft">
                {formularios.find((f) => f.id === p.formulario_id)?.nome ?? "Sem formulário"} · {p.blocos.length} blocos
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <button type="button" onClick={() => setEditando(p)} className="min-h-9 rounded-full border border-aura-mist px-3 text-xs font-medium text-aura-graphite hover:border-aura-petrol-500/50">
                  Editar
                </button>
                {p.publicada && (
                  <a href={`/s/${p.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 rounded-full border border-aura-mist px-3 text-xs font-medium text-aura-graphite hover:border-aura-petrol-500/50">
                    <ExternalLink size={13} /> Abrir
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!carregando && <PaginasProntas formularios={formularios} />}
    </div>
  );
}

/** Páginas de materiais que já estão no ar (não são editadas aqui, só abertas e divulgadas). */
const PAGINAS_DE_MATERIAIS: { nome: string; caminho: string; texto: string }[] = [
  { nome: "Materiais gratuitos (entrada)", caminho: "/materiais", texto: "Todos os materiais num lugar só" },
  { nome: "Manuais", caminho: "/materiais/manuais", texto: "31 modelos, um botão de baixar por modelo" },
  { nome: "Blocos 3D", caminho: "/materiais/blocos", texto: "52 blocos .SKP e .3DS por modelo" },
  { nome: "Tutoriais em vídeo", caminho: "/materiais/tutoriais", texto: "10 vídeos: instalação, lenha, acendimento, limpeza" },
  { nome: "Catálogo MF 2025", caminho: "/materiais/catalogo", texto: "Página de download do catálogo" },
  { nome: "Tripla combustão", caminho: "/materiais/tripla-combustao", texto: "Como funciona e o infográfico" },
  { nome: "Realidade aumentada", caminho: "/materiais/realidade-aumentada", texto: "Acesso ao MF Preview" },
];

function PaginasProntas({ formularios }: { formularios: Formulario[] }) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const origem = typeof window !== "undefined" ? window.location.origin : "";

  function copiar(caminho: string) {
    void navigator.clipboard?.writeText(origem + caminho).then(() => {
      setCopiado(caminho);
      setTimeout(() => setCopiado((c) => (c === caminho ? null : c)), 1800);
    });
  }

  const item = ({ nome, caminho, texto, ativo = true }: { nome: string; caminho: string; texto: string; ativo?: boolean }) => (
    <li key={caminho} className="flex flex-col gap-2 rounded-2xl border border-aura-mist bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-aura-graphite">{nome}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${ativo ? "bg-emerald-100 text-emerald-900" : "bg-aura-mist text-aura-graphite-soft"}`}>
          {ativo ? "No ar" : "Desligado"}
        </span>
      </div>
      <p className="font-data text-xs text-aura-graphite-soft">{caminho}</p>
      <p className="text-xs text-aura-graphite-soft">{texto}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        <a href={caminho} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1 rounded-full border border-aura-mist px-3 text-xs font-medium text-aura-graphite hover:border-aura-petrol-500/50">
          <ExternalLink size={13} /> Abrir
        </a>
        <button type="button" onClick={() => copiar(caminho)} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-aura-mist px-3 text-xs font-medium text-aura-graphite hover:border-aura-petrol-500/50">
          {copiado === caminho ? <Check size={13} /> : <Copy size={13} />} {copiado === caminho ? "Copiado" : "Copiar link"}
        </button>
      </div>
    </li>
  );

  return (
    <>
      <div className="mt-4 border-t border-aura-mist pt-5">
        <h2 className="font-display text-base font-semibold text-aura-graphite">Formulários dos materiais</h2>
        <p className="mt-1 text-xs text-aura-graphite-soft">
          Onde o cliente preenche os dados. Depois de enviar, ele recebe o material. Use estes links nos botões do site, no Instagram e nas campanhas.
        </p>
      </div>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {formularios.map((f) =>
          item({
            nome: f.nome,
            caminho: `/f/${f.slug}`,
            texto: f.material_url ? `Entrega: ${f.material_nome || "material"}` : "Sem material para entregar",
            ativo: f.ativo,
          }),
        )}
      </ul>

      <div className="mt-4 border-t border-aura-mist pt-5">
        <h2 className="font-display text-base font-semibold text-aura-graphite">Páginas de download</h2>
        <p className="mt-1 text-xs text-aura-graphite-soft">As páginas para onde o cliente vai depois do formulário, com os botões de baixar.</p>
      </div>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {PAGINAS_DE_MATERIAIS.map((p) => item(p))}
      </ul>
    </>
  );
}

function EditorPagina({ inicial, formularios, onVoltar }: { inicial: Pagina; formularios: Formulario[]; onVoltar: () => void }) {
  const [p, setP] = useState<Pagina>(inicial);
  const [vendo, setVendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const novo = !p.id;

  const formulario = useMemo(() => formularios.find((f) => f.id === p.formulario_id) ?? null, [formularios, p.formulario_id]);

  function mudar<K extends keyof Pagina>(k: K, v: Pagina[K]) {
    setP((x) => ({ ...x, [k]: v }));
    setSalvo(false);
  }
  function mudarBloco(i: number, patch: Partial<Bloco>) {
    mudar(
      "blocos",
      p.blocos.map((b, j) => (j === i ? { ...b, ...patch } : b)),
    );
  }
  function mover(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= p.blocos.length) return;
    const b = [...p.blocos];
    [b[i], b[j]] = [b[j], b[i]];
    mudar("blocos", b);
  }

  async function salvar(publicar?: boolean) {
    setErro(null);
    const slug = p.slug || paraSlug(p.titulo);
    if (!p.titulo.trim()) return setErro("Dê um título à página.");
    if (!slugValido(slug)) return setErro("O endereço precisa ter só letras minúsculas, números e hífen.");
    const publicada = publicar ?? p.publicada;
    if (publicada && !p.formulario_id) return setErro("Escolha o formulário antes de pôr no ar: sem ele, a página não gera lead.");
    setSalvando(true);
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    const linha = {
      empresa: p.empresa || EMPRESA_DO_SITE,
      titulo: p.titulo.trim(),
      slug,
      blocos: p.blocos,
      formulario_id: p.formulario_id,
      cor: /^#[0-9A-Fa-f]{6}$/.test(p.cor) ? p.cor : "#CD1C1B",
      tema: p.tema,
      seo_titulo: p.seo_titulo?.trim() || null,
      seo_descricao: p.seo_descricao?.trim() || null,
      publicada,
      updated_at: new Date().toISOString(),
    };
    const r = novo
      ? await sb.from("site_paginas").insert(linha).select("*").single()
      : await sb.from("site_paginas").update(linha).eq("id", p.id).select("*").single();
    setSalvando(false);
    if (r.error || !r.data) {
      setErro(r.error?.code === "23505" ? "Já existe uma página com esse endereço. Troque o endereço." : r.error?.message || "Não consegui salvar.");
      return;
    }
    setP(r.data as Pagina);
    setSalvo(true);
  }

  async function apagar() {
    if (!p.id) return onVoltar();
    if (!confirm(`Apagar a página "${p.titulo}"? O endereço dela deixa de funcionar.`)) return;
    const sb = getSupabaseBrowserClient();
    await sb?.from("site_paginas").delete().eq("id", p.id);
    onVoltar();
  }

  const link = `${typeof window === "undefined" ? "" : window.location.origin}/s/${p.slug || paraSlug(p.titulo)}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onVoltar} className="inline-flex items-center gap-1.5 text-sm text-aura-graphite-soft hover:text-aura-graphite">
          <ArrowLeft size={15} /> Páginas
        </button>
        <div className="flex gap-1 rounded-full border border-aura-mist bg-white p-1">
          <button
            type="button"
            onClick={() => setVendo(false)}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${!vendo ? "bg-aura-petrol-700 text-white" : "text-aura-graphite"}`}
          >
            <Pencil size={13} /> Editar
          </button>
          <button
            type="button"
            onClick={() => setVendo(true)}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${vendo ? "bg-aura-petrol-700 text-white" : "text-aura-graphite"}`}
          >
            <Eye size={13} /> Ver como fica
          </button>
        </div>
      </div>

      {vendo ? (
        <div className="overflow-hidden rounded-2xl border border-aura-mist">
          <PaginaPublica
            slug={p.slug || "previa"}
            blocos={p.blocos}
            cor={p.cor}
            tema={p.tema}
            formulario={formulario}
            previa
          />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex flex-col gap-3">
            {p.blocos.map((b, i) => (
              <section key={b.id} className="flex flex-col gap-2.5 rounded-2xl border border-aura-mist bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-aura-graphite">{ROTULO_DO_BLOCO[b.tipo]}</p>
                  <div className="flex gap-1">
                    <button type="button" aria-label="Subir bloco" onClick={() => mover(i, -1)} className="rounded-lg p-2 text-aura-graphite-soft hover:bg-aura-bg">
                      <ArrowUp size={15} />
                    </button>
                    <button type="button" aria-label="Descer bloco" onClick={() => mover(i, 1)} className="rounded-lg p-2 text-aura-graphite-soft hover:bg-aura-bg">
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      aria-label="Tirar bloco"
                      onClick={() => mudar("blocos", p.blocos.filter((_, j) => j !== i))}
                      className="rounded-lg p-2 text-aura-graphite-soft hover:bg-aura-bg hover:text-red-700"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <CamposDoBloco bloco={b} onMudar={(patch) => mudarBloco(i, patch)} />
              </section>
            ))}

            <div className="flex flex-wrap gap-2 rounded-2xl border border-dashed border-aura-mist bg-white/60 p-3">
              <span className="w-full text-xs text-aura-graphite-soft">Acrescentar bloco:</span>
              {TIPOS_DE_BLOCO.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => mudar("blocos", [...p.blocos, blocoNovo(t as TipoBloco)])}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full border border-aura-mist bg-white px-3 text-xs font-medium text-aura-graphite hover:border-aura-petrol-500/50"
                >
                  <Plus size={13} /> {ROTULO_DO_BLOCO[t as TipoBloco].split(" (")[0]}
                </button>
              ))}
            </div>
          </div>

          <aside className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
            <section className="flex flex-col gap-3 rounded-2xl border border-aura-mist bg-white p-4">
              <label className="flex flex-col gap-1 text-sm text-aura-graphite">
                Título da página
                <input className={entrada} value={p.titulo} onChange={(e) => mudar("titulo", e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm text-aura-graphite">
                Endereço
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-xs text-aura-graphite-soft">/s/</span>
                  <input className={entrada} value={p.slug} placeholder={paraSlug(p.titulo)} onChange={(e) => mudar("slug", paraSlug(e.target.value))} />
                </div>
              </label>
              <label className="flex flex-col gap-1 text-sm text-aura-graphite">
                Formulário
                <select className={entrada} value={p.formulario_id ?? ""} onChange={(e) => mudar("formulario_id", e.target.value || null)}>
                  <option value="">Sem formulário</option>
                  {formularios.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-sm text-aura-graphite">
                  Fundo
                  <select className={entrada} value={p.tema} onChange={(e) => mudar("tema", e.target.value === "claro" ? "claro" : "escuro")}>
                    <option value="escuro">Escuro</option>
                    <option value="claro">Claro</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-aura-graphite">
                  Cor de destaque
                  <input type="color" aria-label="Cor de destaque" value={p.cor} onChange={(e) => mudar("cor", e.target.value.toUpperCase())} className="h-10 w-full rounded-xl border border-aura-mist" />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm text-aura-graphite">
                Título no Google
                <input className={entrada} value={p.seo_titulo ?? ""} placeholder={p.titulo} onChange={(e) => mudar("seo_titulo", e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm text-aura-graphite">
                Descrição no Google
                <textarea rows={2} className={`${entrada} py-2`} value={p.seo_descricao ?? ""} onChange={(e) => mudar("seo_descricao", e.target.value)} />
              </label>
            </section>

            {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{erro}</p>}

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void salvar()}
                disabled={salvando}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-aura-mist bg-white px-5 text-sm font-medium text-aura-graphite disabled:opacity-60"
              >
                {salvando ? <Loader2 size={16} className="animate-spin" /> : salvo ? <Check size={16} /> : null} {salvo ? "Salvo" : "Salvar"}
              </button>
              <button
                type="button"
                onClick={() => void salvar(!p.publicada)}
                disabled={salvando}
                className={`min-h-11 rounded-full px-5 text-sm font-medium disabled:opacity-60 ${p.publicada ? "border border-aura-mist bg-white text-aura-graphite" : "bg-aura-petrol-700 text-white hover:bg-aura-petrol-600"}`}
              >
                {p.publicada ? "Tirar do ar" : "Salvar e pôr no ar"}
              </button>
              <button type="button" onClick={() => void apagar()} className="min-h-11 rounded-full px-5 text-sm font-medium text-red-700">
                {novo ? "Descartar" : "Apagar página"}
              </button>
            </div>

            {p.publicada && (
              <section className="flex flex-col gap-2 rounded-2xl border border-aura-mist bg-white p-4">
                <p className="text-sm font-medium text-aura-graphite">No ar em</p>
                <a href={link} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-aura-petrol-600 underline">
                  {link}
                </a>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(link);
                    setCopiado(true);
                    setTimeout(() => setCopiado(false), 2000);
                  }}
                  className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full border border-aura-mist px-3 text-xs font-medium text-aura-graphite"
                >
                  {copiado ? <Check size={14} /> : <Copy size={14} />} {copiado ? "Copiado" : "Copiar link"}
                </button>
                <p className="text-xs leading-relaxed text-aura-graphite-soft">
                  Para saber de qual anúncio veio, use o link com <span className="font-data">?utm_campaign=nome-da-campanha</span> no fim.
                </p>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function CamposDoBloco({ bloco: b, onMudar }: { bloco: Bloco; onMudar: (patch: Partial<Bloco>) => void }) {
  const titulo = (
    <input aria-label="Título" className={entrada} placeholder="Título" value={b.titulo ?? ""} onChange={(e) => onMudar({ titulo: e.target.value })} />
  );
  switch (b.tipo) {
    case "hero":
      return (
        <>
          {titulo}
          <textarea aria-label="Subtítulo" rows={2} className={`${entrada} py-2`} placeholder="Subtítulo" value={b.subtitulo ?? ""} onChange={(e) => onMudar({ subtitulo: e.target.value })} />
          <input aria-label="Texto do botão" className={entrada} placeholder="Texto do botão (quando o formulário não está ao lado)" value={b.botao ?? ""} onChange={(e) => onMudar({ botao: e.target.value })} />
          <CampoImagem valor={b.imagem} onMudar={(imagem) => onMudar({ imagem })} />
          <p className="text-xs text-aura-graphite-soft">Se esta for a primeira parte e a página não tiver bloco de Formulário, o formulário aparece ao lado do título.</p>
        </>
      );
    case "texto":
      return (
        <>
          {titulo}
          <textarea aria-label="Texto" rows={4} className={`${entrada} py-2`} value={b.texto ?? ""} onChange={(e) => onMudar({ texto: e.target.value })} />
        </>
      );
    case "beneficios":
      return (
        <>
          {titulo}
          {(b.itens ?? []).map((it, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
              <input
                aria-label="Vantagem"
                className={entrada}
                value={it.titulo}
                onChange={(e) => onMudar({ itens: (b.itens ?? []).map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)) })}
              />
              <input
                aria-label="Explicação"
                className={entrada}
                value={it.texto}
                onChange={(e) => onMudar({ itens: (b.itens ?? []).map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })}
              />
              <button
                type="button"
                aria-label="Tirar vantagem"
                onClick={() => onMudar({ itens: (b.itens ?? []).filter((_, j) => j !== i) })}
                className="rounded-lg p-2 text-aura-graphite-soft hover:bg-aura-bg hover:text-red-700"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onMudar({ itens: [...(b.itens ?? []), { titulo: "Vantagem", texto: "" }] })}
            className="inline-flex min-h-9 w-fit items-center gap-1 rounded-full border border-aura-mist px-3 text-xs font-medium text-aura-graphite"
          >
            <Plus size={13} /> Vantagem
          </button>
        </>
      );
    case "imagem":
      return (
        <>
          <CampoImagem valor={b.imagem} onMudar={(imagem) => onMudar({ imagem })} />
          <input aria-label="Legenda" className={entrada} placeholder="Legenda (opcional)" value={b.legenda ?? ""} onChange={(e) => onMudar({ legenda: e.target.value })} />
        </>
      );
    case "video":
      return (
        <>
          {titulo}
          <input aria-label="Link do YouTube" className={entrada} placeholder="Link do YouTube" value={b.video ?? ""} onChange={(e) => onMudar({ video: e.target.value })} />
        </>
      );
    case "formulario":
      return (
        <>
          {titulo}
          <p className="text-xs text-aura-graphite-soft">O formulário escolhido ao lado aparece aqui.</p>
        </>
      );
    case "chamada":
      return (
        <>
          {titulo}
          <input aria-label="Texto" className={entrada} placeholder="Texto (opcional)" value={b.texto ?? ""} onChange={(e) => onMudar({ texto: e.target.value })} />
          <div className="grid gap-2 sm:grid-cols-2">
            <input aria-label="Texto do botão" className={entrada} placeholder="Texto do botão" value={b.botao ?? ""} onChange={(e) => onMudar({ botao: e.target.value })} />
            <input aria-label="Link do botão" className={entrada} placeholder="https://wa.me/55…" value={b.link ?? ""} onChange={(e) => onMudar({ link: e.target.value })} />
          </div>
        </>
      );
  }
}

function CampoImagem({ valor, onMudar }: { valor?: string; onMudar: (url: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {valor && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={valor} alt="" className="max-h-40 w-fit rounded-xl object-cover" />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <UploadArquivo rotulo={valor ? "Trocar imagem" : "Subir imagem"} aceita="image/jpeg,image/png,image/webp" onPronto={onMudar} />
        {valor && (
          <button type="button" onClick={() => onMudar("")} className="text-xs text-aura-graphite-soft underline">
            Tirar imagem
          </button>
        )}
      </div>
    </div>
  );
}
