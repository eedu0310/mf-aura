"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, Loader2, Star } from "lucide-react";
import { Alerta, Card, CardHeader, EstadoVazio, StatCard, classeBotao } from "@/components/ui";

interface Config {
  empresa: string;
  link_google: string | null;
  link_instagram: string | null;
  link_facebook: string | null;
  mensagem_padrao: string | null;
  mensagem_redes: string | null;
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
    const res = await fetch("/api/gestor/config-avaliacao", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ empresa, [campo]: valor }),
    });
    // Antes mostrava "salvo" mesmo quando o servidor recusava.
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      window.alert(`Não salvou: ${j.erro ?? "erro no servidor"}`);
      return;
    }
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
    <div className="flex flex-col gap-6">
      {semLink.length > 0 && (
        <Alerta
          tom="atencao"
          titulo={<>Falta o link do Google em {semLink.map((c) => c.empresa).join(", ")}.</>}
          descricao="Enquanto estiver vazio, o vendedor não consegue pedir avaliação dessa loja."
        />
      )}

      {resumo && resumo.total > 0 && (
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { r: "Vendas no período", v: resumo.total },
            { r: "Link enviado", v: resumo.enviados },
            { r: "Cliente abriu", v: resumo.abertos },
            { r: "Avaliou", v: resumo.confirmados },
          ].map((c) => (
            <StatCard key={c.r} rotulo={c.r} valor={c.v} />
          ))}
        </div>
      )}

      {/* Links por loja */}
      <section className="space-y-4">
        {config.map((c) => (
          <Card key={c.empresa}>
            <CardHeader icone={Star} corIcone="text-aura-gold" titulo={c.empresa} />

            <div className="grid gap-3 lg:grid-cols-3">
              {CAMPOS.map((campo) => (
                <label key={campo.chave} className="text-sm font-medium text-aura-graphite">
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
                    className="aura-input mt-1.5 font-normal"
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
                        className="inline-flex items-center gap-1 text-aura-petrol-600 hover:underline"
                      >
                        testar <ExternalLink size={10} />
                      </a>
                    )}
                  </span>
                </label>
              ))}
            </div>

            <label className="mt-4 block text-sm font-medium text-aura-graphite">
              1ª mensagem — agradecimento e avaliação no Google
              <textarea
                defaultValue={c.mensagem_padrao ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (c.mensagem_padrao ?? "")) {
                    void salvar(c.empresa, "mensagem", e.target.value);
                  }
                }}
                rows={7}
                className="aura-input mt-1.5 font-normal"
              />
              <span className="mt-1 block text-xs text-aura-graphite-soft">
                {salvo === `${c.empresa}:mensagem` ? (
                  <span className="text-aura-success">salvo</span>
                ) : (
                  <>
                    Use <code>{"{cliente}"}</code> para o nome e <code>{"{link}"}</code> para o link do Google.
                  </>
                )}
              </span>
            </label>

            <label className="mt-4 block text-sm font-medium text-aura-graphite">
              2ª mensagem — redes sociais (vai logo depois da 1ª)
              <textarea
                defaultValue={c.mensagem_redes ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (c.mensagem_redes ?? "")) {
                    void salvar(c.empresa, "mensagemRedes", e.target.value);
                  }
                }}
                rows={7}
                placeholder="Deixe vazio para mandar só a 1ª mensagem."
                className="aura-input mt-1.5 font-normal"
              />
              <span className="mt-1 block text-xs text-aura-graphite-soft">
                {salvo === `${c.empresa}:mensagemRedes` ? (
                  <span className="text-aura-success">salvo</span>
                ) : (
                  <>
                    Use <code>{"{instagram}"}</code> e <code>{"{facebook}"}</code>: entram os links cadastrados acima. Se a loja não tiver um deles, a linha sai sozinha.
                  </>
                )}
              </span>
            </label>
          </Card>
        ))}
      </section>

      {/* Acompanhamento */}
      <Card>
        <CardHeader
          titulo="Últimas vendas"
          descricao="O sistema sabe quando o cliente abriu o link. Quem de fato avaliou, só você consegue confirmar — o Google não avisa ninguém."
        />

        {pedidos.length === 0 ? (
          <EstadoVazio titulo="Nenhuma venda registrada ainda." />
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
                  className={
                    p.confirmado_em
                      ? "aura-btn aura-btn-sm shrink-0 bg-aura-success/10 text-aura-success"
                      : classeBotao("secundario", "sm", "shrink-0")
                  }
                >
                  {p.confirmado_em ? "Avaliou ✓" : "Marcar como avaliou"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
