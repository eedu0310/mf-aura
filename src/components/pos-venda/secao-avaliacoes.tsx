"use client";

import { useState } from "react";
import { Check, ClipboardCheck, Link2, MessageCircle, MessageSquareQuote, Send, Star } from "lucide-react";
import type { PosVenda } from "@/lib/supabase/pos-venda";
import { Botao, CardHeader, EstadoVazio, Selo, StatCard } from "@/components/ui";
import { usePosVenda } from "./dados-pos-venda";
import { EsqueletoSecao, Nota } from "./pos-venda-pecas";
import { copiarLinkAvaliacao, linkWhatsAppAvaliacao } from "./avaliacao";
import { diaDoMomento, diasEntre, ehVenda, haQuantoTempo, plural } from "./regras";

/** Quando o pós-venda foi concluído (para saber há quanto tempo falta pedir). */
function diaDaConclusao(item: PosVenda) {
  return diaDoMomento(item.posVendaRealizadoEm) ?? diaDoMomento(item.instalacaoRealizadaEm) ?? item.dataAgendamento;
}

function BotaoCopiar({ item }: { item: PosVenda }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Botao
      tamanho="sm"
      icone={copiado ? Check : Link2}
      onClick={async () => {
        if (!(await copiarLinkAvaliacao(item.tokenAvaliacao, item.empresa))) return;
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
      aria-label={`Copiar link de avaliação de ${item.cliente}`}
    >
      {copiado ? "Copiado!" : "Copiar link"}
    </Botao>
  );
}

/**
 * Avaliações: taxa, nota média, como as notas se distribuem, o que os
 * clientes escreveram (as notas mais baixas primeiro, que pedem retorno) e
 * para quem ainda falta pedir — com o mesmo link e a mesma mensagem de
 * WhatsApp do modal. Cliente antigo não é venda: fica fora das contas.
 */
export function SecaoAvaliacoes() {
  const { itensDaLoja, carregando, hoje, mostrarLoja, abrir } = usePosVenda();

  if (carregando) return <EsqueletoSecao />;

  const vendas = itensDaLoja.filter(ehVenda);
  const avaliaram = vendas.filter((i) => i.avaliouLoja);
  const taxa = vendas.length > 0 ? Math.round((avaliaram.length / vendas.length) * 100) : null;
  const comNota = vendas.filter((i) => i.avaliouLoja && i.notaAvaliacao);
  const notaMedia =
    comNota.length > 0 ? comNota.reduce((s, i) => s + (i.notaAvaliacao ?? 0), 0) / comNota.length : null;

  const distribuicao = [5, 4, 3, 2, 1].map((n) => ({ nota: n, total: comNota.filter((i) => i.notaAvaliacao === n).length }));
  const maior = Math.max(1, ...distribuicao.map((d) => d.total));

  const comentarios = avaliaram
    .filter((i) => i.comentarioAvaliacao?.trim())
    .sort((a, b) => (a.notaAvaliacao ?? 6) - (b.notaAvaliacao ?? 6));
  const notasBaixas = comNota.filter((i) => (i.notaAvaliacao ?? 5) <= 3).length;

  const faltaPedir = vendas
    .filter((i) => i.status === "pos_venda_realizado" && !i.avaliouLoja)
    .sort((a, b) => (diaDaConclusao(a) ?? "9999").localeCompare(diaDaConclusao(b) ?? "9999"));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          rotulo="Taxa de avaliação"
          valor={taxa === null ? "—" : `${taxa}%`}
          tom={taxa !== null && taxa >= 50 ? "sucesso" : "neutro"}
          icone={ClipboardCheck}
          detalhe={`${avaliaram.length} de ${plural(vendas.length, "venda")}`}
        />
        <StatCard
          rotulo="Nota média"
          valor={notaMedia === null ? "—" : notaMedia.toFixed(1).replace(".", ",")}
          tom="ouro"
          icone={Star}
          detalhe={comNota.length > 0 ? plural(comNota.length, "nota") : "sem notas ainda"}
        />
        <StatCard
          rotulo="Falta pedir"
          valor={faltaPedir.length}
          tom={faltaPedir.length > 0 ? "marca" : "neutro"}
          icone={Send}
          detalhe="concluídas sem avaliação"
        />
        <StatCard
          rotulo="Notas até 3"
          valor={notasBaixas}
          tom={notasBaixas > 0 ? "atencao" : "neutro"}
          icone={MessageSquareQuote}
          detalhe={notasBaixas > 0 ? "vale ligar e entender" : "nenhuma nota baixa"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="aura-card p-4" aria-labelledby="pv-distribuicao">
          <CardHeader
            titulo={<span id="pv-distribuicao">Distribuição das notas</span>}
            descricao="Quantos clientes deram cada nota"
            icone={Star}
            corIcone="text-aura-gold-700"
          />
          {comNota.length === 0 ? (
            <p className="py-2 text-sm text-aura-graphite-soft">Nenhuma nota registrada ainda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {distribuicao.map((d) => (
                <li key={d.nota} className="grid grid-cols-[2.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-sm">
                  <span className="flex items-center gap-1 tabular-nums text-aura-graphite">
                    {d.nota}
                    <Star size={12} className="fill-aura-gold text-aura-gold" aria-hidden />
                    <span className="sr-only">estrelas</span>
                  </span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-aura-sunken" aria-hidden>
                    <span
                      className={`block h-full rounded-full ${d.nota <= 3 ? "bg-aura-warning" : "bg-aura-gold"}`}
                      style={{ width: `${(d.total / maior) * 100}%` }}
                    />
                  </span>
                  <span className="text-right tabular-nums text-aura-graphite-soft">{d.total}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="aura-card p-4" aria-labelledby="pv-comentarios">
          <CardHeader
            titulo={
              <span id="pv-comentarios">
                O que os clientes escreveram
                <span className="ml-1.5 font-normal tabular-nums text-aura-graphite-soft">{comentarios.length}</span>
              </span>
            }
            descricao="As notas mais baixas primeiro: são as que pedem retorno"
            icone={MessageSquareQuote}
            className="mb-2"
          />
          {comentarios.length === 0 ? (
            <p className="py-2 text-sm text-aura-graphite-soft">Nenhum comentário ainda.</p>
          ) : (
            <ul className="flex max-h-[24rem] flex-col divide-y divide-aura-mist overflow-y-auto">
              {comentarios.map((item) => (
                <li key={item.id} className="py-2.5">
                  <button type="button" onClick={() => abrir(item)} className="w-full text-left">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-aura-graphite hover:text-aura-petrol-600">
                        {item.cliente}
                      </span>
                      {item.notaAvaliacao ? <Nota valor={item.notaAvaliacao} /> : null}
                      {mostrarLoja && <Selo>{item.empresa}</Selo>}
                    </span>
                    <span className="mt-1 block text-sm text-aura-graphite-soft">“{item.comentarioAvaliacao}”</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="aura-card overflow-hidden" aria-labelledby="pv-falta-pedir">
        <div className="p-4 pb-0">
          <CardHeader
            titulo={
              <span id="pv-falta-pedir">
                Quem falta pedir
                <span className="ml-1.5 font-normal tabular-nums text-aura-graphite-soft">{faltaPedir.length}</span>
              </span>
            }
            descricao="Instalações concluídas sem avaliação, da mais antiga para a mais nova. Mande o link e, quando o cliente avaliar, registre no pós-venda."
            icone={Send}
            className="mb-2"
          />
        </div>
        {faltaPedir.length === 0 ? (
          <div className="p-4 pt-0">
            <EstadoVazio
              icone={Check}
              titulo="Ninguém esperando pedido de avaliação"
              descricao="Toda instalação concluída já tem avaliação registrada."
            />
          </div>
        ) : (
          <ul className="divide-y divide-aura-mist border-t border-aura-mist">
            {faltaPedir.map((item) => {
              const dias = diasEntre(diaDaConclusao(item), hoje);
              return (
                <li key={item.id} className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-aura-graphite">{item.cliente}</span>
                      {mostrarLoja && <Selo>{item.empresa}</Selo>}
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-aura-graphite-soft">
                      {item.produto && <span className="max-w-[14rem] truncate">{item.produto}</span>}
                      {dias !== null && <span>concluída {haQuantoTempo(dias)}</span>}
                      {!item.telefone && <span className="text-aura-gold-700">sem telefone salvo</span>}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <BotaoCopiar item={item} />
                    {/* O link usa o endereço do site (window), então só é montado no clique. */}
                    <Botao
                      tamanho="sm"
                      icone={MessageCircle}
                      className="text-aura-success"
                      onClick={() => window.open(linkWhatsAppAvaliacao(item), "_blank", "noopener")}
                      aria-label={`Pedir avaliação de ${item.cliente} pelo WhatsApp`}
                    >
                      WhatsApp
                    </Botao>
                    <Botao tamanho="sm" variante="fantasma" onClick={() => abrir(item)} aria-label={`Registrar avaliação de ${item.cliente}`}>
                      Registrar
                    </Botao>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
