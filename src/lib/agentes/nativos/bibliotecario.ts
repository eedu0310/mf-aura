/**
 * BIBLIOTECÁRIO — de 2 em 2 horas (7h às 21h) busca os materiais da empresa
 * no Google Drive (as pastas do Linktree dos vendedores) e mantém a base de
 * conhecimento da AURA em dia.
 *
 * POR QUE EXISTE (pedido do Elton, 27/11/2026): "quero o sistema 100% redondo,
 * com tudo de material que usamos na empresa: o que trabalhamos, oferecemos e
 * os padrões da empresa". O material vive no Drive e muda (tabela nova,
 * manual revisado); subir à mão, loja por loja, era o motivo de a base ter
 * só 9 documentos. Agora o Drive é a fonte e o bibliotecário traz:
 *
 *   - arquivo NOVO no Drive → entra como material da(s) loja(s) certa(s)
 *     (drive-publico.ts decide: "LF", "A&G" ou o grupo todo) e já é partido
 *     em trechos buscáveis (os agentes, o Coach e o supervisor do WhatsApp
 *     acham o trecho certo quando precisam);
 *   - arquivo ALTERADO (a data de alteração do Drive mudou) → o texto e os
 *     trechos são trocados pela versão nova;
 *   - preço, tabela e condição comercial entram marcados "[Uso interno]": os
 *     assistentes que falam com o cliente (Instagram e chat do site) não leem;
 *   - PDF que é só imagem (sem texto) ou grande demais vira aviso para o
 *     gestor, uma vez: "mande a versão em Word/Excel".
 *
 * EXCEÇÃO DOCUMENTADA à regra 2 do contrato ("agente não altera dado"),
 * estreita como a do Revisor:
 *   - só grava em aura_materiais / aura_material_trechos;
 *   - só mexe em material que ELE trouxe (marca "drive:<id>" na descrição);
 *     o que uma pessoa enviou pela tela nunca é tocado, e documento que já
 *     existe enviado por alguém não é duplicado;
 *   - material que o gestor DESLIGOU fica desligado: o bibliotecário não
 *     religa nem atualiza;
 *   - tudo entra no histórico do conhecimento (gatilho da 110) e no backup
 *     do Guardião.
 */
import fs from "node:fs";
import path from "node:path";
import type { Achado, ContextoAgente, DefinicaoAgente, ResultadoAgente } from "../tipos";
import { extrairTexto } from "@/lib/aura/extrair-texto";
import { regravarTrechos } from "@/lib/aura/trechos";
import { limparCacheMateriais } from "@/lib/aura/materiais";
import {
  MARCA_INTERNO,
  PASTAS_DO_LINKTREE,
  baixar,
  extensao,
  idDaFonte,
  lojasDoArquivo,
  marcaDaFonte,
  modificadoDaFonte,
  nomeBase,
  percorrer,
  semRepetidos,
  type ArquivoFonte,
} from "@/lib/conhecimento/drive-publico";
import { chaveDe, lerTudo, plural, responsaveisDaLoja } from "./comum";

export const ID_BIBLIOTECARIO = "bibliotecario";

/** Texto máximo guardado de um documento (manual em 6 idiomas passa de 380 mil caracteres). */
const MAX_CARACTERES = 150_000;
/** Menos que isto não é documento: é PDF de imagem ou capa. */
const MINIMO_DE_TEXTO = 200;
/** Folga no fim da rodada para gravar e responder. */
const FOLGA_MS = 45_000;

/**
 * Textos que moram no próprio código (src/lib/conhecimento/fontes): o que o
 * servidor não consegue tirar do Drive sozinho — a Missão, Visão e Valores
 * eram fotos (transcritas) e as apresentações de loja e de vendas são
 * arquivos de 50 a 450 MB (o texto foi extraído uma vez, fora do servidor).
 * Entram como se fossem arquivos do Drive, com "modificado" = tamanho do
 * texto; `cobre` é o arquivo do Drive que esta cópia substitui (ele deixa de
 * ser baixado e de aparecer como "não lido").
 */
