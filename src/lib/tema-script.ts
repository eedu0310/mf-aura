/**
 * Roda no <head>, antes da página desenhar. Sem isto a tela abriria clara e
 * piscaria para o escuro depois que o React carregasse.
 *
 * Fica fora de components/tema.tsx porque aquele arquivo é "use client": o
 * layout (servidor) não consegue ler uma constante de um módulo de cliente.
 * A chave precisa ser a mesma de lá ("aura-tema").
 */
export const CHAVE_DO_TEMA = "aura-tema";

export const SCRIPT_DO_TEMA = `(function(){try{var t=localStorage.getItem("${CHAVE_DO_TEMA}");var e=t==="escuro"||((!t||t==="sistema")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",e);}catch(_){}})();`;
