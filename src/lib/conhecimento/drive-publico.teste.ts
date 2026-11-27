/**
 * Regras dos materiais do Drive (sem rede).
 *
 * Rodar com:
 *   node --experimental-strip-types --no-warnings --import <reg.mjs> src/lib/conhecimento/drive-publico.teste.ts
 */
import { ehInterno, idDaFonte, lerListagem, lojasDoArquivo, marcaDaFonte, modificadoDaFonte, nomeBase, semRepetidos, viraTexto, type ArquivoFonte } from "./drive-publico";

let passou = 0;
const falhas: string[] = [];
function conferir(oque: string, real: unknown, esperado: unknown) {
  const a = JSON.stringify(real);
  const b = JSON.stringify(esperado);
  if (a === b) passou += 1;
  else falhas.push(`${oque}\n  esperado: ${b}\n  veio:     ${a}`);
}

const TODAS = ["MF International", "LF Lareiras", "A&G Aquecimento", "Sole Aquecimento"];

// ---- para qual loja vai
conferir("subpasta A&G dentro de 'LF e A&G' é só da A&G", lojasDoArquivo("Tabelas de preços LF e A&G / A&G", "Tabela AEG 2026 - V2.pdf"), ["A&G Aquecimento"]);
conferir("tabela da LF", lojasDoArquivo("Tabelas de preços LF e A&G / LF", "Tabela LF Lareiras 2026 - V2.pdf"), ["LF Lareiras"]);
conferir("'LF  AEG' no nome é das duas", lojasDoArquivo("Condições Comerciais", "Condições Comerciais – LF  AEG 26.pdf"), ["LF Lareiras", "A&G Aquecimento"]);
conferir("'AEGLF' junto é das duas", lojasDoArquivo("Catálogos / De Bacco", "Tabela DEBACCO - AEGLF - 2025 versão 04.xlsx"), ["LF Lareiras", "A&G Aquecimento"]);
conferir("'AEG:LF' é das duas", lojasDoArquivo("Catálogos / Churrasqueiras", "PREÇOS SCHEER - AEG:LF 2025-2.xlsx"), ["LF Lareiras", "A&G Aquecimento"]);
conferir("manual de lareira MF é do grupo todo", lojasDoArquivo("Manuais e Guias Práticos / Manuais / MF 150", "MANUAL MF 150 - 2025.pdf"), TODAS);
conferir("'Lareira' não é 'LF'", lojasDoArquivo("Catálogos / Lareiras Kratki / LAREIRA NBC 7 KW", "FICHA TÉCNICA LAREIRA NBC 7 KW.pdf"), TODAS);
conferir("nome do arquivo manda mais que a pasta", lojasDoArquivo("Catálogos / Titan Eletros", "LF_Prime2025.pdf"), ["LF Lareiras"]);
conferir("A&G no nome", lojasDoArquivo("Apresentações Lojas / Cliente final / A&G / Apresentação Loja", "A&G.pdf"), ["A&G Aquecimento"]);
conferir("'PPT de Vendas AEG'", lojasDoArquivo("Curso e Especializações / Power Point de vendas LF e A&G / A&G", "PPT de Vendas AEG - CF.pptx"), ["A&G Aquecimento"]);

// ---- uso interno
conferir("tabela é uso interno", ehInterno("Catálogos / Seccare", "Preços Seccare LFAEG-xlsx.xlsx", false), true);
conferir("manual não é", ehInterno("Manuais e Guias Práticos / Manuais / MF 150", "MANUAL MF 150 - 2025.pdf", false), false);
conferir("pasta interna manda", ehInterno("Condições Comerciais", "qualquer.pdf", true), true);

// ---- repetidos
const arq = (nome: string, caminho: string, id = nome): ArquivoFonte => ({ id, nome, tipo: "arquivo", modificado: "Apr 17", caminho, interno: false });
const lista = [
  arq("MANUAL VISION - 2025.pdf", "Manuais e Guias Práticos / Manuais 2025", "a"),
  arq("MANUAL VISION - 2025.pdf", "Manuais e Guias Práticos / Manuais / MF Vision", "b"),
  arq("ESTRUTURA DA CADÊNCIA PARA MENSAGENS E LIGAÇÕES PADRÃO.pdf", "Cadência", "c"),
  arq("ESTRUTURA DA CADÊNCIA PARA MENSAGENS E LIGAÇÕES PADRÃO.docx", "Cadência", "d"),
  arq("Cópia de Manual - Rosa Reverse.pdf", "Catálogos / Fogões", "e"),
];
const sem = semRepetidos(lista).map((a) => a.id).sort();
conferir("fica o manual da pasta da linha e a cadência em Word", sem, ["b", "d", "e"]);
conferir("nomeBase ignora acento, extensão e 'Cópia de'", nomeBase("Cópia de Manual - Rosa Reverse.pdf"), nomeBase("MANUAL - ROSA REVERSE.docx"));
conferir("nomeBase iguala o manual de vendas antigo", nomeBase("Manual de VendasLFAEG - 2026.pdf"), nomeBase("Manual de VendasLF:AEG - 2026"));

// ---- o que vira texto
conferir("pdf vira texto", viraTexto({ nome: "a.pdf", tipo: "arquivo" }), true);
conferir("foto não", viraTexto({ nome: "a.jpg", tipo: "arquivo" }), false);
conferir("bloco 3D não", viraTexto({ nome: "lareira.skp", tipo: "arquivo" }), false);
conferir("Google Docs vira", viraTexto({ nome: "CURSO", tipo: "google-document" }), true);

// ---- marca da fonte
const marca = marcaDaFonte("1ZxD7_tK-x", "Apr 17");
conferir("id da fonte volta", idDaFonte(`Do Linktree: x. ${marca}`), "1ZxD7_tK-x");
conferir("data volta", modificadoDaFonte(`Do Linktree: x. ${marca}`), "Apr 17");
conferir("material de gente não tem fonte", idDaFonte("Manual enviado pelo gestor"), null);

// ---- listagem do Drive
const html =
  '<div class="flip-entry" id="entry-1"><div class="flip-entry-info"><a href="https://drive.google.com/file/d/ABC_123/view?usp=drive_web"><div class="flip-entry-title">A&amp;G REGULAMENTO.pdf</div></a></div><div class="flip-entry-last-modified"><div>Apr 17</div></div></div>' +
  '<div class="flip-entry" id="entry-2"><a href="https://drive.google.com/drive/folders/PASTA-9"><div class="flip-entry-title">LF</div></a><div class="flip-entry-last-modified"><div>Nov 2, 2024</div></div></div>' +
  '<div class="flip-entry" id="entry-3"><a href="https://docs.google.com/document/d/DOC-7/edit"><div class="flip-entry-title">CURSO EDUARDO TEVAH</div></a><div class="flip-entry-last-modified"><div>10:23 AM</div></div></div>';
conferir("lê arquivo, pasta e Google Docs com a data", lerListagem(html), [
  { id: "ABC_123", nome: "A&G REGULAMENTO.pdf", tipo: "arquivo", modificado: "Apr 17" },
  { id: "PASTA-9", nome: "LF", tipo: "pasta", modificado: "Nov 2, 2024" },
  { id: "DOC-7", nome: "CURSO EDUARDO TEVAH", tipo: "google-document", modificado: "10:23 AM" },
]);
conferir("página sem itens não quebra", lerListagem("<html>nada</html>"), []);

if (falhas.length) {
  console.error(`${falhas.length} verificação(ões) falharam:\n\n${falhas.join("\n\n")}`);
  process.exit(1);
}
console.log(`${passou}/${passou} verificações passaram`);
