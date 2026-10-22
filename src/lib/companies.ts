export interface Empresa {
  id: string;
  nome: string;
  tipo: "Fábrica" | "Loja";
}

export const EMPRESAS: Empresa[] = [
  { id: "mf", nome: "MF International", tipo: "Fábrica" },
  { id: "lf", nome: "LF Lareiras", tipo: "Loja" },
  { id: "ag", nome: "A&G Aquecimento", tipo: "Loja" },
  { id: "sole", nome: "Sole Aquecimento", tipo: "Loja" },
];

export const NOMES_EMPRESAS = EMPRESAS.map((e) => e.nome);

/**
 * O que o grupo vende. Vai nos prompts da IA, do supervisor ao coach.
 *
 * Antes os prompts diziam "empresa de lareiras, churrasqueiras e aquecimento"
 * e a IA tratava piso aquecido, aquecedor de piscina ou boiler como "assunto
 * fora do nosso ramo": não classificava o lead e avisava o vendedor que ele
 * estava fugindo do segmento. Lista aqui, um lugar só; quem acrescentar um
 * segmento novo acrescenta nesta lista e todos os prompts passam a saber.
 */
export const SEGMENTOS_DO_GRUPO = [
  "lareiras MF de alto rendimento (embutidas, expostas, suspensas, de canto, dupla face)",
  "lareiras e estufas a pellet",
  "outras lareiras e calefatores (a gás, elétricas, bioetanol)",
  "fogões a lenha (La Nordica, Guindani)",
  "linha gourmet: fornos de pizza, braseiros, parrillas, churrasqueiras Scheer, grills Titan, De Bacco",
  "piso aquecido (elétrico e hidráulico)",
  "toalheiros elétricos (Aquece, Seccare)",
  "aquecimento de água: bomba de calor, solar, piscina, aquecedores de passagem e boilers",
  "chaminés e tubulações prediais MF para construtoras",
  "projeto, instalação e manutenção de tudo isso",
] as const;

export const SEGMENTOS_EM_UMA_LINHA = SEGMENTOS_DO_GRUPO.join("; ");