const FONTES_DO_CODIGO: Array<{ id: string; arquivo: string; titulo: string; caminho: string; cobre?: string }> = [
  {
    id: "repo-cultura-cps",
    arquivo: "cultura-cps.md",
    titulo: "CPS — Visão, Missão e Valores da empresa",
    caminho: "Missão Visão e Valores da Empresa",
  },
  {
    id: "repo-lf-apresentacao-loja",
    arquivo: "lf-apresentacao-loja.txt",
    titulo: "Apresentação da loja LF Lareiras (cliente final)",
    caminho: "Apresentações Lojas / Cliente final / LF",
    cobre: "1clkE4vh7Xq0fYhMykYf0o3DX9yvARfIO",
  },
  {
    id: "repo-aeg-workshop-2025",
    arquivo: "aeg-workshop-2025.txt",
    titulo: "Apresentação do workshop A&G Aquecimento 2025",
    caminho: "Apresentações Lojas / Cliente final / A&G",
    cobre: "1L38s2jhhe0gAt43_WvpRUB2lxx1W9HbE",
  },
  {
    id: "repo-lf-ppt-vendas",
    arquivo: "lf-ppt-vendas.txt",
    titulo: "PowerPoint de vendas LF Lareiras (cliente final)",
    caminho: "Curso e Especializações / Power Point de vendas / LF",
    cobre: "1_1oumf2pbwluunJbklSit2EE6dNSW9g-",
  },
  {
    id: "repo-aeg-ppt-vendas",
    arquivo: "aeg-ppt-vendas.txt",
    titulo: "PowerPoint de vendas A&G Aquecimento (cliente final)",
    caminho: "Curso e Especializações / Power Point de vendas / A&G",
    cobre: "1blrOTX3Kl-ZisE-U6bRVAtL0rxXIUjJ2",
  },
];

interface LinhaMaterial {
  id: string;
  empresa: string;
  titulo: string;
  descricao: string | null;
  arquivo_nome: string | null;
  ativo: boolean;
}

/**
 * O texto está em português? Manual italiano de fogão (italiano, inglês,
 * alemão, francês, espanhol; 380 mil caracteres) só atrapalharia a busca.
 *
 * Só recusa quando OUTRA língua domina: catálogo e tabela em português têm
 * pouco texto corrido (lista de produto e número), e uma regra que exigisse
 * "português suficiente" recusava os catálogos. Compara palavras típicas de
 * cada lado na amostra do começo.
 */
export function pareceTextoEmPortugues(texto: string): boolean {
  const amostra = texto.slice(0, 40_000).normalize("NFC");
  // Ficha técnica curta em várias línguas ("Principais informações" dos fogões)
  // traz os números certos: fica. A regra vale para o manual inteiro em outra língua.
  if (texto.length < 50_000 || amostra.length < 500) return true;
  const pt = (amostra.match(/ção|ções|ões|ã|õ|\bnão\b|\bvocê\b|\bpara\b|\bcom\b/gi) ?? []).length;
  const fora = (amostra.match(/\bthe\b|\band\b|\bund\b|\bder\b|\bdie\b|\bdella\b|\bper\b|\bil\b|\bles\b|\bdes\b|zione|ción\b|\bwith\b/gi) ?? []).length;
  return !(fora > 2 * pt && (fora / amostra.length) * 1000 > 3);
}

/** Falhas lembradas (id + versão): não baixar 450 MB de novo a cada rodada. */
const g = globalThis as unknown as { __bibliotecaFalhas?: Map<string, { motivo: string; em: number }> };
const falhasLembradas = (g.__bibliotecaFalhas ??= new Map());
const LEMBRAR_FALHA_MS = 24 * 60 * 60 * 1000;

/** "MANUAL ADATTO 70 PRO - 2025.doc.pdf" → "MANUAL ADATTO 70 PRO - 2025"; nome curto ganha a pasta. */
export function tituloDoArquivo(a: Pick<ArquivoFonte, "nome" | "caminho">): string {
  const limpo = a.nome
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/\.(doc|docx)$/i, "")
    .replace(/^c[oó]pia de\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (limpo.length >= 16) return limpo;
  const pastas = a.caminho.split(" / ");
  return `${pastas.slice(-2).join(" — ")}: ${limpo}`;
}

