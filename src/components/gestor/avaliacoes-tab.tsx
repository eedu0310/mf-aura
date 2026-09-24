"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, Loader2, Star } from "lucide-react";

interface Config {
  empresa: string;
  link_google: string | null;
  link_instagram: string | null;
  link_facebook: string | null;
  mensagem_padrao: string | null;
}

interface Pedido {
  id: string;
  empresa: string;
  cliente: string | null;
  enviado_em: string | null;
  aberto_em: string | null;
  confirmado_em: string | null;
  criado_em: string;
}

interface Resumo {
  total: number;
  enviados: number;
  abertos: number;
  confirmados: number;
}

const CAMPOS = [
  {
    chave: "link_google" as const,
    corpo: "linkGoogle",
    rotulo: "Link de avaliação do Google",
    dica: "No Google Meu Negócio: Pedir avaliações → copiar link",
  },
  { chave: "link_instagram" as const, corpo: "linkInstagram", rotulo: "Instagram", dica: "instagram.com/sualoja" },
  { chave: "link_facebook" as const, corpo: "linkFacebook", rotulo: "Facebook", dica: "facebook.com/sualoja" },
];

/** Onde o gestor cadastra os links e acompanha quem pediu avaliação. */
export function AvaliacoesTab() {
  const [config, setConfig] = useState<Config[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvo, setSalvo] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/gestor/config-avaliacao", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) {
        setConfig(json.config ?? []);
        setPedidos(json.pedidos ?? []);
        setResumo(json.resumo ?? null);
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvar(empresa: string, campo: string, valor: string) {
    await fetch("/api/gestor/config-avaliacao", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresa, [campo]: valor }),
    });
    setSalvo(`${empresa}:${campo}`);
    window.setTimeout(() => setSalvo(null), 2000);
    await carregar();
  }

  async function confirmar(id: string, valor: boolean) {
    await fetch("/api/avaliacoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, confirmado: valor }),
    });
    await carregar();
  }

  if (carregando) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-aura-petrol-500" />
      </div>
    );
  }

  const semLink = config.filter((c) => !c.link_google);

  return (
    <div className="space-y-5">
      {semLink.length > 0 && (
        <p className="rounded-xl border border-aura-warning/40 bg-aura-warning/5 px-4 py-3 text-sm text-aura-graphite">
          <strong>Falta o link do Google</strong> em{" "}
          {semLink.map((c) => c.empresa).join(", ")}. Enquanto estiver vazio, o vendedor não
          consegue pedir avaliação dessa loja.
        </p>
      )}

      {resumo && resumo.total > 0 && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { r: "Vendas no período", v: resumo.total },
            { r: "Link enviado", v: resumo.enviados },
            { r: "Cliente abriu", v: resumo.abertos },
            { r: "Avaliou", v: resumo.confirmados },
          ].map((c) => (
            <div key={c.r} className="rounded-2xl border border-aura-mist bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-aura-graphite-soft">
                {c.r}
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-aura-graphite">{c.v}</p>
            </div>
          ))}
        </div>
      )}

      {/* Links por loja */}
      <section className="space-y-4">
        {config.map((c) => (
          <div key={c.empresa} className="rounded-2xl border border-aura-mist bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-aura-graphite">
              <Star size={15} className="text-aura-gold" />
              {c.empresa}
            </h3>

            <div className="grid gap-3 lg:grid-cols-3">
              {CAMPOS.map((campo) => (
                <label key={campo.chave} className="text-sm text-aura-graphite">
                  {campo.rotulo}
                  <input
                    type="url"
                    defaultValue={c[campo.chave] ?? ""}
                    onBlur={(e) => {
                      if (e.target.value.trim() !== (c[campo.chave] ?? "")) {
                        void salvar(c.empresa, campo.corpo, e.target.value);
                      }
                    }}
                    placeholder={campo.dica}
                    className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm focus:border-aura-petrol-500 focus:outline-none"
                  />
                  <span className="mt-1 flex items-center gap-2 text-xs text-aura-graphite-soft">
                    {salvo === `${c.empresa}:${campo.corpo}` ? (
                      <span className="flex items-center gap-1 text-aura-success">
                        <Check size={11} /> salvo
                      </span>
                    ) : (
                      campo.dica
                    )}
                    {c[campo.chave] && (
                      <a
                        href={c[campo.chave] as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-aura-petrol-700 hover:underline"
                      >
                        testar <ExternalLink size={10} />
                      </a>
                    )}
                  </span>
                </label>
              ))}
            </div>

            <label className="mt-3 block text-sm text-aura-graphite">
              Mensagem que o vendedor envia
              <textarea
                defaultValue={c.mensagem_padrao ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (c.mensagem_padrao ?? "")) {
                    void salvar(c.empresa, "mensagem", e.target.value);
                  }
                }}
                rows={2}
                className="mt-1 w-full rounded-lg border border-aura-mist px-3 py-2 text-sm focus:border-aura-petrol-500 focus:outline-none"
              />
              <span className="mt-1 block text-xs text-aura-graphite-soft">
                Use <code>{"{cliente}"}</code> para o nome e <code>{"{link}"}</code> para o link.
              </span>
            </label>
          </div>
        ))}
      </section>

      {/* Acompanhamento */}
      <section className="rounded-2xl border border-aura-mist bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-aura-graphite">Últimas vendas</h3>
        <p className="mb-3 text-xs text-aura-graphite-soft">
          O sistema sabe quando o cliente abriu o link. Quem de fato avaliou, só você consegue
          confirmar — o Google não avisa ninguém.
        </p>

        {pedidos.length === 0 ? (
          <p className="py-4 text-center text-sm text-aura-graphite-soft">
            Nenhuma venda registrada ainda.
          </p>
        ) : (
          <ul className="divide-y divide-aura-mist">
            {pedidos.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-aura-graphite">
                    {p.cliente ?? "Cliente"}
                  </p>
                  <p className="text-xs text-aura-graphite-soft">
                    {p.empresa} ·{" "}
                    {p.confirmado_em
                      ? "avaliou"
                      : p.aberto_em
                        ? "abriu o link"
                        : p.enviado_em
                          ? "link enviado"
                          : "não pediu ainda"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void confirmar(p.id, !p.confirmado_em)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    p.confirmado_em
                      ? "bg-aura-success/10 text-aura-success"
                      : "border border-aura-mist text-aura-graphite-soft hover:border-aura-petrol-500 hover:text-aura-petrol-700"
                  }`}
                >
                  {p.confirmado_em ? "Avaliou ✓" : "Marcar como avaliou"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
