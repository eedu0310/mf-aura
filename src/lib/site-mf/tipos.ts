/**
 * Site MF: formulários e páginas de captura (LPs) feitos dentro da AURA.
 *
 * Substitui os formulários e as LPs do Bitrix. O que alguém preenche vira
 * lead na fila da loja (leads_recebidos) e segue o caminho de todo lead:
 * distribuição, resposta, pipeline. Esta área é só da MF International; o
 * código é por loja para não precisar ser reescrito se outra loja quiser.
 */

export const EMPRESA_DO_SITE = "MF International";

export const TIPOS_DE_CAMPO = ["texto", "telefone", "email", "cidade", "selecao", "area", "caixa"] as const;
export type TipoCampo = (typeof TIPOS_DE_CAMPO)[number];

export const ROTULO_DO_TIPO: Record<TipoCampo, string> = {
  texto: "Texto curto",
  telefone: "WhatsApp / telefone",
  email: "E-mail",
  cidade: "Cidade",
  selecao: "Lista de opções",
  area: "Texto longo",
  caixa: "Caixa de marcar",
};

export interface CampoFormulario {
  chave: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio: boolean;
  opcoes?: string[];
}

export interface Formulario {
  id: string;
  empresa: string;
  nome: string;
  slug: string;
  titulo: string | null;
  descricao: string | null;
  campos: CampoFormulario[];
  botao_texto: string;
  mensagem_sucesso: string;
  material_nome: string | null;
  material_url: string | null;
  cor: string;
  ativo: boolean;
  /** lead: vira lead e vai para a fila de vendas. cliente: já é cliente/parceiro, não vira lead. */
  destino: "lead" | "cliente";
  /** Foto de fundo da página do formulário (/f/endereço). */
  imagem_fundo?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const TIPOS_DE_BLOCO = ["hero", "texto", "beneficios", "imagem", "video", "formulario", "chamada"] as const;
export type TipoBloco = (typeof TIPOS_DE_BLOCO)[number];

export const ROTULO_DO_BLOCO: Record<TipoBloco, string> = {
  hero: "Capa (título grande + imagem)",
  texto: "Texto",
  beneficios: "Lista de vantagens",
  imagem: "Imagem",
  video: "Vídeo do YouTube",
  formulario: "Formulário",
  chamada: "Chamada para ação",
};

/**
 * Um bloco da página. Os campos opcionais servem a tipos diferentes; o
 * editor mostra só os que o tipo usa.
 */
export interface Bloco {
  id: string;
  tipo: TipoBloco;
  titulo?: string;
  subtitulo?: string;
  texto?: string;
  imagem?: string;
  legenda?: string;
  video?: string;
  botao?: string;
  link?: string;
  itens?: { titulo: string; texto: string }[];
}

export interface Pagina {
  id: string;
  empresa: string;
  titulo: string;
  slug: string;
  blocos: Bloco[];
  formulario_id: string | null;
  cor: string;
  tema: "escuro" | "claro";
  seo_titulo: string | null;
  seo_descricao: string | null;
  publicada: boolean;
  created_at?: string;
  updated_at?: string;
}

/** "Catálogo MF 2025!" → "catalogo-mf-2025" */
export function paraSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function slugValido(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,60}$/.test(slug);
}

export function novoId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const CAMPOS_PADRAO: CampoFormulario[] = [
  { chave: "nome", rotulo: "Nome", tipo: "texto", obrigatorio: true },
  { chave: "telefone", rotulo: "WhatsApp", tipo: "telefone", obrigatorio: true },
  { chave: "email", rotulo: "E-mail", tipo: "email", obrigatorio: false },
  { chave: "cidade", rotulo: "Cidade", tipo: "cidade", obrigatorio: true },
  {
    chave: "perfil",
    rotulo: "Você é",
    tipo: "selecao",
    obrigatorio: false,
    opcoes: ["Cliente final", "Arquiteto(a)", "Construtora", "Revendedor"],
  },
];

export function blocoNovo(tipo: TipoBloco): Bloco {
  const id = novoId();
  switch (tipo) {
    case "hero":
      return { id, tipo, titulo: "Título da página", subtitulo: "Uma frase que diz o que a pessoa ganha.", botao: "Quero receber" };
    case "texto":
      return { id, tipo, titulo: "Título da seção", texto: "Escreva aqui." };
    case "beneficios":
      return {
        id,
        tipo,
        titulo: "Por que a MF",
        itens: [
          { titulo: "Tripla combustão", texto: "Mais calor com menos lenha." },
          { titulo: "Desde 1977", texto: "Fábrica própria em São Sebastião do Caí." },
          { titulo: "Vidro cerâmico 5 mm", texto: "Autolimpante, em todos os modelos." },
        ],
      };
    case "imagem":
      return { id, tipo, imagem: "", legenda: "" };
    case "video":
      return { id, tipo, titulo: "", video: "" };
    case "formulario":
      return { id, tipo, titulo: "" };
    case "chamada":
      return { id, tipo, titulo: "Fale com a nossa equipe", botao: "Chamar no WhatsApp", link: "https://wa.me/555135361422" };
  }
}

/** Campo que vira nome/telefone/e-mail/cidade/perfil no lead. */
export function valorDoTipo(campos: CampoFormulario[], dados: Record<string, unknown>, tipo: TipoCampo): string | null {
  const campo = campos.find((c) => c.tipo === tipo);
  if (!campo) return null;
  const v = dados[campo.chave];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Id do vídeo do YouTube a partir de qualquer link comum dele. */
export function idDoYoutube(link: string | undefined): string | null {
  if (!link) return null;
  const m =
    /youtu\.be\/([\w-]{6,})/.exec(link) ||
    /[?&]v=([\w-]{6,})/.exec(link) ||
    /youtube\.com\/(?:embed|shorts)\/([\w-]{6,})/.exec(link);
  return m ? m[1] : null;
}
