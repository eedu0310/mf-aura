function normalizar(texto?: string | null) {
  return (texto ?? "").trim().toLowerCase();
}

export function rotaInicial(cargo?: string | null) {
  const c = normalizar(cargo);
  if (c === "pós-venda" || c === "pos-venda") return "/pos-venda";
  if (c === "sdr") return "/leads";
  if (c === "vendedor interno") return "/leads";
  if (c === "marketing") return "/marketing";
  return "/meu-dia";
}
