"use client";

import { useEffect, useState } from "react";
import { Loader2, UserPlus, Users, X } from "lucide-react";
import type { Relacionamento } from "@/lib/types";

interface Colega {
  id: string;
  nome: string;
  cargo: string;
}

/**
 * Passar o atendimento de um cliente para um colega e seguir os dois juntos.
 *
 * Nasceu de um caso concreto: a vendedora interna atendeu, repassou para a
 * colega, as duas conversaram com a cliente — e na hora de fechar não havia
 * como registrar que a venda era das duas. O sistema só sabia de um dono por
 * cliente, então a colega ficava invisível: não via a conversa e não aparecia
 * na venda.
 *
 * O QUE ESTE PAINEL DEIXA CLARO, de propósito:
 *
 *  - quem continua responsável (o dono não muda — a carteira tem um dono só)
 *  - quanto da venda vai para cada um, em número, antes de confirmar
 *  - que a dupla alcança só os negócios AINDA EM ABERTO
 *
 * A última parte é a que evita o mal-entendido caro: ninguém entra numa venda
 * que já aconteceu para levar metade dela.
 */
export function DuplaPanel({
  relacionamento: r,
  nomesPorId,
  souODono,
  onAtualizado,
}: {
  relacionamento: Relacionamento;
  /** Mapa id → nome, quando quem olha é gestor e vê a loja toda. */
  nomesPorId?: Record<string, string>;
  souODono: boolean;
  onAtualizado?: () => void;
}) {
  const [colegas, setColegas] = useState<Colega[] | null>(null);
  const [abrindo, setAbrindo] = useState(false);
  const [escolhido, setEscolhido] = useState("");
  const [percentual, setPercentual] = useState(50);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  const temDupla = !!r.parceiroId;
  const fatiaDoParceiro = r.percentualParceiro ?? 50;

  useEffect(() => {
    if (!abrindo || colegas) return;
    fetch("/api/atendimento-dupla")
      .then((res) => res.json())
      .then((d) => setColegas(d.colegas ?? []))
      .catch(() => setErro("Não consegui carregar a equipe da loja."));
  }, [abrindo, colegas]);

  async function salvar(parceiroId: string | null) {
    setSalvando(true);
    setErro(null);
    setRecado(null);

    const res = await fetch("/api/atendimento-dupla", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relacionamentoId: r.id,
        parceiroId,
        percentual,
        motivo: motivo.trim() || null,
      }),
    });
    const corpo = await res.json().catch(() => ({}));
    setSalvando(false);

    if (!res.ok) {
      setErro(corpo.erro ?? "Não consegui salvar.");
      return;
    }

    if (corpo.dupla) {
      const n = corpo.dupla.negocios ?? 0;
      const c = corpo.dupla.conversas ?? 0;
      setRecado(
        `${corpo.dupla.parceiroNome} entrou no atendimento` +
          (n || c
            ? ` — ${n} negócio(s) em aberto e ${c} conversa(s) foram abertos para ele.`
            : "."),
      );
    } else {
      setRecado("Atendimento em dupla encerrado.");
    }
    setAbrindo(false);
    setMotivo("");
    onAtualizado?.();
  }

  const nomeDoParceiro =
    (r.parceiroId && nomesPorId?.[r.parceiroId]) ||
    colegas?.find((c) => c.id === r.parceiroId)?.nome ||
    "um colega";

  return (
    <div className="rounded-xl border border-aura-mist bg-aura-bg/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Users size={18} className="mt-0.5 shrink-0 text-aura-petrol-600" />
          <div>
            <p className="text-sm font-medium text-aura-graphite">
              Atendimento em dupla
            </p>
            {temDupla ? (
              <p className="mt-0.5 text-sm leading-relaxed text-aura-graphite-soft">
                Atendido junto com <strong className="text-aura-graphite">{nomeDoParceiro}</strong>.
                Quando a venda fechar, {100 - fatiaDoParceiro}% fica com quem é dono do
                cliente e {fatiaDoParceiro}% vai para {nomeDoParceiro}.
              </p>
            ) : (
              <p className="mt-0.5 text-sm leading-relaxed text-aura-graphite-soft">
                Passe o atendimento para um colega da loja e trabalhem juntos. Os
                dois veem a conversa, e o valor da venda é dividido.
              </p>
            )}
          </div>
        </div>

        {!abrindo && (
          <button
            type="button"
            onClick={() => {
              setAbrindo(true);
              setEscolhido(r.parceiroId ?? "");
              setPercentual(fatiaDoParceiro);
              setRecado(null);
            }}
            disabled={!souODono}
            title={
              souODono
                ? undefined
                : "Só quem atende o cliente (ou o gestor da loja) pode passar o atendimento."
            }
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm font-medium text-aura-petrol-600 transition hover:bg-white disabled:opacity-50"
          >
            <UserPlus size={15} />
            {temDupla ? "Mudar" : "Chamar colega"}
          </button>
        )}
      </div>

      {recado && (
        <p className="mt-3 rounded-lg bg-aura-success/10 px-3 py-2 text-sm text-aura-success">
          {recado}
        </p>
      )}

      {abrindo && (
        <div className="mt-4 flex flex-col gap-3 border-t border-aura-mist pt-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-aura-graphite">
              Quem entra no atendimento
            </label>
            {colegas === null ? (
              <p className="flex items-center gap-2 text-sm text-aura-graphite-soft">
                <Loader2 size={14} className="animate-spin" />
                Carregando a equipe...
              </p>
            ) : colegas.length === 0 ? (
              <p className="text-sm text-aura-graphite-soft">
                Não há outro colega ativo nesta loja para chamar.
              </p>
            ) : (
              <select
                value={escolhido}
                onChange={(e) => setEscolhido(e.target.value)}
                className="rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500"
              >
                <option value="">Escolha um colega</option>
                {colegas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} — {c.cargo}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-aura-graphite">
              Divisão da venda
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={percentual}
                onChange={(e) => setPercentual(Number(e.target.value))}
                className="flex-1 accent-aura-petrol-500"
              />
              <span className="w-14 shrink-0 text-right text-sm font-medium text-aura-graphite">
                {percentual}%
              </span>
            </div>
            <p className="text-xs leading-relaxed text-aura-graphite-soft">
              {100 - percentual}% para quem é dono do cliente, {percentual}% para
              quem entra. Meio a meio é o padrão.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-aura-graphite">
              Por quê? <span className="font-normal">(aparece no aviso do colega)</span>
            </label>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: cliente vai até a loja e quem atende presencial continua"
              className="rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm text-aura-graphite outline-none focus:border-aura-petrol-500"
            />
          </div>

          <p className="rounded-lg bg-white px-3 py-2 text-xs leading-relaxed text-aura-graphite-soft">
            O cliente continua na carteira de quem já era dono. A dupla vale para
            a conversa e para os negócios <strong>ainda em aberto</strong> — venda
            já fechada não muda de divisão.
          </p>

          {erro && (
            <p className="rounded-lg bg-aura-danger/10 px-3 py-2 text-sm text-aura-danger">
              {erro}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={salvando || !escolhido}
              onClick={() => salvar(escolhido)}
              className="inline-flex items-center gap-2 rounded-lg bg-aura-petrol-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-aura-petrol-600 disabled:opacity-50"
            >
              {salvando && <Loader2 size={14} className="animate-spin" />}
              Confirmar dupla
            </button>
            {temDupla && (
              <button
                type="button"
                disabled={salvando}
                onClick={() => salvar(null)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-aura-mist bg-white px-3 py-2 text-sm font-medium text-aura-danger transition hover:bg-red-50 disabled:opacity-50"
              >
                <X size={14} />
                Encerrar dupla
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setAbrindo(false);
                setErro(null);
              }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-aura-graphite-soft transition hover:text-aura-graphite"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
