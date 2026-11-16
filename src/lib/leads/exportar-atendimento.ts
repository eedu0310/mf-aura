/**
 * Excel do relatório de atendimento dos leads: o mesmo que está na tela, em
 * três abas (Resumo, Por vendedor, Leads), pronto para imprimir ou mandar.
 */
import {
  SITUACAO_TEXTO,
  dataBR,
  dataHoraBR,
  formatarDuracao,
  type LinhaAtendimento,
  type ResumoAtendimento,
} from "@/lib/leads/atendimento";

export interface FiltrosDoRelatorio {
  loja: string;
  vendedor: string;
  inicio: string;
  fim: string;
}

function textoPeriodo(f: FiltrosDoRelatorio) {
  if (!f.inicio && !f.fim) return "Todo o histórico";
  if (f.inicio === f.fim) return dataBR(f.inicio);
  return `${dataBR(f.inicio) || "início"} a ${dataBR(f.fim) || "hoje"}`;
}

const AZUL = "FF0F3D4C";

export async function exportarAtendimentoExcel(
  filtros: FiltrosDoRelatorio,
  total: ResumoAtendimento,
  porVendedor: ResumoAtendimento[],
  linhas: LinhaAtendimento[],
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "AURA · Grupo MF";

  const cabecalho = (ws: import("exceljs").Worksheet, linha: number) => {
    const r = ws.getRow(linha);
    r.font = { bold: true, color: { argb: "FFFFFFFF" } };
    r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    r.alignment = { vertical: "middle", wrapText: true };
  };

  // Aba 1: Resumo
  const resumo = wb.addWorksheet("Resumo", { pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  resumo.columns = [{ width: 34 }, { width: 28 }];
  resumo.addRow(["Relatório de atendimento dos leads"]).font = { bold: true, size: 14 };
  resumo.addRow(["AURA · Grupo MF"]).font = { color: { argb: "FF666666" } };
  resumo.addRow([]);
  resumo.addRow(["Loja", filtros.loja]);
  resumo.addRow(["Vendedor", filtros.vendedor]);
  resumo.addRow(["Período (chegada do lead)", textoPeriodo(filtros)]);
  resumo.addRow(["Gerado em", dataHoraBR(new Date())]);
  resumo.addRow([]);
  resumo.addRow(["Indicador", "Valor"]);
  cabecalho(resumo, resumo.rowCount);
  const pct = (p: number) => (total.recebidos ? p / total.recebidos : 0);
  const linhasResumo: [string, number | string, string?][] = [
    ["Leads recebidos", total.recebidos],
    ["Atendidos", total.atendidos],
    ["Atendidos (% dos recebidos)", pct(total.atendidos), "0%"],
    ["Atendidos no prazo", total.noPrazo],
    ["Atendidos no prazo (% dos recebidos)", pct(total.noPrazo), "0%"],
    ["Atendidos fora do prazo", total.foraDoPrazo],
    ["Sem atendimento", total.semAtendimento],
    ["Sem atendimento e com prazo vencido", total.atrasados],
    ["Perdidos", total.perdidos],
    ["Tempo até o primeiro atendimento (mediana)", formatarDuracao(total.medianaMinutos)],
  ];
  for (const [k, v, fmt] of linhasResumo) {
    const r = resumo.addRow([k, v]);
    if (fmt) r.getCell(2).numFmt = fmt;
    r.getCell(2).alignment = { horizontal: "right" };
  }
  resumo.addRow([]);
  resumo.addRow([
    "Atendido = a vendedora mandou mensagem pelo WhatsApp ligado na AURA, marcou o lead como respondido ou registrou uma atividade com o cliente, o que vier primeiro depois que o lead chegou.",
  ]).alignment = { wrapText: true };
  resumo.mergeCells(resumo.rowCount, 1, resumo.rowCount, 2);
  resumo.getRow(resumo.rowCount).height = 48;

  // Aba 2: Por vendedor
  const vend = wb.addWorksheet("Por vendedor", { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  vend.columns = [
    { header: "Vendedor", key: "nome", width: 28 },
    { header: "Recebidos", key: "recebidos", width: 11 },
    { header: "Atendidos", key: "atendidos", width: 11 },
    { header: "% atendidos", key: "pa", width: 12, style: { numFmt: "0%" } },
    { header: "No prazo", key: "noPrazo", width: 10 },
    { header: "% no prazo", key: "pp", width: 11, style: { numFmt: "0%" } },
    { header: "Fora do prazo", key: "foraDoPrazo", width: 13 },
    { header: "Sem atendimento", key: "semAtendimento", width: 15 },
    { header: "Prazo vencido", key: "atrasados", width: 13 },
    { header: "Perdidos", key: "perdidos", width: 10 },
    { header: "Tempo até atender (mediana)", key: "tempo", width: 22 },
  ];
  cabecalho(vend, 1);
  for (const r of [...porVendedor, { ...total, nome: "Total" }]) {
    const row = vend.addRow({
      ...r,
      pa: r.recebidos ? r.atendidos / r.recebidos : 0,
      pp: r.recebidos ? r.noPrazo / r.recebidos : 0,
      tempo: formatarDuracao(r.medianaMinutos),
    });
    if (r.nome === "Total") row.font = { bold: true };
  }
  vend.views = [{ state: "frozen", ySplit: 1 }];

  // Aba 3: Leads, um por linha
  const ws = wb.addWorksheet("Leads", { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = [
    { header: "Chegou em", key: "chegou", width: 16 },
    { header: "Loja", key: "loja", width: 18 },
    { header: "Vendedor", key: "vendedor", width: 22 },
    { header: "Cliente", key: "cliente", width: 26 },
    { header: "Telefone", key: "telefone", width: 16 },
    { header: "Origem", key: "origem", width: 22 },
    { header: "Prazo", key: "prazo", width: 16 },
    { header: "Atendido em", key: "atendido", width: 16 },
    { header: "Tempo até atender", key: "tempo", width: 16 },
    { header: "Como foi atendido", key: "como", width: 22 },
    { header: "Situação", key: "situacao", width: 28 },
    { header: "Motivo da perda", key: "motivo", width: 24 },
    { header: "Mensagem do cliente", key: "mensagem", width: 50 },
  ];
  cabecalho(ws, 1);
  for (const l of linhas) {
    const row = ws.addRow({
      chegou: dataHoraBR(l.chegouEm),
      loja: l.lead.empresa,
      vendedor: l.vendedor,
      cliente: l.lead.nome || "Contato novo",
      telefone: l.lead.telefone,
      origem: l.lead.origem,
      prazo: dataHoraBR(l.lead.prazoResposta ? new Date(l.lead.prazoResposta) : null),
      atendido: dataHoraBR(l.atendidoEm),
      tempo: formatarDuracao(l.minutosAteAtender),
      como: l.como ?? "—",
      situacao: SITUACAO_TEXTO[l.situacao],
      motivo: l.lead.motivoPerda ?? "",
      mensagem: (l.lead.mensagemInicial ?? "").slice(0, 500),
    });
    row.alignment = { vertical: "top", wrapText: true };
    if (l.situacao === "atrasado" || l.situacao === "perdido_sem_atendimento") {
      row.getCell("situacao").font = { color: { argb: "FFB42318" }, bold: true };
    }
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const partes = ["atendimento-leads", filtros.loja, filtros.vendedor, filtros.inicio || "inicio", filtros.fim || "hoje"]
    .map((p) => p.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase())
    .filter(Boolean);
  a.href = url;
  a.download = `${partes.join("_")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
