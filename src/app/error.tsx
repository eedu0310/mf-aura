"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { AuraLogoFull } from "@/components/aura-logo";
import { classeBotao } from "@/components/ui";

/**
 * Rede de segurança de TODAS as telas (fica abaixo do layout raiz).
 *
 * Sem ela, um erro de renderização em qualquer componente derrubava o app
 * inteiro na tela branca "Application error" do Next, sem botão nenhum — a
 * pessoa achava que o sistema tinha caído e ficava recarregando.
 *
 * "Tentar de novo" refaz só a tela. "Recarregar" é para o caso mais comum
 * depois de um deploy: o navegador pede um pedaço de código da versão antiga
 * que já não existe (ChunkLoadError), e só baixar a página de novo resolve.
 *
 * Usa <a> e não <Link> no "Ir para o início": se o problema é o código do
 * navegador, a navegação interna do Next cairia no mesmo erro.
 */
export default function ErroDaTela({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[tela] erro de renderização:", error);
  }, [error]);

  const versaoVelha = error?.name === "ChunkLoadError" || /Loading (CSS )?chunk/i.test(error?.message ?? "");

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-aura-bg px-6 py-12 text-center">
      <div className="mb-8">
        <AuraLogoFull />
      </div>
      <div className="aura-card w-full max-w-sm p-6 sm:p-7">
        <AlertTriangle size={28} className="mx-auto text-aura-warning" aria-hidden />
        <h1 className="mt-3 font-display text-lg font-semibold text-aura-graphite">
          {versaoVelha ? "Saiu uma versão nova da AURA" : "Algo deu errado nesta tela"}
        </h1>
        <p className="mt-1.5 text-sm text-aura-graphite-soft">
          {versaoVelha
            ? "Recarregue a página para pegar a versão atual. Nada do que você salvou se perdeu."
            : "Nada do que você já salvou se perdeu. Tente de novo; se continuar, recarregue a página ou volte para o início."}
        </p>
        {error?.digest && <p className="mt-2 font-data text-[0.7rem] text-aura-graphite-soft">Código: {error.digest}</p>}
        <div className="mt-5 flex flex-col gap-2">
          {!versaoVelha && (
            <button type="button" onClick={() => retry()} className={classeBotao("primario", "md", "w-full justify-center")}>
              <RotateCw size={15} />
              Tentar de novo
            </button>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={classeBotao(versaoVelha ? "primario" : "secundario", "md", "w-full justify-center")}
          >
            Recarregar a página
          </button>
          <a href="/meu-dia" className={classeBotao("fantasma", "md", "w-full justify-center")}>
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}
