import ExcelJS from "exceljs";
import html2pdf from "html2pdf.js";

async function baixarWorkbook(workbook: ExcelJS.Workbook, nomeArquivo: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${nomeArquivo}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

function criarPlanilha(workbook: ExcelJS.Workbook, nome: string, dados: any[]) {
  const worksheet = workbook.addWorksheet(nome.slice(0, 31));
  if (!dados.length) return;
  worksheet.columns = Object.keys(dados[0]).map((key) => ({ header: key, key, width: 20 }));
  worksheet.addRows(dados);
  worksheet.getRow(1).font = { bold: true };
}

export async function exportarParaExcel(dados: any[], nomeArquivo: string, nomePlanilha = "Dados") {
  if (dados.length === 0) { alert("Sem dados para exportar"); return; }
  const workbook = new ExcelJS.Workbook();
  criarPlanilha(workbook, nomePlanilha, dados);
  await baixarWorkbook(workbook, nomeArquivo);
}

export async function exportarMultiplasPlanilhas(planilhas: Array<{ nome: string; dados: any[] }>, nomeArquivo: string) {
  const workbook = new ExcelJS.Workbook();
  for (const { nome, dados } of planilhas) criarPlanilha(workbook, nome, dados);
  await baixarWorkbook(workbook, nomeArquivo);
}

export function exportarParaCSV(dados: any[], nomeArquivo: string) {
  if (dados.length === 0) { alert("Sem dados para exportar"); return; }
  const colunas = Object.keys(dados[0]);
  const escapar = (valor: unknown) => `"${String(valor ?? "").replace(/"/g, '""')}"`;
  const csv = [colunas.map(escapar).join(","), ...dados.map((linha) => colunas.map((coluna) => escapar(linha[coluna])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${nomeArquivo}.csv`;
  link.click();
}

export async function exportarParaPDF(elementId: string, nomeArquivo: string) {
  const elemento = document.getElementById(elementId);
  if (!elemento) { alert("Elemento não encontrado"); return; }
  try {
    await html2pdf().set({ margin: 10, filename: `${nomeArquivo}.pdf`, image: { type: "png" as const, quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { orientation: "portrait" as const, unit: "mm" as const, format: "a4" } }).from(elemento).save();
  } catch (erro) { console.error("Erro ao gerar PDF:", erro); alert("Erro ao gerar PDF"); }
}

export function formatarDadosExportacao(dados: any[], mapeador?: (item: any) => any) { return dados.map((item) => mapeador ? mapeador(item) : item); }

export async function copiarParaClipboard(texto: string) {
  try { await navigator.clipboard.writeText(texto); return true; } catch (erro) { console.error("Erro ao copiar:", erro); return false; }
}
