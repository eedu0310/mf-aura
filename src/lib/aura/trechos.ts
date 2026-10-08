/**
 * O manual em pedaços buscáveis.
 *
 * POR QUE EXISTE. O prompt da AURA injetava todos os materiais ativos da loja
 * de uma vez, com corte em 40 mil caracteres. Com os sete documentos da casa
 * (mais de 400 mil caracteres) o corte jogaria fora justamente o que faz
 * falta, e de forma imprevisível — o manual acabaria partido no meio de uma
 * seção, sempre na mesma seção, para toda conversa.
 *
 * COMO FUNCIONA. O texto é partido por título de seção e guardado em
 * aura_material_trechos, com índice de busca. Cada conversa leva apenas:
 *
 *   1. o NÚCLEO — as regras que valem em qualquer conversa, sempre presentes;
 *   2. os TRECHOS da conversa — o que a busca achou pelo assunto.
 *
 * O núcleo existe porque a busca sozinha tem um ponto cego: a regra de não
 * dizer ao cliente que LF, A&G e Sole são a mesma empresa vale sempre, e
 * nenhum cliente escreve palavra que case com ela. Sem o núcleo, a IA
 * responderia sem saber da regra.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Quanto do manual buscado cabe no prompt. O núcleo não conta aqui. */
const LIMITE_TRECHOS = 6_000;
const CACHE_NUCLEO_MS = 10 * 60 * 1000;

const g = globalThis as unknown as {
  __auraNucleo?: Map<string, { at: number; texto: string }>;
};
const cacheNucleo = (g.__auraNucleo ??= new Map());

export interface Trecho {
  origem: string;
  texto: string;
  nota: number;
}

/**
 * Parte o texto em seções.
 *
 * O corte é no título: linha que começa com `#` (markdown) ou que começa com
 * número e ponto ("15. QUANDO O CLIENTE DIZ..."), que é como os manuais da
 * casa são escritos. Seção grande é partida por parágrafo, porque um trecho de
 * dez mil caracteres anula o propósito: traria o manual inteiro de volta.
 *
 * Seção curta é colada na anterior até o pedaço ficar com corpo. Isso não é
 * detalhe: nos manuais da casa os 10 mandamentos são dez linhas numeradas, e
 * sem essa junção eles viravam dez trechos de 42 caracteres — dez fragmentos
 * soltos que não ensinam nada e ainda ocupam dez vagas na busca.
 */
/**
 * Seções cujo conteúdo vale em qualquer conversa e por isso entram sempre.
 *
 * Mora em código, e não só no banco, para o material que o gestor enviar
 * amanhã já nascer com as regras marcadas — se dependesse de alguém lembrar de
 * marcar, um dia o manual seria trocado e a AURA passaria a atender sem as
 * regras da casa, sem ninguém notar.
 */
export const SECOES_NUCLEO = [
  "OS 10 MANDAMENTOS",
  "O PROCESSO DA VENDA",
  "REGRAS ENTRE VENDEDORES",
  "LF, AEG E SOLE",
  "O QUE NÃO É PROSPECÇÃO",
  "O QUE O VENDEDOR SCMF NÃO FAZ",
  "O VENDEDOR SCMF FAZ",
];

function ehNucleo(origem: string): boolean {
  const o = origem.toUpperCase();
  return SECOES_NUCLEO.some((s) => o.includes(s));
}

/**
 * Descobre como este documento marca os títulos, antes de cortar.
 *
 * Isto não é refinamento, é a diferença entre partir o manual por assunto e
 * picá-lo em pedaços sem sentido. Os dois formatos reais da casa:
 *
 *  - "Cadência de mensagens": markdown, 28 linhas com `#`.
 *  - "SCMF — Guia Rápido": sem markdown. As SEÇÕES são linhas numeradas em
 *    maiúscula ("2. OS 10 MANDAMENTOS", 36 delas) e os ITENS da lista usam
 *    parêntese ("1) PROSPECTE TODOS OS DIAS", 10 deles). A distinção entre
 *    ponto e parêntese é o que separa seção de item neste documento.
 *  - PDF cru lido pelo extrator: perde quase toda a estrutura. Aqui não há
 *    regra que salve; sobra a junção de fragmentos para o resultado não ficar
 *    picado em pedaços de quarenta caracteres.
 *
 * ESCOLHER entre os estilos foi meu erro, e ele apareceria num documento de
 * verdade: o Manual de Vendas tem só 4 linhas numeradas (as do sumário) e 44
 * em maiúscula no corpo. Uma regra que testasse numeração primeiro escolheria
 * o estilo numerado e partiria 96 mil caracteres em QUATRO seções gigantes.
 *
 * Então os dois estilos SOMAM em vez de competir: título é a linha numerada em
 * maiúscula OU a linha em maiúscula. Quem tem os dois ganha os dois, e nenhum
 * documento é penalizado por usar uma convenção que o outro não usa. A
 * numeração solta (sem maiúscula) só vale quando não há nada melhor.
 */
