"use client";

import { PageContainer, PageHeader, Segmentado } from "@/components/ui";
import { usePosVenda } from "@/components/pos-venda/dados-pos-venda";
import { dadosDaSecao, useSecaoPosVenda } from "@/components/pos-venda/secoes";
import { SecaoVisao } from "@/components/pos-venda/secao-visao";
import { SecaoInstalacoes } from "@/components/pos-venda/secao-instalacoes";
import { SecaoReclamacoes } from "@/components/pos-venda/secao-reclamacoes";
import { SecaoAvaliacoes } from "@/components/pos-venda/secao-avaliacoes";
import { SecaoManutencoes } from "@/components/pos-venda/secao-manutencoes";
import { SecaoAntigos } from "@/components/pos-venda/secao-antigos";

/**
 * A página do Pós-venda: cabeçalho da seção aberta, o filtro de loja (quem vê
 * mais de uma) e a seção. Os dados vêm do layout (ProvedorPosVenda), então
 * trocar de seção é instantâneo.
 */
export default function PosVendaPage() {
  const secao = useSecaoPosVenda();
  const dados = dadosDaSecao(secao);
  const { multiLoja, lojas, empresaFiltro, setEmpresaFiltro } = usePosVenda();

  return (
    <PageContainer className="flex flex-col gap-5">
      <PageHeader titulo={dados.rotulo} icone={dados.icone} descricao={dados.descricao} rotulo="Pós-venda" className="mb-0" />

      {multiLoja && (
        <Segmentado
          rotulo="Loja"
          valor={empresaFiltro}
          aoMudar={setEmpresaFiltro}
          className="self-start"
          opcoes={[
            { valor: "todas", rotulo: "Todas as lojas" },
            ...lojas.map((loja) => ({ valor: loja, rotulo: loja })),
          ]}
        />
      )}

      {secao === "instalacoes" ? (
        <SecaoInstalacoes />
      ) : secao === "reclamacoes" ? (
        <SecaoReclamacoes />
      ) : secao === "avaliacoes" ? (
        <SecaoAvaliacoes />
      ) : secao === "manutencoes" ? (
        <SecaoManutencoes />
      ) : secao === "antigos" ? (
        <SecaoAntigos />
      ) : (
        <SecaoVisao />
      )}
    </PageContainer>
  );
}
