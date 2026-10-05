"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, MapPin, Send, Video } from "lucide-react";

interface Resposta {
  loja: string;
  estadosPresenciais: string[];
  textoPresencial: string;
  textoRemoto: string;
  envioAutomatico: boolean;
  textoAutomatico: string;
  horaInicio: number | null;
  horaFim: number | null;
  atualizadoEm: string | null;
  ufs: string[];
}

/** Como a mensagem vai chegar no celular do cliente, com os campos trocados. */
function previa(modelo: string, loja: string): string {
  return modelo
    .replace(/\{nome\}/g, " Emily")
    .replace(/\{estado\}/g, "de São Paulo")
    .replace(/\{uf\}/g, "SP")
    .replace(/\{loja\}/g, loja || "sua loja")
    .trim();
}

export function AtendimentoTab() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [estados, setEstados] = useState<string[]>([]);
  const [presencial, setPresencial] = useState("");
  const [remoto, setRemoto] = useState("");
  const [automatico, setAutomatico] = useState(false);
  const [textoAuto, setTextoAuto] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [verPrevia, setVerPrevia] = useState(true);
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
      setAutomatico(j.envioAutomatico === true);
      setTextoAuto(j.textoAutomatico ?? "");
      setInicio(j.horaInicio === null || j.horaInicio === undefined ? "" : String(j.horaInicio));
      setFim(j.horaFim === null || j.horaFim === undefined ? "" : String(j.horaFim));
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
          envioAutomatico: automatico,
          textoAutomatico: textoAuto,
          horaInicio: inicio === "" ? null : Number(inicio),
          horaFim: fim === "" ? null : Number(fim),
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

          {/* ---------------- envio automático ---------------- */}
          <div
            className={`rounded-2xl border p-5 transition ${
              automatico ? "border-emerald-300 bg-emerald-50/40" : "border-aura-mist bg-white"
            }`}
          >
            <div className="flex items-start gap-3">
              <Send size={18} className="mt-0.5 shrink-0 text-aura-petrol-600" />
              <div className="flex-1">
                <h4 className="font-medium text-aura-graphite">
                  Responder sozinha quem é de fora
                </h4>
                <p className="mt-1 text-sm text-aura-graphite-soft">
                  Lead de outro estado recebe esta mensagem na hora, sem esperar o
                  vendedor abrir a conversa. Quem escreve às 22h é respondido às 22h.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={automatico}
                onClick={() => setAutomatico((v) => !v)}
                className={`mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
                  automatico ? "bg-emerald-600" : "bg-aura-mist"
                }`}
              >
                <span
                  className={`block h-5 w-5 rounded-full bg-white shadow transition ${
                    automatico ? "translate-x-[22px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {/* As travas ficam escritas na tela: o gestor liga sabendo o que
                a AURA faz e o que ela nunca faz. */}
            <ul className="mt-4 space-y-1 text-xs text-aura-graphite-soft">
              <li>• Só no <strong>primeiro contato</strong>. Se o vendedor já falou com a pessoa alguma vez, a AURA não entra.</li>
              <li>• <strong>Uma vez por pessoa</strong>, nunca repete.</li>
              <li>• Só para quem a AURA reconheceu como <strong>cliente de verdade</strong>: instalador, colega e fornecedor não recebem.</li>
              <li>• Só para DDD <strong>fora</strong> dos estados marcados acima. DDD que ela não reconhece não recebe nada.</li>
              <li>• Sai pelo WhatsApp do vendedor dono da conversa, e ele é avisado na hora.</li>
            </ul>

            <div className="mt-4">
              <label className="block">
                <span className="text-sm font-medium text-aura-graphite">
                  A mensagem que o cliente recebe
                </span>
                <p className="mb-2 mt-1 text-xs text-aura-graphite-soft">
                  Escreva como o vendedor falaria — ela sai no nome dele. Pode usar{" "}
                  <code className="rounded bg-aura-bg px-1">{"{nome}"}</code> (primeiro nome do contato),{" "}
                  <code className="rounded bg-aura-bg px-1">{"{estado}"}</code> (já vem com a preposição: “do Paraná”, “de São Paulo”),{" "}
                  <code className="rounded bg-aura-bg px-1">{"{uf}"}</code> e{" "}
                  <code className="rounded bg-aura-bg px-1">{"{loja}"}</code>.
                </p>
                <textarea
                  value={textoAuto}
                  onChange={(e) => setTextoAuto(e.target.value)}
                  rows={12}
                  className="w-full rounded-lg border border-aura-mist px-3 py-2 font-mono text-[13px] focus:border-aura-petrol-500 focus:outline-none"
                />
              </label>

              <button
                type="button"
                onClick={() => setVerPrevia((v) => !v)}
                className="mt-2 text-xs font-medium text-aura-petrol-700 underline"
              >
                {verPrevia ? "Esconder a prévia" : "Ver como chega no celular"}
              </button>

              {verPrevia && textoAuto.trim() && (
                <div className="mt-2 rounded-xl bg-[#e5ddd5] p-3">
                  <div className="max-w-md whitespace-pre-wrap rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[13px] leading-snug text-aura-graphite shadow-sm">
                    {previa(textoAuto, dados.loja)}
                  </div>
                  <p className="mt-2 text-[11px] text-aura-graphite-soft">
                    Exemplo com uma contato chamada Emily, de São Paulo.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4">
              <span className="text-sm font-medium text-aura-graphite">Horário</span>
              <p className="mb-2 mt-1 text-xs text-aura-graphite-soft">
                Em branco responde a qualquer hora, inclusive de madrugada — e
                para lead de internet isso costuma ser o que faz diferença. Se
                preferir limitar, preencha as duas.
              </p>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-aura-graphite-soft">das</span>
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  placeholder="--"
                  className="w-16 rounded-lg border border-aura-mist px-2 py-1.5 text-center"
                />
                <span className="text-aura-graphite-soft">h às</span>
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                  placeholder="--"
                  className="w-16 rounded-lg border border-aura-mist px-2 py-1.5 text-center"
                />
                <span className="text-aura-graphite-soft">h</span>
                {(inicio !== "" || fim !== "") && (
                  <button
                    type="button"
                    onClick={() => {
                      setInicio("");
                      setFim("");
                    }}
                    className="ml-2 text-xs text-aura-petrol-700 underline"
                  >
                    qualquer hora
                  </button>
                )}
              </div>
            </div>
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
                {automatico
                  ? "Salvo. A AURA já responde sozinha o próximo lead de fora do estado."
                  : "Salvo. A AURA passa a usar isto nas próximas conversas."}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
