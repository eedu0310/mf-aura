"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, MapPin, Video } from "lucide-react";

interface Resposta {
  loja: string;
  estadosPresenciais: string[];
  textoPresencial: string;
  textoRemoto: string;
  atualizadoEm: string | null;
  ufs: string[];
}

export function AtendimentoTab() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [estados, setEstados] = useState<string[]>([]);
  const [presencial, setPresencial] = useState("");
  const [remoto, setRemoto] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch("/api/gestor/atendimento", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro ?? "Não foi possível carregar.");
      setDados(j);
      setEstados(j.estadosPresenciais ?? []);
      setPresencial(j.textoPresencial ?? "");
      setRemoto(j.textoRemoto ?? "");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    setSalvo(false);
    try {
      const r = await fetch("/api/gestor/atendimento", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estadosPresenciais: estados,
          textoPresencial: presencial,
          textoRemoto: remoto,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.erro ?? "Não consegui salvar.");
      setSalvo(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      setSalvando(false);
    }
  }

  const alternar = (uf: string) =>
    setEstados((a) => (a.includes(uf) ? a.filter((x) => x !== uf) : [...a, uf]));

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-aura-mist bg-white p-5">
        <div className="flex items-start gap-3">
          <Video size={20} className="mt-0.5 shrink-0 text-aura-petrol-600" />
          <div>
            <h3 className="font-display text-lg font-semibold text-aura-graphite">
              Atendimento por distância
            </h3>
            <p className="mt-1 text-sm text-aura-graphite-soft">
              A AURA descobre de onde o cliente é pelo DDD do telefone. Para quem
              está longe, ela deixa de convidar para o showroom e passa a
              oferecer o que você escrever aqui. O texto entra na sugestão de
              resposta exatamente como está — nada fica escondido no sistema.
            </p>
          </div>
        </div>

        {carregando && (
          <p className="mt-4 flex items-center gap-2 text-sm text-aura-graphite-soft">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </p>
        )}
        {erro && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {erro}
          </p>
        )}
      </div>

      {dados && !carregando && (
        <>
          <div className="rounded-2xl border border-aura-mist bg-white p-5">
            <h4 className="flex items-center gap-2 font-medium text-aura-graphite">
              <MapPin className="h-4 w-4 text-aura-petrol-600" />
              Onde a loja atende pessoalmente
            </h4>
            <p className="mt-1 text-sm text-aura-graphite-soft">
              Cliente de fora destes estados não recebe convite para o showroom
              nem para visita.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {dados.ufs.map((uf) => {
                const marcado = estados.includes(uf);
                return (
                  <button
                    key={uf}
                    type="button"
                    onClick={() => alternar(uf)}
                    className={`rounded-full border px-3 py-1 text-sm transition ${
                      marcado
                        ? "border-aura-petrol-600 bg-aura-petrol-600 text-white"
                        : "border-aura-mist text-aura-graphite-soft hover:bg-aura-bg"
                    }`}
                  >
                    {uf}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-aura-mist bg-white p-5">
            <label className="block">
              <span className="font-medium text-aura-graphite">
                Para quem está perto
              </span>
              <p className="mb-2 mt-1 text-sm text-aura-graphite-soft">
                O que oferecer a quem pode vir até a loja.
              </p>
              <textarea
                value={presencial}
                onChange={(e) => setPresencial(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-aura-mist px-3 py-2 text-sm focus:border-aura-petrol-500 focus:outline-none"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-aura-mist bg-white p-5">
            <label className="block">
              <span className="font-medium text-aura-graphite">
                Para quem está longe
              </span>
              <p className="mb-2 mt-1 text-sm text-aura-graphite-soft">
                Videochamada pelo showroom, fotos e vídeos dos produtos, projeto
                a distância, instalador na região, envio. Escreva com as
                palavras da casa — é isso que o cliente vai ler.
              </p>
              <textarea
                value={remoto}
                onChange={(e) => setRemoto(e.target.value)}
                rows={10}
                className="w-full rounded-lg border border-aura-mist px-3 py-2 text-sm focus:border-aura-petrol-500 focus:outline-none"
              />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="flex items-center gap-2 rounded-full bg-aura-navy-950 px-5 py-2 text-sm font-medium text-aura-gold hover:bg-aura-navy-900 disabled:opacity-60"
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Salvar
            </button>
            {salvo && (
              <span className="text-sm text-emerald-700">
                Salvo. A AURA passa a usar isto nas próximas conversas.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
