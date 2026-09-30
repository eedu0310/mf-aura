"use client";

import { useEffect, useState } from "react";

/**
 * O que esta pessoa pode, para o menu decidir o que mostrar.
 *
 * O perfil da sessão traz nome, loja e cargo, mas não as permissões — elas
 * vivem na tabela e mudam quando o gestor liga uma chave. Buscar aqui é
 * barato porque a resposta fica guardada enquanto a aba estiver aberta:
 * uma consulta por carregamento, não uma por navegação.
 *
 * Isto é conveniência de menu, nunca segurança: quem decide de verdade é a
 * rota, que confere a permissão no servidor. Esconder o item só evita que a
 * pessoa clique num lugar que vai recusá-la.
 */
export interface MeuAcesso {
  permissoes: Record<string, boolean>;
  cargo: string;
  gestorMestre: boolean;
}

const VAZIO: MeuAcesso = { permissoes: {}, cargo: "", gestorMestre: false };

let emCache: Promise<MeuAcesso> | null = null;

function buscar(): Promise<MeuAcesso> {
  emCache ??= fetch("/api/meu-acesso", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : VAZIO))
    .then((d) => ({
      permissoes: (d?.permissoes ?? {}) as Record<string, boolean>,
      cargo: String(d?.cargo ?? ""),
      gestorMestre: Boolean(d?.gestorMestre),
    }))
    .catch(() => VAZIO);
  return emCache;
}

export function usarMeuAcesso(): MeuAcesso {
  const [acesso, setAcesso] = useState<MeuAcesso>(VAZIO);
  useEffect(() => {
    let vivo = true;
    void buscar().then((a) => {
      if (vivo) setAcesso(a);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return acesso;
}

/** Depois de o gestor mexer numa chave, a próxima leitura vem fresca. */
export function esquecerMeuAcesso() {
  emCache = null;
}
