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