function estiloDeTitulo(linhas: string[]): "markdown" | "cabecalhos" | "numero" {
  if (linhas.some((l) => /^\s{0,3}#{1,6}\s+\S/.test(l))) return "markdown";
  const cabecalhos = linhas.filter((l) => ehTituloNumerado(l) || ehLinhaMaiuscula(l)).length;
  if (cabecalhos >= 3) return "cabecalhos";
  return "numero";
}

/**
 * "2. OS 10 MANDAMENTOS" é seção. "2) ENTENDA ANTES" é item de lista.
 *
 * Tolera até duas minúsculas em vez de exigir zero: "24. METAS E KPIs" e
 * "21. PÓS-VENDA" são títulos de verdade e ficavam de fora pelo "s" do KPIs.
 * Duas é o bastante para a sigla e pouco para deixar passar frase comum —
 * testado nos 37 títulos do guia, sem nenhum falso positivo.
 */
function ehTituloNumerado(linha: string): boolean {
  const m = /^\s{0,3}\d{1,3}\.\s+(.+)$/.exec(linha.trim());
  if (!m) return false;
  const resto = m[1].trim();
  if (resto.length < 3 || resto.length > 90) return false;
  return (resto.match(/[a-zà-ÿ]/g) ?? []).length <= 2;
}

/**
 * Linha que é título por estar em maiúscula.
 *
 * Exige ao menos duas palavras e no máximo duas minúsculas (para a sigla do
 * tipo "KPIs" passar). Acentos contam como maiúscula (À-Ý), senão
 * "PROSPECÇÃO" seria recusada por causa do Ç e do Ã.
 */
function ehLinhaMaiuscula(linha: string): boolean {
  const l = linha.trim();
  if (l.length < 8 || l.length > 90) return false;
  if ((l.match(/[a-zà-ÿ]/g) ?? []).length > 2) return false;
  if (!/[A-ZÀ-Ý]{2}/.test(l)) return false;
  return l.split(/\s+/).length >= 2;
}

/**
 * Parte o texto em seções.
 *
 * Seção grande é partida por parágrafo, porque um trecho de dez mil
 * caracteres anula o propósito: traria o manual inteiro de volta.
 *
 * Seção curta é colada na anterior até o pedaço ficar com corpo. Nos manuais
 * da casa os 10 mandamentos são dez linhas curtas, e sem essa junção eles
 * viram dez fragmentos que não ensinam nada e ocupam dez vagas na busca.
 */
export function partirEmTrechos(
  titulo: string,
  texto: string,
  max = 1_200,
): { ordem: number; origem: string; texto: string }[] {
  const linhas = (texto ?? "").replace(/\r\n/g, "\n").split("\n");
  const estilo = estiloDeTitulo(linhas);

  const ehTitulo = (l: string) => {
    if (estilo === "markdown") return /^\s{0,3}#{1,6}\s+\S/.test(l);
    if (estilo === "cabecalhos") return ehTituloNumerado(l) || ehLinhaMaiuscula(l);
    return /^\s{0,3}\d{1,3}\.\s+\S/.test(l);
  };

  const secoes: { titulo: string; corpo: string[] }[] = [];
  for (const linha of linhas) {
    if (ehTitulo(linha)) {
      secoes.push({ titulo: linha.replace(/^\s{0,3}#{1,6}\s+/, "").trim(), corpo: [] });
    } else if (secoes.length) {
      secoes[secoes.length - 1].corpo.push(linha);
    } else {
      // Texto antes do primeiro título: vira a abertura do documento.
      secoes.push({ titulo, corpo: [linha] });
    }
  }

  const saida: { ordem: number; origem: string; texto: string }[] = [];
  let ordem = 0;
  /** Abaixo disto a seção é fragmento: pertence junto com as vizinhas. */
  const minimo = Math.min(250, Math.floor(max / 4));
  /** O último pedaço foi montado só de fragmentos e ainda aceita mais? */
  let juntando = false;

  for (const s of secoes) {
    const corpo = s.corpo.join("\n").trim();
    if (!corpo) continue;
    const origem = `${titulo} — ${s.titulo}`.slice(0, 300);
    const curta = corpo.length < minimo;
    const nucleoAqui = ehNucleo(origem);

    /**
     * Seção de núcleo nunca é colada, nem recebe cola.
     *
     * A marca de núcleo é lida do título do pedaço. Quando "28. LF, AEG E
     * SOLE" era absorvida pelo pedaço da seção 24, o título que sobrava era o
     * da 24 e a regra de não dizer ao cliente que as três operações são a
     * mesma empresa deixava de ser fixa — sumia da parte sempre presente do
     * prompt e passava a depender da busca, que nunca a traria.
     */
    const ultima = saida[saida.length - 1];
    const podeColar = !nucleoAqui && !(ultima && ehNucleo(ultima.origem));
    if (
      curta &&
      juntando &&
      podeColar &&
      ultima &&
      ultima.texto.length + corpo.length + s.titulo.length + 2 <= max
    ) {
      ultima.texto = `${ultima.texto}\n\n${s.titulo}\n${corpo}`;
      continue;
    }
    juntando = curta;

    if (corpo.length <= max) {
      saida.push({ ordem: ++ordem, origem, texto: corpo });
      continue;
    }

    // Seção longa: quebra por parágrafo, sem cortar frase no meio.
    let bloco = "";
    for (const paragrafo of corpo.split(/\n{2,}/)) {
      if (bloco && bloco.length + paragrafo.length + 2 > max) {
        saida.push({ ordem: ++ordem, origem, texto: bloco.trim() });
        bloco = "";
      }
      bloco += (bloco ? "\n\n" : "") + paragrafo;
      while (bloco.length > max) {
        saida.push({ ordem: ++ordem, origem, texto: bloco.slice(0, max).trim() });
        bloco = bloco.slice(max);
      }
    }
    if (bloco.trim()) saida.push({ ordem: ++ordem, origem, texto: bloco.trim() });
  }

  return saida;
}

/**
 * Regrava os trechos de um material. Chamado quando o gestor envia ou troca
 * um material — sem isto, material novo fica fora da busca e a AURA não
 * aprende o que acabou de receber.
 */
export async function regravarTrechos(
  sb: SupabaseClient,
  material: { id: string; empresa: string; titulo: string; texto: string },
): Promise<number> {
  const trechos = partirEmTrechos(material.titulo, material.texto);
  if (!trechos.length) return 0;

  // Apaga os antigos deste material antes de inserir os novos: material
  // reenviado com correções não pode conviver com a versão errada.
  const { error: erroApagar } = await sb
    .from("aura_material_trechos")
    .delete()
    .eq("material_id", material.id);
  if (erroApagar) throw new Error(`não consegui limpar os trechos antigos: ${erroApagar.message}`);

  const linhas = trechos.map((t) => ({
    material_id: material.id,
    empresa: material.empresa,
    ordem: t.ordem,
    origem: t.origem,
    texto: t.texto,
    nucleo: ehNucleo(t.origem),
  }));

  // Em lotes: um manual grande passa de mil trechos e um insert único estoura.
  for (let i = 0; i < linhas.length; i += 200) {
    const { error } = await sb.from("aura_material_trechos").insert(linhas.slice(i, i + 200));
    if (error) throw new Error(`não consegui gravar os trechos: ${error.message}`);
  }

  cacheNucleo.delete(material.empresa);
  return linhas.length;
}

/**
 * Teto do núcleo, em caracteres (~2.000 tokens).
 *
 * O núcleo viaja no prompt de TODA análise de conversa, que é 84% da conta da
 * IA. As lojas que têm as seções certas marcadas ficam em 2.700 caracteres; o
 * teto existe para a loja que não tem — ver o comentário do começo de fila
 * abaixo.
 */
const TETO_NUCLEO = 8_000;

/** As regras da casa que entram em toda conversa. Vai na parte cacheada. */
export async function nucleoDoManual(sb: SupabaseClient, empresa: string): Promise<string> {
  const hit = cacheNucleo.get(empresa);
  if (hit && Date.now() - hit.at < CACHE_NUCLEO_MS) return hit.texto;

  let texto = "";
  try {
    // Pela view, que já descarta material desligado pelo gestor — assim o
    // código não precisa lembrar de repetir essa regra em cada consulta.
    const { data } = await sb
      .from("aura_trechos_ativos")
      .select("origem, texto")
      .eq("empresa", empresa)
      .eq("nucleo", true)
      .order("ordem", { ascending: true });
    texto = (data ?? []).map((t) => `### ${t.origem}\n${t.texto}`).join("\n\n");

    /**
     * COMEÇO DE FILA: a loja cujo material não tem nenhuma das seções de
     * SECOES_NUCLEO fica sem núcleo — e quem chama cai no plano B antigo, que
     * manda o MATERIAL INTEIRO em toda análise.
     *
     * Medido na MF International: 35 mil caracteres por chamada, contra 2.700
     * das outras três lojas. Eram as 202 chamadas de 22 mil tokens no painel
     * de custo, 5% da conta inteira — por uma loja a quem só falta subir um
     * documento.
     *
     * Então, sem núcleo, usa-se o começo do manual até o teto. Não é tão bom
     * quanto as seções certas (por isso o aviso continua valendo: suba o
     * material que falta), mas é manual de verdade, na ordem em que foi
     * escrito, e custa quatro vezes menos.
     */
    if (!texto) {
      const { data: inicio } = await sb
        .from("aura_trechos_ativos")
        .select("origem, texto")
        .eq("empresa", empresa)
        .order("ordem", { ascending: true })
        .limit(40);

      const partes: string[] = [];
      let tamanho = 0;
      for (const t of inicio ?? []) {
        const bloco = `### ${t.origem}\n${t.texto}`;
        if (tamanho + bloco.length > TETO_NUCLEO) break;
        partes.push(bloco);
        tamanho += bloco.length;
      }
      texto = partes.join("\n\n");
    }
  } catch (e) {
    /**
     * Erro de leitura não vira "esta loja não tem manual" guardado por dez
     * minutos. Guardar o vazio faria a AURA atender sem manual nenhum até o
     * cache expirar, e o motivo não apareceria em lugar nenhum. Devolve vazio
     * para esta chamada e deixa a próxima tentar de novo.
     */
    console.error("Não consegui ler o manual de", empresa, e);
    return "";
  }

  cacheNucleo.set(empresa, { at: Date.now(), texto });
  return texto;
}

/**
 * Os trechos do manual que têm a ver com esta conversa.
 *
 * A escolha das palavras é feita no banco (função aura_buscar_trechos), que
 * mede cada palavra da conversa contra o material e descarta as comuns demais.
 * Sem essa medida a busca piora em vez de melhorar: "projeto" está em 41% dos
 * trechos e "cliente" em 27% — buscar por elas é buscar por tudo.
 */
export async function trechosRelevantes(
  sb: SupabaseClient,
  empresa: string,
  conversa: string,
  limite = 6,
): Promise<Trecho[]> {
  const texto = (conversa ?? "").trim();
  if (texto.length < 10) return [];

  try {
    const { data, error } = await sb.rpc("aura_buscar_trechos", {
      p_empresa: empresa,
      // Só o fim da conversa: o começo costuma ser "bom dia" e atrapalha mais
      // do que ajuda a dizer do que se trata agora.
      p_conversa: texto.slice(-4_000),
      p_limite: limite,
    });
    if (error) {
      console.error("[aura] busca de trechos:", error.message);
      return [];
    }
    return (data ?? []) as Trecho[];
  } catch (e: any) {
    console.error("[aura] busca de trechos:", e?.message ?? e);
    return [];
  }
}

/** Formata os trechos buscados para o prompt, respeitando o teto. */
export function textoDosTrechos(trechos: Trecho[]): string {
  let out = "";
  for (const t of trechos) {
    const bloco = `### ${t.origem}\n${t.texto}`;
    if (out.length + bloco.length + 2 > LIMITE_TRECHOS) break;
    out += (out ? "\n\n" : "") + bloco;
  }
  return out;
}
