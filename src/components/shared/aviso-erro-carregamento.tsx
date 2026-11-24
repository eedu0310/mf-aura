"use client";

import { RefreshCw } from "lucide-react";
import { useAppData } from "@/lib/app-data-context";
import { Alerta, Botao } from "@/components/ui";

/**
 * Faixa que aparece quando a leitura do banco falhou.
 *
 * Sem ela, uma falha (RLS, rede, sessão vencida) virava lista vazia — e o
 * vendedor via "nenhum cliente" sem saber que era erro, não carteira vazia.
 */
export function AvisoErroCarregamento() {
  const { erroCarregamento, recarregar } = useAppData();
  if (!erroCarregamento) return null;

  return (
    <div role="alert" className="mx-4 mt-3 sm:mx-6">
      <Alerta
        tom="atencao"
        titulo={<>{erroCarregamento} Os números desta tela podem estar incompletos.</>}
        acao={
          <Botao tamanho="sm" icone={RefreshCw} onClick={recarregar}>
            Tentar de novo
          </Botao>
        }
      />
    </div>
  );
}
