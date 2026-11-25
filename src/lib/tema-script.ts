/**
 * Roda no <head>, antes da página desenhar. Sem isto a tela abriria clara e
 * piscaria para o escuro depois que o React carregasse.
 *
 * Fica fora de components/tema.tsx porque aquele arquivo é "use client": o
 * layout (servidor) não consegue ler uma constante de um módulo de cliente.
 * A chave precisa ser a mesma de lá ("aura-tema").
 *
 * Páginas que o CLIENTE abre (formulário embutido no site /f, landing pages /s,
 * avaliação /av e /avaliar, materiais) ficam sempre claras: têm o visual da
 * marca, e o modo escuro do celular do visitante não pode trocar as cores delas.
 */
export const CHAVE_DO_TEMA = "aura-tema";

/** Rotas públicas, de cliente, que nunca entram no tema escuro. */
export const ROTAS_SEMPRE_CLARAS = /^\/(f|s|av|avaliar|materiais)(\/|$)/;

export const SCRIPT_DO_TEMA = `(function(){try{if(${ROTAS_SEMPRE_CLARAS}.test(location.pathname)){document.documentElement.classList.remove("dark");return;}var t=localStorage.getItem("${CHAVE_DO_TEMA}");var e=t==="escuro"||((!t||t==="sistema")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",e);}catch(_){}})();`;
