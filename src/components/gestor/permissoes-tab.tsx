"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, ShieldCheck, ShieldQuestion, UserCog } from "lucide-react";
import { Alerta, Card, CardHeader, Selo, classeBotao } from "@/components/ui";

interface Pessoa {
  id: string;
  nome: string;
  cargo: string;
  empresa: string;
  ativo: boolean;
  gestor_mestre: boolean;
  gestor_aprovado: boolean;
  permissoes: Record<string, boolean>;
}

interface Permissao {
  chave: string;
  rotulo: string;
  ajuda: string;
  padrao: boolean;
}

/** Onde o gestor mestre aprova gestores e ajusta o que cada pessoa pode fazer. */
export function PermissoesTab() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [permissoes, setPermissoes] = useState<Permissao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const [salvo, setSalvo] = useState("");

  const carregar = useCallback(async () => {
    try {
      const res = await fetch("/api/gestor/permissoes", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro ?? "Não consegui carregar.");
      setPessoas(json.pessoas ?? []);
      setPermissoes(json.permissoes ?? []);
      setErro("");
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Não consegui carregar.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function ajustar(id: string, patch: Record<string, unknown>) {
    const res = await fetch("/api/gestor/permissoes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro(json.erro ?? "Não consegui salvar.");
      return;
    }
    setErro("");
    setSalvo(id);
    window.setTimeout(() => setSalvo(""), 1600);
    await carregar();
  }

  if (carregando) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-aura-petrol-500" />
      </div>
    );
  }

  if (erro && !pessoas.length) {
    return <Alerta tom="perigo" titulo={erro} />;
  }

  const pendentes = pessoas.filter((p) => p.cargo === "Gestor" && !p.gestor_aprovado);
  const valorDe = (p: Pessoa, chave: string) =>
    p.permissoes?.[chave] ?? permissoes.find((x) => x.chave === chave)?.padrao ?? false;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-aura-graphite-soft">
        Antes, qualquer pessoa que se cadastrasse escolhendo &quot;Gestor&quot; entrava com acesso a
        tudo — faturamento do grupo, carteira de todos, custo da IA — sem passar por ninguém.
        Agora um gestor novo fica pendente até um mestre aprovar.
      </p>

      {pendentes.length > 0 && (
        <Card>
          <CardHeader
            icone={ShieldQuestion}
            corIcone="text-aura-warning"
            titulo={
              pendentes.length === 1
                ? "1 gestor esperando aprovação"
                : `${pendentes.length} gestores esperando aprovação`
            }
          />
          <ul className="space-y-2">
            {pendentes.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-aura-mist bg-aura-sunken/50 px-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-aura-graphite">
                    {p.nome}
                  </span>
                  <span className="text-xs text-aura-graphite-soft">{p.empresa}</span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => void ajustar(p.id, { gestorAprovado: true })}
                    className={classeBotao("primario", "sm")}
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => void ajustar(p.id, { ativo: false })}
                    className={classeBotao("perigo-suave", "sm")}
                  >
                    Recusar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader
          icone={UserCog}
          titulo="Quem é quem"
          descricao="Toque numa pessoa para ajustar o que ela pode fazer. O que não for mexido segue o padrão do cargo."
          className="mb-2"
        />

        <ul className="divide-y divide-aura-mist">
          {pessoas.map((p) => (
            <li key={p.id} className={p.ativo ? "" : "opacity-50"}>
              <button
                type="button"
                onClick={() => setAberta(aberta === p.id ? null : p.id)}
                className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-aura-sunken/60"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-aura-graphite">
                      {p.nome}
                    </span>
                    {p.gestor_mestre && (
                      <Selo tom="ouro" className="inline-flex shrink-0 items-center gap-1">
                        <ShieldCheck size={10} /> mestre
                      </Selo>
                    )}
                    {p.cargo === "Gestor" && !p.gestor_aprovado && (
                      <Selo tom="atencao" className="shrink-0">
                        pendente
                      </Selo>
                    )}
                    {!p.ativo && (
                      <Selo tom="neutro" className="shrink-0">
                        desativado
                      </Selo>
                    )}
                  </span>
                  <span className="text-xs text-aura-graphite-soft">
                    {p.cargo} · {p.empresa}
                  </span>
                </span>
                {salvo === p.id && (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-aura-success">
                    <Check size={12} /> salvo
                  </span>
                )}
              </button>

              {aberta === p.id && (
                <div className="mb-3 space-y-3 rounded-lg border border-aura-mist bg-aura-sunken p-4">
                  {permissoes.map((perm) => (
                    <label key={perm.chave} className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={valorDe(p, perm.chave)}
                        onChange={(e) =>
                          void ajustar(p.id, {
                            permissoes: {
                              ...(p.permissoes ?? {}),
                              [perm.chave]: e.target.checked,
                            },
                          })
                        }
                        className="mt-0.5 h-4 w-4 accent-aura-petrol-600"
                      />
                      <span className="text-sm text-aura-graphite">
                        {perm.rotulo}
                        <span className="mt-0.5 block text-xs text-aura-graphite-soft">
                          {perm.ajuda}
                        </span>
                      </span>
                    </label>
                  ))}

                  <div className="flex flex-wrap gap-2 border-t border-aura-mist pt-3">
                    <button
                      type="button"
                      onClick={() => void ajustar(p.id, { gestorMestre: !p.gestor_mestre })}
                      className={classeBotao("secundario", "sm")}
                    >
                      {p.gestor_mestre ? "Tirar de gestor mestre" : "Tornar gestor mestre"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void ajustar(p.id, { ativo: !p.ativo })}
                      className={classeBotao("perigo-suave", "sm")}
                    >
                      {p.ativo ? "Desativar acesso" : "Reativar acesso"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {erro && <Alerta tom="perigo" titulo={erro} />}
    </div>
  );
}
