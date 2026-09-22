import type { Oportunidade, Venda } from "@/lib/types";

export interface Conquista {
  emoji: string;
  titulo: string;
  descricao: string;
  conquistada: boolean;
}

function calcularSequenciaDias(atividades: any[]): number {
  const dias = new Set(
    atividades
      .map((a) => a.criadoEmISO)
      .filter((iso): iso is string => Boolean(iso))
      .map((iso) => iso.slice(0, 10))
  );

  let sequencia = 0;
  const cursor = new Date();
  for (;;) {
    const chave = cursor.toISOString().slice(0, 10);
    if (!dias.has(chave)) break;
    sequencia += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return sequencia;
}

export function computeConquistas({
  vendas,
  oportunidades,
  atividades,
  metaValor,
  metaRealizado,
  posicaoRanking,
}: {
  vendas: Venda[];
  oportunidades: Oportunidade[];
  atividades: any[];
  metaValor: number | null;
  metaRealizado: number;
  posicaoRanking: number | null;
}): Conquista[] {
  const sequenciaDias = calcularSequenciaDias(atividades);
  const paradas = 0;

  const mesAtual = new Date().toISOString().slice(0, 7);
  const mesPassadoDate = new Date();
  mesPassadoDate.setMonth(mesPassadoDate.getMonth() - 1);
  const mesPassado = mesPassadoDate.toISOString().slice(0, 7);
  const vendasEsteMes = vendas.filter((v) => v.data.startsWith(mesAtual)).reduce((s, v) => s + v.valor, 0);
  const vendasMesPassado = vendas.filter((v) => v.data.startsWith(mesPassado)).reduce((s, v) => s + v.valor, 0);

  return [
    {
      emoji: "🔥",
      titulo: "Sequência ativa",
      descricao:
        sequenciaDias >= 5
          ? `${sequenciaDias} dias seguidos registrando atividades`
          : "Registre atividades por 5 dias seguidos",
      conquistada: sequenciaDias >= 5,
    },
    {
      emoji: "🏆",
      titulo: "100 atividades",
      descricao:
        atividades.length >= 100
          ? "Você já registrou 100+ atividades"
          : `${atividades.length} de 100 atividades registradas`,
      conquistada: atividades.length >= 100,
    },
    {
      emoji: "💰",
      titulo: "Primeira venda",
      descricao: vendas.length > 0 ? "Sua primeira venda está registrada" : "Ainda sem vendas registradas",
      conquistada: vendas.length > 0,
    },
    {
      emoji: "📈",
      titulo: "Em crescimento",
      descricao:
        vendasEsteMes > vendasMesPassado
          ? "Vendendo mais este mês que no mês passado"
          : "Vendas deste mês ainda não superaram o mês passado",
      conquistada: vendasEsteMes > vendasMesPassado && vendasMesPassado > 0,
    },
    {
      emoji: "🎯",
      titulo: "Meta batida",
      descricao:
        metaValor && metaRealizado >= metaValor
          ? "Meta do mês alcançada!"
          : metaValor
            ? "Ainda não bateu a meta deste mês"
            : "Defina uma meta em Meu Dia para desbloquear",
      conquistada: Boolean(metaValor && metaRealizado >= metaValor),
    },
    {
      emoji: "👑",
      titulo: "Líder do ranking",
      descricao: posicaoRanking === 1 ? "Você está em 1º lugar!" : "Chegue ao 1º lugar no ranking da equipe",
      conquistada: posicaoRanking === 1,
    },
    {
      emoji: "⭐",
      titulo: "Pipeline em dia",
      descricao:
        paradas === 0 && oportunidades.length > 0
          ? "Nenhuma oportunidade parada"
          : "Mantenha o pipeline sem oportunidades paradas há 7+ dias",
      conquistada: paradas === 0 && oportunidades.length > 0,
    },
  ];
}
