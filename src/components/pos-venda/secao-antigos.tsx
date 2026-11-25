"use client";

import { useMemo, useState } from "react";
import { Flame, Search, UserRound, Users } from "lucide-react";
import type { PosVenda } from "@/lib/supabase/pos-venda";
import { ROTULO_TIPO } from "@/lib/supabase/pos-venda-manutencao";
import { Botao, EstadoVazio, Segmentado, Selo, StatCard } from "@/components/ui";
import { usePosVenda } from "./dados-pos-venda";
import { EsqueletoSecao, SeloStatus, Sinais } from "./pos-venda-pecas";
import { BotaoWhatsAppLimpeza, ProgramarLimpeza } from "./pos-venda-manutencao-pecas";
import { dataDaManutencao, estaAberta, type ItemManutencao } from "./regras-manutencao";
import { diasEntre, formatarDia, haQuantoTempo } from "./regras";

type Filtro = "todos" | "sem_limpeza" | "com_limpeza";

function digitos(texto: string) {
  return texto.replace(/\D/g, "");
}

/**
 * Clientes antigos: quem comprou antes (ou fora) do CRM e o vendedor marcou
 * no WhatsApp. Não é venda — não entra em taxa, nota média nem funil — mas é
 * cliente com lareira em casa: precisa de acompanhamento e da limpeza anual.
 * Sem data de instalação, a primeira limpeza é programada à mão aqui; depois o
 * ciclo anual segue sozinho.
 */
export function SecaoAntigos() {
  const { itensDaLoja, carregando, hoje, mostrarLoja, abrir, manutencoes, recarregarManutencoes } = usePosVenda();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const antigos = useMemo(
    () =>
      itensDaLoja
        .filter((pv) => pv.origem === "cliente_antigo")
        .sort((a, b) => (b.dataVenda || "").localeCompare(a.dataVenda || "")),
    [itensDaLoja]
  );

  // A próxima manutenção em aberto de cada cliente (a de data mais próxima).
  const proxima = useMemo(() => {
    const mapa = new Map<string, ItemManutencao>();
    for (const m of manutencoes.itens) {
      if (!estaAberta(m)) continue;
      const atual = mapa.get(m.posVenda.id);
      if (!atual || dataDaManutencao(m) < dataDaManutencao(atual)) mapa.set(m.posVenda.id, m);
    }
    return mapa;
  }, [manutencoes.itens]);

  if (carregando) return <EsqueletoSecao />;

  const termo = busca.trim().toLowerCase();
  const termoDigitos = digitos(termo);
  const passaBusca = (pv: PosVenda) =>
    !termo ||
    pv.cliente.toLowerCase().includes(termo) ||
    pv.produto.toLowerCase().includes(termo) ||
    (termoDigitos.length >= 4 && digitos(pv.telefone ?? "").includes(termoDigitos));
  const passaFiltro = (pv: PosVenda) =>
    filtro === "todos" || (filtro === "com_limpeza" ? proxima.has(pv.id) : !proxima.has(pv.id));
  const visiveis = antigos.filter((pv) => passaBusca(pv) && passaFiltro(pv));

  const comLimpeza = antigos.filter((pv) => proxima.has(pv.id)).length;
  const emAcompanhamento = antigos.filter((pv) => pv.status !== "cliente_antigo").length;
  const semTelefone = antigos.filter((pv) => !pv.telefone).length;

  if (antigos.length === 0) {
    return (
      <EstadoVazio
        icone={UserRound}
        titulo="Nenhum cliente antigo marcado"
        descricao="Quando um vendedor marca no WhatsApp que a pessoa já é cliente (comprou antes do CRM), ela aparece aqui para acompanhar e programar a limpeza da chaminé."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard rotulo="Clientes antigos" valor={antigos.length} tom="ouro" icone={Users} detalhe="marcados no WhatsApp" />
        <StatCard
          rotulo="Com limpeza programada"
          valor={comLimpeza}
          tom={comLimpeza > 0 ? "sucesso" : "neutro"}
          icone={Flame}
          detalhe={`${antigos.length - comLimpeza} ainda sem`}
        />
        <StatCard
          rotulo="Em acompanhamento"
          valor={emAcompanhamento}
          tom="marca"
          detalhe="já saíram de “Cliente antigo”"
        />
        <StatCard
          rotulo="Sem telefone"
          valor={semTelefone}
          tom={semTelefone > 0 ? "atencao" : "neutro"}
          detalhe="não dá para chamar no WhatsApp"
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative lg:w-72">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-aura-graphite-soft"
            aria-hidden
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente, produto ou telefone"
            aria-label="Buscar nos clientes antigos"
            className="aura-input pl-9"
          />
        </div>
        <Segmentado<Filtro>
          rotulo="Limpeza"
          valor={filtro}
          aoMudar={setFiltro}
          className="self-start"
          opcoes={[
            { valor: "todos", rotulo: "Todos", contagem: antigos.length },
            { valor: "sem_limpeza", rotulo: "Sem limpeza", contagem: antigos.length - comLimpeza },
            { valor: "com_limpeza", rotulo: "Com limpeza", contagem: comLimpeza },
          ]}
        />
      </div>

      {visiveis.length === 0 ? (
        <EstadoVazio icone={Search} titulo="Ninguém encontrado" descricao="Tente outro nome ou outro filtro." />
      ) : (
        <ul className="aura-card divide-y divide-aura-mist">
          {visiveis.map((pv) => {
            const m = proxima.get(pv.id);
            const diaM = m ? dataDaManutencao(m) : null;
            return (
              <li key={pv.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-aura-graphite">{pv.cliente}</span>
                    <SeloStatus item={pv} />
                    {mostrarLoja && <Selo>{pv.empresa}</Selo>}
                    <Sinais item={pv} hoje={hoje} />
                  </p>
                  <p className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-aura-graphite-soft">
                    {pv.produto && pv.produto !== "Cliente antigo" && <span>{pv.produto}</span>}
                    {pv.telefone ? <span className="tabular-nums">{pv.telefone}</span> : <span>sem telefone</span>}
                    <span>marcado {haQuantoTempo(diasEntre(pv.dataVenda, hoje))}</span>
                  </p>
                  <p className="mt-1 text-xs">
                    {m && diaM ? (
                      <span className={diaM < hoje ? "font-medium text-aura-danger" : "text-aura-graphite"}>
                        {ROTULO_TIPO[m.tipo]} {m.status === "agendada" ? "agendada" : "prevista"} para{" "}
                        <span className="tabular-nums">{formatarDia(diaM)}</span>
                        {diaM < hoje ? " (vencida)" : ""}
                      </span>
                    ) : (
                      <span className="text-aura-gold-700">Sem limpeza programada</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!m && (
                    <ProgramarLimpeza
                      posVenda={pv}
                      hoje={hoje}
                      disponivel={manutencoes.disponivel}
                      aoMudou={recarregarManutencoes}
                    />
                  )}
                  <BotaoWhatsAppLimpeza posVenda={pv} />
                  <Botao tamanho="sm" variante="fantasma" onClick={() => abrir(pv)} aria-label={`Abrir ${pv.cliente}`}>
                    Abrir
                  </Botao>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
