import { FormularioPublico } from "./formulario-publico";
import { idDoYoutube, type Bloco, type Formulario } from "@/lib/site-mf/tipos";

export interface PaginaPublicaProps {
  slug: string;
  blocos: Bloco[];
  cor: string;
  tema: "escuro" | "claro";
  formulario: Pick<Formulario, "slug" | "titulo" | "descricao" | "campos" | "botao_texto" | "cor"> | null;
  previa?: boolean;
}

/**
 * A LP montada por blocos. A mesma peça desenha a página pública (/s/…) e a
 * prévia no editor da AURA, para o que o gestor vê ser o que vai ao ar.
 */
export function PaginaPublica({ slug, blocos, cor, tema, formulario, previa }: PaginaPublicaProps) {
  const escuro = tema === "escuro";
  const fundo = escuro ? "bg-[#141414] text-white" : "bg-white text-neutral-900";
  const suave = escuro ? "text-neutral-300" : "text-neutral-600";
  const cartao = escuro ? "bg-[#1f1f1f]" : "bg-neutral-100";

  const form = formulario ? (
    <FormularioPublico
      slug={formulario.slug}
      titulo={formulario.titulo}
      descricao={formulario.descricao}
      campos={formulario.campos}
      botao={formulario.botao_texto}
      cor={formulario.cor || cor}
      pagina={slug}
      previa={previa}
    />
  ) : (
    <p className={`rounded-2xl ${cartao} p-6 text-sm ${suave}`}>Escolha um formulário para esta página.</p>
  );
  const temBlocoDeFormulario = blocos.some((b) => b.tipo === "formulario");

  return (
    <div className={`min-h-full ${fundo}`}>
      <header className={`border-b ${escuro ? "border-white/10" : "border-black/10"}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <p className="text-lg font-extrabold tracking-wide">
            MF <span style={{ color: cor }}>INTERNATIONAL</span>
          </p>
          <p className={`hidden text-xs sm:block ${suave}`}>Desde 1977 · Pioneiros na tripla combustão</p>
        </div>
      </header>

      {blocos.map((b, i) => {
        // A capa leva o formulário ao lado quando a página não tem um bloco
        // de formulário próprio: é o desenho mais comum de LP.
        if (b.tipo === "hero") {
          const formAoLado = !temBlocoDeFormulario && i === 0;
          return (
            <section key={b.id} className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
              <div className={`grid items-center gap-10 ${formAoLado ? "lg:grid-cols-2" : ""}`}>
                <div className="flex flex-col gap-5">
                  {b.titulo && <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl">{b.titulo}</h1>}
                  {b.subtitulo && <p className={`text-base leading-relaxed sm:text-lg ${suave}`}>{b.subtitulo}</p>}
                  {b.imagem && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.imagem} alt={b.titulo ?? ""} className="max-h-[420px] w-full rounded-2xl object-cover" />
                  )}
                  {!formAoLado && b.botao && (
                    <a href="#formulario" className="inline-flex min-h-12 w-fit items-center rounded-full px-6 font-semibold text-white" style={{ backgroundColor: cor }}>
                      {b.botao}
                    </a>
                  )}
                </div>
                {formAoLado && <div id="formulario">{form}</div>}
              </div>
            </section>
          );
        }
        if (b.tipo === "texto") {
          return (
            <section key={b.id} className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
              {b.titulo && <h2 className="text-2xl font-bold sm:text-3xl">{b.titulo}</h2>}
              {b.texto && <p className={`mt-4 whitespace-pre-line text-base leading-relaxed ${suave}`}>{b.texto}</p>}
            </section>
          );
        }
        if (b.tipo === "beneficios") {
          return (
            <section key={b.id} className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
              {b.titulo && <h2 className="text-2xl font-bold sm:text-3xl">{b.titulo}</h2>}
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(b.itens ?? []).map((it, j) => (
                  <div key={j} className={`rounded-2xl ${cartao} p-5`}>
                    <p className="font-semibold" style={{ color: escuro ? undefined : cor }}>
                      {it.titulo}
                    </p>
                    <p className={`mt-1.5 text-sm leading-relaxed ${suave}`}>{it.texto}</p>
                  </div>
                ))}
              </div>
            </section>
          );
        }
        if (b.tipo === "imagem") {
          return b.imagem ? (
            <figure key={b.id} className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.imagem} alt={b.legenda ?? ""} className="w-full rounded-2xl object-cover" />
              {b.legenda && <figcaption className={`mt-2 text-center text-sm ${suave}`}>{b.legenda}</figcaption>}
            </figure>
          ) : null;
        }
        if (b.tipo === "video") {
          const id = idDoYoutube(b.video);
          return id ? (
            <section key={b.id} className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
              {b.titulo && <h2 className="mb-4 text-2xl font-bold">{b.titulo}</h2>}
              <div className="aspect-video overflow-hidden rounded-2xl">
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${id}`}
                  title={b.titulo || "Vídeo"}
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </section>
          ) : null;
        }
        if (b.tipo === "formulario") {
          return (
            <section key={b.id} id="formulario" className="mx-auto max-w-xl px-5 py-10 sm:px-8">
              {b.titulo && <h2 className="mb-4 text-center text-2xl font-bold">{b.titulo}</h2>}
              {form}
            </section>
          );
        }
        if (b.tipo === "chamada") {
          return (
            <section key={b.id} className="px-5 py-12 sm:px-8" style={{ backgroundColor: cor }}>
              <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 text-center text-white">
                {b.titulo && <h2 className="text-2xl font-bold sm:text-3xl">{b.titulo}</h2>}
                {b.texto && <p className="text-base leading-relaxed text-white/90">{b.texto}</p>}
                {b.botao && b.link && (
                  <a href={b.link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-full bg-white px-6 font-semibold" style={{ color: cor }}>
                    {b.botao}
                  </a>
                )}
              </div>
            </section>
          );
        }
        return null;
      })}

      <footer className={`mt-6 border-t ${escuro ? "border-white/10" : "border-black/10"}`}>
        <div className={`mx-auto max-w-6xl px-5 py-6 text-xs sm:px-8 ${suave}`}>
          MF International · ERS-122, km 08, Conceição, São Sebastião do Caí/RS · WhatsApp (51) 3536-1422 · mfinternational.com.br
        </div>
      </footer>
    </div>
  );
}
