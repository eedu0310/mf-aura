import type { Venda } from "@/lib/types";
import ExcelJS from "exceljs";

interface FiltroRelatorio {
  dataInicio: string;
  dataFim: string;
  vendedor?: string;
  empresa?: string;
}

interface DadosVendedor {
  nome: string;
  vendas: number;
  vendidoCompartilhado: number;
  prospecccoes: number;
  atividades: number;
}

interface DadosRelatorio {
  filtro?: FiltroRelatorio;
  dados: {
    valorTotalVendido: number;
    valorTotalPipeline: number;
    taxaConversao: number;
    vendasFiltradas?: Venda[];
    dadosPorVendedor?: { [key: string]: DadosVendedor };
  };
}

interface DadosCSV {
  vendasFiltradas: Venda[];
  dadosPorVendedor?: { [key: string]: DadosVendedor };
}

interface DadosExcel {
  filtro?: FiltroRelatorio;
  dados: {
    valorTotalVendido: number;
    valorTotalPipeline: number;
    taxaConversao: number;
    vendasFiltradas?: Venda[];
    dadosPorVendedor?: { [key: string]: DadosVendedor };
  };
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(valor);
}

function formatarData(data: string): string {
  return new Date(data).toLocaleDateString("pt-BR");
}

export async function exportarPDF(dados: DadosRelatorio) {
  try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    doc.setFont("helvetica");
    doc.setFontSize(16);
    doc.text("Relatório Comercial", 10, 15);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(
      `Período: ${dados.filtro?.dataInicio || "N/A"} a ${dados.filtro?.dataFim || "N/A"}`,
      10,
      25
    );
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 10, 32);

    // Métricas principais
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Resumo Executivo", 10, 45);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Faturamento Total: ${formatarMoeda(dados.dados.valorTotalVendido)}`, 10, 55);
    doc.text(`Pipeline Total: ${formatarMoeda(dados.dados.valorTotalPipeline)}`, 10, 62);
    doc.text(`Taxa de Conversão: ${dados.dados.taxaConversao.toFixed(1)}%`, 10, 69);

    // Tabela de vendas
    if (dados.dados.vendasFiltradas && dados.dados.vendasFiltradas.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text("Detalhamento de Vendas", 10, 85);

      const tableData = dados.dados.vendasFiltradas.map((v) => [
        v.cliente,
        formatarMoeda(v.valor),
        formatarData(v.data),
      ]);

      (doc as any).autoTable({
        head: [["Cliente", "Valor", "Data"]],
        body: tableData,
        startY: 92,
        theme: "grid",
        headStyles: { fillColor: [17, 17, 17], textColor: [255, 255, 255] },
        margin: { left: 10, right: 10 },
      });
    }

    // Dados por vendedor
    if (dados.dados.dadosPorVendedor && Object.keys(dados.dados.dadosPorVendedor).length > 0) {
      doc.addPage();
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text("Performance por Vendedor", 10, 15);

      const vendedorData = Object.values(dados.dados.dadosPorVendedor).map((v) => [
        v.nome,
        formatarMoeda(v.vendas),
        v.prospecccoes.toString(),
        v.atividades.toString(),
      ]);

      (doc as any).autoTable({
        head: [["Vendedor", "Faturamento", "Prospecções", "Atividades"]],
        body: vendedorData,
        startY: 25,
        theme: "grid",
        headStyles: { fillColor: [17, 17, 17], textColor: [255, 255, 255] },
        margin: { left: 10, right: 10 },
      });
    }

    doc.save("relatorio-comercial.pdf");
  } catch (erro) {
    console.error("Erro ao exportar PDF:", erro);
    alert("Erro ao exportar PDF. Tente novamente.");
  }
}

export async function exportarCSV(dados: DadosCSV) {
  try {
    const linhas: string[] = [];

    // Cabeçalho
    linhas.push("Cliente,Valor,Data,Produto");

    // Dados
    dados.vendasFiltradas.forEach((v) => {
      linhas.push(
        `"${v.cliente}","${v.valor}","${formatarData(v.data)}","${v.produto || ""}"`
      );
    });

    // Criar arquivo
    const conteudo = linhas.join("\n");
    const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-vendas-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  } catch (erro) {
    console.error("Erro ao exportar CSV:", erro);
    alert("Erro ao exportar CSV. Tente novamente.");
  }
}

export async function exportarExcel(dados: DadosExcel) {
  try {
    // Aba 1: Resumo
    const resumoData = [
      ["RELATÓRIO COMERCIAL"],
      [],
      ["Período", `${dados.filtro?.dataInicio || "N/A"} a ${dados.filtro?.dataFim || "N/A"}`],
      ["Data de Geração", new Date().toLocaleDateString("pt-BR")],
      [],
      ["Faturamento Total", dados.dados.valorTotalVendido],
      ["Pipeline Total", dados.dados.valorTotalPipeline],
      ["Taxa de Conversão (%)", dados.dados.taxaConversao.toFixed(1)],
    ];

    // Aba 2: Vendas detalhadas
    const vendasData = [
      ["DETALHAMENTO DE VENDAS"],
      [],
      ["Cliente", "Valor", "Data", "Produto"],
      ...(dados.dados.vendasFiltradas?.map((v) => [
        v.cliente,
        v.valor,
        formatarData(v.data),
        v.produto || "",
      ]) || []),
    ];

    // Aba 3: Performance por vendedor
    const vendedorData = [
      ["PERFORMANCE POR VENDEDOR"],
      [],
      ["Vendedor", "Faturamento", "Compartilhado", "Prospecções", "Atividades"],
      ...(Object.values(dados.dados.dadosPorVendedor || {}).map((v) => [
        v.nome,
        v.vendas,
        v.vendidoCompartilhado,
        v.prospecccoes,
        v.atividades,
      ]) || []),
    ];

    const wb = new ExcelJS.Workbook();
    const adicionarAba = (nome: string, linhas: unknown[][]) => {
      const ws = wb.addWorksheet(nome);
      ws.addRows(linhas);
      ws.getRow(1).font = { bold: true };
      ws.columns.forEach((coluna) => { coluna.width = 20; });
    };
    adicionarAba("Resumo", resumoData);
    adicionarAba("Vendas", vendasData);
    adicionarAba("Performance", vendedorData);

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-comercial-${new Date().toISOString().split("T")[0]}.xlsx`;
    link.click();
  } catch (erro) {
    console.error("Erro ao exportar Excel:", erro);
    alert("Erro ao exportar Excel. Tente novamente.");
  }
}
