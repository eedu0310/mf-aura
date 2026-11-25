"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Hourglass, Timer } from "lucide-react";
import type { PosVenda } from "@/lib/supabase/pos-venda";
import { Botao, EstadoVazio, Segmentado, Selo, StatCard } from "@/components/ui";
import { usePosVenda } from "./dados-pos-venda";
import { EsqueletoSecao, SeloStatus } from "./pos-venda-pecas";
import { diaDoMomento, diasEntre, formatarDia, haQuantoTempo, plural, temReclamacaoAberta } from "./regras";

type Aba = "abertas" | "resolvidas";

/** Idade da reclamação em dias, a partir do marco de abertura. Nula em registro antigo. */
function idade(item: PosVenda, hoje: string) {
  return diasEntre(diaDoMomento(item.reclamacaoAbertaEm), hoje);
}

/** Dias da abertura até a solução. Nulo se faltar um dos marcos. */
function tempoParaResolver(item: PosVenda) {
  const d = diasEntre(diaDoMomento(item.reclamacaoAbertaEm), diaDoMomento(item.reclamacaoResolvidaEm));
  return d !== null && d >= 0 ? d : null;
}

function foiResolvida(item: PosVenda) {
  return Boolean(item.reclamacao?.trim()) && item.reclamacaoResolvida;
}

/**
 * Reclamações: as abertas, da mais antiga para a mais nova (quanto mais velha,
 * mais urgente), e as resolvidas com quanto tempo levou. A solução continua
 * sendo registrada no modal do pós-venda ("Reclamação já resolvida").
 *
 * A idade só existe para reclamações escritas depois que o sistema passou a
 * carimbar a abertura; as mais antigas aparecem como "sem data de abertura".
 */
export function SecaoReclamacoes() {
  const { itensDaLoja, carregando, hoje, mostrarLoja, abrir } = usePosVenda();
  const [aba, setAba] = useState<Aba>("abertas");

  if (carregando) return <EsqueletoSecao />;

  const abertas = itensDaLoja
    .filter(temReclamacaoAberta)
    .sort((a, b) => (idade(b, hoje) ?? -1) - (idade(a, hoje) ?? -1));
  const resolvidas = itensDaLoja
    .filter(foiResolvida)
    .sort((a, b) => (b.reclamacaoResolvidaEm ?? "").localeCompare(a.reclamacaoResolvidaEm ?? ""));

  const tempos = resolvidas.map(tempoParaResolver).filter((d): d is number => d !== null);
  const tempoMedio = tempos.length > 0 ? Math.round(tempos.reduce((s, d) => s + d, 0) / tempos.length) : null;
  const idades = abertas.map((i) => idade(i, hoje)).filter((d): d is number => d !== null);
  const maisAntiga = idades.length > 0 ? Math.max(...idades) : null;

  const lista = aba === "abertas" ? abertas : resolvidas;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          rotulo="Abertas"
          valor={abertas.length}
          tom={abertas.length > 0 ? "perigo" : "neutro"}
          icone={AlertTriangle}
          detalhe={abertas.length > 0 ? "aguardando solução" : "nenhuma em aberto"}
        />
        <StatCard
          rotulo="Mais antiga aberta"
          valor={maisAntiga === null ? "—" : plural(maisAntiga, "dia")}
          tom={maisAntiga !== null && maisAntiga > 7 ? "atencao" : "neutro"}
          icone={Hourglass}
          detalhe={abertas.length > 0 && idades.length < abertas.length ? "algumas sem data de abertura" : "desde a abertura"}
        />
        <StatCard
          rotulo="Resolvidas"
          valor={resolvidas.length}
          tom="sucesso"
          icone={CheckCircle2}
          detalhe="no total"
        />
        <StatCard
          rotulo="Tempo para resolver"
          valor={tempoMedio === null ? "—" : plural(tempoMedio, "dia")}
          icone={Timer}
          detalhe={tempos.length > 0 ? `média de ${plural(tempos.length, "reclamação", "reclamações")}` : "sem datas registradas ainda"}
        />
      </div>

      <Segmentado<Aba>
        rotulo="Mostrar"
        valor={aba}
        aoMudar={setAba}
        className="self-start"
        opcoes={[
          { valor: "abertas", rotulo: "Abertas", contagem: abertas.length },
          { valor: "resolvidas", rotulo: "Resolvidas", contagem: resolvidas.length },
        ]}
      />

      {lista.length === 0 ? (
        <EstadoVazio
          icone={aba === "abertas" ? CheckCircle2 : AlertTriangle}
          titulo={aba === "abertas" ? "Nenhuma reclamação em aberto" : "Nenhuma reclamação resolvida ainda"}
          descricao={
            aba === "abertas"
              ? "Quando um cliente reclamar, registre no pós-venda dele (campo Reclamação): ela aparece aqui até ser resolvida."
              : "As reclamações marcadas como resolvidas no pós-venda aparecem aqui, com quanto tempo levou."
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.map((item) => {
            const dias = aba === "abertas" ? idade(item, hoje) : tempoParaResolver(item);
            return (
              <li
                key={item.id}
                className={`aura-card flex flex-col gap-3 p-4 sm:flex-row sm:items-start ${
                  aba === "abertas" && dias !== null && dias > 7 ? "border-aura-danger/40" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-sm font-medium text-aura-graphite">{item.cliente}</p>
                    <SeloStatus item={item} />
                    {mostrarLoja && <Selo>{item.empresa}</Selo>}
                  </div>
                  {item.produto && <p className="mt-0.5 truncate text-xs text-aura-graphite-soft">{item.produto}</p>}
                  <p className="mt-2 line-clamp-3 whitespace-pre-line rounded-lg bg-aura-sunken/60 px-3 py-2 text-sm text-aura-graphite">
                    {item.reclamacao}
                  </p>
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-aura-graphite-soft">
                    {aba === "abertas" ? (
                      dias === null ? (
                        <span>Sem data de abertura (registrada antes do controle de datas)</span>
                      ) : (
                        <span className={dias > 7 ? "font-medium text-aura-danger" : ""}>
                          Aberta {haQuantoTempo(dias)}
                          {item.reclamacaoAbertaEm ? ` · ${formatarDia(diaDoMomento(item.reclamacaoAbertaEm))}` : ""}
                        </span>
                      )
                    ) : (
                      <>
                        {item.reclamacaoResolvidaEm && (
                          <span>Resolvida em {formatarDia(diaDoMomento(item.reclamacaoResolvidaEm))}</span>
                        )}
                        {dias !== null && <span>levou {dias === 0 ? "menos de um dia" : plural(dias, "dia")}</span>}
                      </>
                    )}
                    {item.telefone && <span>{item.telefone}</span>}
                  </p>
                </div>
                <Botao
                  tamanho="sm"
                  variante={aba === "abertas" ? "secundario" : "fantasma"}
                  onClick={() => abrir(item)}
                  className="self-start"
                  aria-label={`${aba === "abertas" ? "Resolver" : "Abrir"}: ${item.cliente}`}
                >
                  {aba === "abertas" ? "Resolver" : "Abrir"}
                </Botao>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
