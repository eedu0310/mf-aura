"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RotateCcw, Search, Trash2 } from "lucide-react";
import { Alerta, EstadoVazio, Selo, classeBotao } from "@/components/ui";

interface Item {
  id: string;
  leadId: string;
  loja: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  status: string | null;
  mensagem: string | null;
  chegouEm: string | null;
  vendedor: string | null;
  excluidoEm: string;
  excluidoPor: string | null;
  como: string;
  restauradoEm: string | null;
  restauradoPor: string | null;
}

const quando = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const STATUS: Record<string, string> = {
  novo: "Novo",
  repassado_vendedor: "Repassado ao vendedor",
  respondido: "Respondido",
  perdido: "Perdido",
  frio: "Frio",
};

/**
 * Painel do Gestor › Relatórios › Leads excluídos.
 * O que a equipe excluiu da tela Leads (ou do Site): quem excluiu, quando,
 * de onde o lead veio — e o botão de restaurar, para engano.
 */
export function LeadsExcluidosTab() {
  const [itens, setItens] = useState<Item[]>([]);
  const [lojas, setLojas] = useState<string[]>([]);
  const [loja, setLoja] = useState("");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [restaurando, setRestaurando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/gestor/leads-excluidos${loja ? `?loja=${encodeURIComponent(loja)}` : ""}`, { cache: "no-store" });
      const d = (await r.json().catch(() => ({}))) as { itens?: Item[]; lojas?: string[]; erro?: string };
      if (!r.ok) throw new Error(d.erro ?? "Não consegui ler a lixeira.");
      setItens(d.itens ?? []);
      setLojas(d.lojas ?? []);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui ler a lixeira.");
    } finally {
      setCarregando(false);
    }
  }, [loja]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return itens;
    return itens.filter((i) =>
      [i.nome, i.telefone, i.email, i.origem, i.vendedor, i.excluidoPor].some((v) => (v ?? "").toLowerCase().includes(t)),
    );
  }, [itens, busca]);

  const porOrigem = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of itens) if (!i.restauradoEm) m.set(i.origem ?? "Sem origem", (m.get(i.origem ?? "Sem origem") ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [itens]);

  async function restaurar(item: Item) {
    if (!window.confirm(`Restaurar o lead ${item.nome || item.telefone}? Ele volta para a lista de leads como estava.`)) return;
    setRestaurando(item.id);
    try {
      const r = await fetch("/api/gestor/leads-excluidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const d = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) throw new Error(d.erro ?? "Não consegui restaurar.");
      await carregar();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Não consegui restaurar.");
    } finally {
      setRestaurando(null);
    }
  }

  const naLixeira = itens.filter((i) => !i.restauradoEm).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {lojas.length > 1 && (
          <select value={loja} onChange={(e) => setLoja(e.target.value)} className="aura-input !h-9 w-auto" aria-label="Filtrar por loja">
            <option value="">Todas as lojas</option>
            {lojas.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}
        <label className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-aura-graphite-soft" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nome, telefone, origem…"
            className="aura-input !h-9 w-64 !pl-8"
            aria-label="Buscar na lixeira"
          />
        </label>
        <span className="text-xs text-aura-graphite-soft">
          {naLixeira} na lixeira{itens.length !== naLixeira ? ` · ${itens.length - naLixeira} restaurado(s)` : ""}
        </span>
      </div>

      {porOrigem.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {porOrigem.map(([o, n]) => (
            <span key={o} className="rounded-md bg-aura-sunken px-2 py-0.5 text-xs text-aura-graphite-soft">
              {o}: <strong className="text-aura-graphite">{n}</strong>
            </span>
          ))}
        </div>
      )}

      {erro && <Alerta tom="perigo" titulo={erro} />}
      {carregando ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-aura-graphite-soft" />
        </div>
      ) : visiveis.length === 0 ? (
        <EstadoVazio icone={Trash2} titulo="Nenhum lead excluído" descricao="Quando alguém excluir um lead, ele aparece aqui." className="py-10" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-aura-mist">
          <table className="aura-tabela min-w-[900px]">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Origem</th>
                <th>Situação ao excluir</th>
                <th>Vendedor</th>
                <th>Excluído</th>
                <th className="!text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((i) => (
                <tr key={i.id} className={i.restauradoEm ? "opacity-60" : ""}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-aura-graphite">{i.nome || "Sem nome"}</p>
                    <p className="text-xs text-aura-graphite-soft">
                      {[i.telefone, i.email].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {lojas.length > 1 && <p className="text-[11px] text-aura-graphite-soft">{i.loja}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-aura-graphite">
                    {i.origem || "—"}
                    <p className="text-[11px] text-aura-graphite-soft">chegou {quando(i.chegouEm)}</p>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-aura-graphite-soft">{STATUS[i.status ?? ""] ?? i.status ?? "—"}</td>
                  <td className="px-3 py-2.5 text-sm text-aura-graphite-soft">{i.vendedor ?? "Sem vendedor"}</td>
                  <td className="px-3 py-2.5 text-sm">
                    <p className="text-aura-graphite">{quando(i.excluidoEm)}</p>
                    <p className="text-xs text-aura-graphite-soft">
                      {i.excluidoPor ? `por ${i.excluidoPor}` : i.como === "sistema" ? "pelo sistema" : "autor não registrado"}
                      {i.como === "backup" && " · recuperado do backup"}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {i.restauradoEm ? (
                      <Selo tom="sucesso">Restaurado{i.restauradoPor ? ` por ${i.restauradoPor}` : ""}</Selo>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void restaurar(i)}
                        disabled={restaurando === i.id}
                        className={classeBotao("secundario", "sm")}
                      >
                        {restaurando === i.id ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Restaurar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-aura-graphite-soft">
        Excluir um lead continua valendo para a equipe: ele sai da lista. A cópia fica aqui só para os gestores consultarem
        ou restaurarem em caso de engano.
      </p>
    </div>
  );
}
