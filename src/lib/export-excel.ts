import ExcelJS from "exceljs";

export interface DadosExportacao {
  nomePlanilha: string;
  dados: Array<Record<string, unknown>>;
}

async function baixarWorkbook(workbook: ExcelJS.Workbook, nomeArquivo: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${nomeArquivo}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportarExcel(
  planilhas: DadosExportacao[],
  nomeArquivo = "relatorio.xlsx",
) {
  const workbook = new ExcelJS.Workbook();
  for (const { nomePlanilha, dados } of planilhas) {
    const worksheet = workbook.addWorksheet(nomePlanilha.slice(0, 31));
    if (dados.length === 0) continue;
    worksheet.columns = Object.keys(dados[0]).map((key) => ({
      header: key,
      key,
      width: 20,
    }));
    worksheet.addRows(dados);
    worksheet.getRow(1).font = { bold: true };
  }
  await baixarWorkbook(workbook, nomeArquivo.replace(/\.xlsx$/i, ""));
}

export async function exportarComGraficos(
  titulo: string,
  dados: Record<string, unknown> | Record<string, unknown>[],
  nomeArquivo = "relatorio",
) {
  const workbook = new ExcelJS.Workbook();
  const resumo = workbook.addWorksheet("Resumo");
  resumo.addRows([
    ["Campo", "Valor"],
    ["Relatório", titulo],
    ["Data", new Date().toLocaleDateString("pt-BR")],
  ]);
  resumo.getRow(1).font = { bold: true };
  resumo.columns = [{ width: 24 }, { width: 60 }];

  const dadosArray = Array.isArray(dados) ? dados : [dados];
  if (dadosArray.length > 0 && Object.keys(dadosArray[0]).length > 0) {
    const worksheet = workbook.addWorksheet("Dados");
    worksheet.columns = Object.keys(dadosArray[0]).map((key) => ({
      header: key,
      key,
      width: 20,
    }));
    worksheet.addRows(dadosArray);
    worksheet.getRow(1).font = { bold: true };
  }
  await baixarWorkbook(workbook, nomeArquivo);
}
