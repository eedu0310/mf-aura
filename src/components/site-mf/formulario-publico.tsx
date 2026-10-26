"use client";

import { useState } from "react";
import type { CampoFormulario } from "@/lib/site-mf/tipos";

export interface FormularioPublicoProps {
  slug: string;
  titulo?: string | null;
  descricao?: string | null;
  campos: CampoFormulario[];
  botao: string;
  cor: string;
  pagina?: string | null;
  /** Prévia no editor da AURA: não envia nada. */
  previa?: boolean;
}

/**
 * O formulário que o visitante preenche, na LP (/s/…) ou embutido no site
 * (/f/…). Estilo próprio e neutro: fundo branco, cor do botão vinda do
 * formulário, para combinar com qualquer página onde for colado.
 */
export function FormularioPublico({ slug, titulo, descricao, campos, botao, cor, pagina, previa }: FormularioPublicoProps) {
  const [valores, setValores] = useState<Record<string, string | boolean>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<{ mensagem: string; material: { nome: string; url: string } | null } | null>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (previa) return;
    setErro(null);
    setEnviando(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const utm: Record<string, string> = {};
      for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"]) {
        const v = params.get(k);
        if (v) utm[k] = v.slice(0, 200);
      }
      const armadilha = (e.currentTarget.elements.namedItem("site") as HTMLInputElement | null)?.value ?? "";
      const r = await fetch("/api/site/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formulario: slug,
          pagina: pagina ?? null,
          dados: valores,
          utm,
          // Embutido em iframe, quem importa é a página de fora.
          origem_url: window.self !== window.top ? document.referrer : window.location.href,
          site: armadilha,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setErro(j.erro || "Não consegui enviar agora. Tente de novo.");
      } else {
        setPronto({ mensagem: j.mensagem || "Recebemos seus dados!", material: j.material ?? null });
      }
    } catch {
      setErro("Sem conexão. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const campo =
    "w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-500";

  if (pronto) {
    return (
      <div className="rounded-2xl bg-white p-6 text-neutral-900 shadow-sm sm:p-8">
        <p className="text-xl font-bold">Tudo certo!</p>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-700">{pronto.mensagem}</p>
        {pronto.material && (
          <a
            href={pronto.material.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full px-6 text-[15px] font-semibold text-white"
            style={{ backgroundColor: cor }}
          >
            {pronto.material.nome}
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="rounded-2xl bg-white p-6 text-neutral-900 shadow-sm sm:p-8" noValidate>
      {titulo && <p className="text-xl font-bold">{titulo}</p>}
      {descricao && <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{descricao}</p>}

      <div className={`${titulo || descricao ? "mt-5" : ""} flex flex-col gap-3.5`}>
        {campos.map((c) => {
          const id = `campo-${slug}-${c.chave}`;
          const rotulo = `${c.rotulo}${c.obrigatorio ? " *" : ""}`;
          if (c.tipo === "caixa") {
            return (
              <label key={c.chave} htmlFor={id} className="flex items-start gap-2.5 text-sm leading-relaxed text-neutral-700">
                <input
                  id={id}
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={valores[c.chave] === true}
                  onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.checked }))}
                />
                {rotulo}
              </label>
            );
          }
          return (
            <div key={c.chave} className="flex flex-col gap-1.5">
              <label htmlFor={id} className="text-sm font-medium text-neutral-800">
                {rotulo}
              </label>
              {c.tipo === "selecao" ? (
                <select
                  id={id}
                  className={campo}
                  value={String(valores[c.chave] ?? "")}
                  onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))}
                >
                  <option value="">Escolha</option>
                  {(c.opcoes ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : c.tipo === "area" ? (
                <textarea
                  id={id}
                  rows={3}
                  className={campo}
                  value={String(valores[c.chave] ?? "")}
                  onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))}
                />
              ) : (
                <input
                  id={id}
                  type={c.tipo === "email" ? "email" : c.tipo === "telefone" ? "tel" : "text"}
                  inputMode={c.tipo === "telefone" ? "tel" : undefined}
                  autoComplete={
                    c.tipo === "email" ? "email" : c.tipo === "telefone" ? "tel" : c.chave === "nome" ? "given-name" : c.tipo === "cidade" ? "address-level2" : undefined
                  }
                  placeholder={c.tipo === "telefone" ? "(51) 9 9999-9999" : undefined}
                  className={campo}
                  value={String(valores[c.chave] ?? "")}
                  onChange={(e) => setValores((v) => ({ ...v, [c.chave]: e.target.value }))}
                />
              )}
            </div>
          );
        })}

        {/* Armadilha para robô: escondida de quem enxerga e de leitor de tela. */}
        <input type="text" name="site" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />

        <p className="text-xs leading-relaxed text-neutral-500">
          Ao enviar, você concorda que a MF International use estes dados para entrar em contato.
        </p>

        {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erro}</p>}

        <button
          type="submit"
          disabled={enviando}
          className="min-h-12 rounded-full px-6 text-[15px] font-semibold text-white transition disabled:opacity-60"
          style={{ backgroundColor: cor }}
        >
          {enviando ? "Enviando…" : botao}
        </button>
      </div>
    </form>
  );
}