async function executar(ctx: ContextoAgente): Promise<ResultadoAgente> {
  const { sb } = ctx;
  const comecou = Date.now();
  const temTempo = () => (ctx.prazo !== undefined ? ctx.prazo - Date.now() > FOLGA_MS : Date.now() - comecou < 180_000);

  // 1. O que tem no Drive (pasta que falhar não derruba as outras).
  const errosDePasta: string[] = [];
  const todos: ArquivoFonte[] = [];
  for (const pasta of PASTAS_DO_LINKTREE) {
    try {
      todos.push(...(await percorrer(pasta)));
    } catch (e) {
      errosDePasta.push(`${pasta.nome}: ${(e as Error).message}`);
    }
  }
  const arquivos = semRepetidos(todos);

  // 2. O que já tem na base.
  const existentes = await lerTudo<LinhaMaterial>((de, ate) =>
    sb.from("aura_materiais").select("id, empresa, titulo, descricao, arquivo_nome, ativo").order("id").range(de, ate),
  );
  const porFonte = new Map<string, LinhaMaterial>();
  const enviadosPorGente = new Set<string>();
  for (const m of existentes) {
    const fonte = idDaFonte(m.descricao);
    if (fonte) porFonte.set(`${fonte}|${m.empresa}`, m);
    else {
      enviadosPorGente.add(`${m.empresa}|${nomeBase(m.arquivo_nome ?? "")}`);
      enviadosPorGente.add(`${m.empresa}|${nomeBase(m.titulo)}`);
    }
  }

  // 3. O que falta ou mudou, por arquivo (baixa uma vez, grava em cada loja).
  type Tarefa = { fonte: ArquivoFonte; titulo: string; lojas: Array<{ empresa: string; existente: LinhaMaterial | null }>; textoPronto?: string };
  const tarefas: Tarefa[] = [];
  let emDia = 0;
  let desligados = 0;
  const planejar = (fonte: ArquivoFonte, titulo: string, lojas: string[], textoPronto?: string) => {
    const alvo: Tarefa["lojas"] = [];
    for (const empresa of lojas) {
      const existente = porFonte.get(`${fonte.id}|${empresa}`) ?? null;
      if (existente) {
        if (!existente.ativo) {
          desligados++;
          continue; // o gestor desligou: fica desligado
        }
        if (modificadoDaFonte(existente.descricao) === (fonte.modificado || "?")) {
          emDia++;
          continue;
        }
        alvo.push({ empresa, existente });
      } else {
        // Já enviado à mão por alguém (mesmo nome)? Não duplica.
        if (enviadosPorGente.has(`${empresa}|${nomeBase(fonte.nome)}`) || enviadosPorGente.has(`${empresa}|${nomeBase(titulo)}`)) {
          emDia++;
          continue;
        }
        alvo.push({ empresa, existente: null });
      }
    }
    if (alvo.length) tarefas.push({ fonte, titulo, lojas: alvo, textoPronto });
  };

  for (const f of FONTES_DO_CODIGO) {
    let texto = "";
    try {
      texto = fs.readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), "src/lib/conhecimento/fontes", f.arquivo), "utf8");
    } catch {
      continue;
    }
    const fonte: ArquivoFonte = { id: f.id, nome: f.arquivo, tipo: "arquivo", modificado: `v${texto.length}`, caminho: f.caminho, interno: false };
    planejar(fonte, f.titulo, lojasDoArquivo(f.caminho, f.arquivo), texto);
  }
  const cobertos = new Set(FONTES_DO_CODIGO.map((f) => f.cobre).filter(Boolean));
  for (const a of arquivos) if (!cobertos.has(a.id)) planejar(a, tituloDoArquivo(a), lojasDoArquivo(a.caminho, a.nome));

  // 4. Baixa, lê e grava, enquanto houver tempo (o resto fica para a próxima rodada).
  const novos: string[] = [];
  const atualizados: string[] = [];
  const naoLidos: Array<{ nome: string; motivo: string }> = [];
  let adiados = 0;
  for (const t of tarefas) {
    if (!temTempo()) {
      adiados++;
      continue;
    }
    const chaveFalha = `${t.fonte.id}|${t.fonte.modificado}`;
    const lembrada = falhasLembradas.get(chaveFalha);
    if (lembrada && Date.now() - lembrada.em < LEMBRAR_FALHA_MS) {
      naoLidos.push({ nome: t.fonte.nome, motivo: lembrada.motivo });
      continue;
    }
    let texto = t.textoPronto ?? "";
    try {
      if (!texto) {
        const { buffer, nomeParaLer } = await baixar(t.fonte);
        const lido = await extrairTexto(nomeParaLer, "", buffer);
        texto = lido.texto;
      }
      if (texto.trim().length < MINIMO_DE_TEXTO) throw new Error("sem texto (o arquivo é imagem)");
      if (!pareceTextoEmPortugues(texto)) throw new Error("não está em português");
    } catch (e) {
      const motivo = (e as Error).message.slice(0, 160);
      falhasLembradas.set(chaveFalha, { motivo, em: Date.now() });
      naoLidos.push({ nome: t.fonte.nome, motivo });
      continue;
    }
    if (texto.length > MAX_CARACTERES) texto = `${texto.slice(0, MAX_CARACTERES)}\n\n[Texto cortado: o documento original é maior.]`;

    const titulo = t.fonte.interno ? `${MARCA_INTERNO} ${t.titulo}` : t.titulo;
    const descricao = `Do Linktree dos vendedores (Google Drive): ${t.fonte.caminho}. ${marcaDaFonte(t.fonte.id, t.fonte.modificado)}`;
    const tipo =
      t.fonte.tipo !== "arquivo" ? "text/plain" : extensao(t.fonte.nome) === "md" ? "text/markdown" : `arquivo/${extensao(t.fonte.nome)}`;
    for (const { empresa, existente } of t.lojas) {
      try {
        let id = existente?.id ?? null;
        if (existente) {
          const { error } = await sb
            .from("aura_materiais")
            .update({ titulo, descricao, texto, arquivo_nome: t.fonte.nome, tipo, atualizado_em: ctx.agora.toISOString() })
            .eq("id", existente.id)
            .eq("ativo", true);
          if (error) throw new Error(error.message);
        } else {
          const { data, error } = await sb
            .from("aura_materiais")
            .insert({ empresa, titulo, descricao, arquivo_nome: t.fonte.nome, tipo, bytes: Buffer.byteLength(texto), texto })
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          id = data.id as string;
        }
        await regravarTrechos(sb, { id: id!, empresa, titulo, texto });
        limparCacheMateriais(empresa);
        (existente ? atualizados : novos).push(`${t.titulo} (${empresa})`);
      } catch (e) {
        ctx.log("bibliotecario: não gravei", t.fonte.nome, empresa, (e as Error).message);
      }
    }
  }

  // 5. Aviso ao gestor: o que não deu para ler (um card só, que expira).
  const achados: Achado[] = [];
  const unicos = [...new Map(naoLidos.map((n) => [n.nome, n])).values()];
  if (unicos.length) {
    const equipe = await responsaveisDaLoja(sb);
    for (const p of equipe.mestres()) {
      achados.push({
        chave: chaveDe(ID_BIBLIOTECARIO, "nao-lidos", p.id),
        empresa: p.empresa,
        destinatarioId: p.id,
        titulo: `${plural(unicos.length, "material do Drive não pôde ser lido", "materiais do Drive não puderam ser lidos")}`,
        descricao:
          `A AURA não consegue ler estes arquivos do Linktree (PDF que é foto, ou grande demais). ` +
          `Se mandar a versão em Word, Excel ou PDF com texto na mesma pasta, o Bibliotecário traz sozinho:\n` +
          unicos
            .slice(0, 12)
            .map((n) => `• ${n.nome} (${n.motivo})`)
            .join("\n"),
        prioridade: "baixa",
        entidadeTipo: "perfil",
        entidadeId: p.id,
        acaoUrl: "/gestor?aba=configuracoes",
        expiraEmDias: 7,
      });
    }
  }

  const resumo =
    `${plural(novos.length, "material novo", "materiais novos")}, ${plural(atualizados.length, "atualizado")}, ${emDia} em dia` +
    (adiados ? `, ${adiados} para a próxima rodada` : "") +
    (unicos.length ? `, ${unicos.length} sem texto legível` : "") +
    (errosDePasta.length ? `; ${errosDePasta.length} pasta(s) com erro` : "") +
    ".";
  return {
    resumo,
    achados,
    mensagens:
      novos.length || atualizados.length
        ? [
            {
              de: ID_BIBLIOTECARIO,
              para: "todos",
              tipo: "relato",
              texto:
                `Biblioteca atualizada: ${resumo} ` +
                (novos.length ? `Entraram: ${[...new Set(novos.map((n) => n.replace(/ \(.*\)$/, "")))].slice(0, 6).join("; ")}.` : ""),
              dados: { novos: novos.length, atualizados: atualizados.length },
            },
          ]
        : [],
    metricas: {
      noDrive: arquivos.length,
      novos: novos.length,
      atualizados: atualizados.length,
      emDia,
      desligadosPeloGestor: desligados,
      naoLidos: unicos.length,
      adiados,
      pastasComErro: errosDePasta.length,
    },
  };
}

export const agenteBibliotecario: DefinicaoAgente = {
  id: ID_BIBLIOTECARIO,
  nome: "Bibliotecário",
  cargo: "Traz e atualiza os materiais da empresa",
  setor: "conhecimento",
  icone: "Library",
  missao:
    "Busca os manuais, catálogos, tabelas, procedimentos e padrões da empresa nas pastas do Linktree dos vendedores (Google Drive), coloca na base de conhecimento da loja certa e mantém tudo na versão mais nova. Avisa o que não consegue ler.",
  agenda: { tipo: "diario", horas: [7, 9, 11, 13, 15, 17, 19, 21], minuto: 30 },
  usaIA: false,
  orcamentoMensalUsd: 0,
  tipo: "nativo",
  executar,
};
