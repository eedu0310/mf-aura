/**
 * Roda no <head>, antes da página desenhar. Sem isto a tela abriria clara e
 * piscaria para o escuro depois que o React carregasse.
 *
 * Fica fora de components/tema.tsx porque aquele arquivo é "use client": o
 * layout (servidor) não consegue ler uma constante de um módulo de cliente.
 * A chave precisa ser a mesma de lá ("aura-tema").
 *
 * Páginas que o CLIENTE abre (formulário embutido no site /f, landing pages /s,
 * avaliação /av e /avaliar, materiais, privacidade e exclusão de dados) ficam sempre claras: têm o visual da
 * marca, e o modo escuro do celular do visitante não pode trocar as cores delas.
 */
export const CHAVE_DO_TEMA = "aura-tema";

/** A mesma de src/lib/aparencia.ts: a paleta e o fundo que o gestor escolheu,
 *  guardados para a tela já abrir com eles (sem piscar a cor antiga). */
const CHAVE_APARENCIA = "aura-aparencia";

/** Rotas públicas, de cliente, que nunca entram no tema escuro. */
export const ROTAS_SEMPRE_CLARAS = /^\/(f|s|av|avaliar|materiais|privacidade|exclusao-de-dados)(\/|$)/;

/**
 * A porta de entrada (login, primeiro acesso, nova senha) fica sempre com a
 * paleta original: o painel da marca ali é petróleo fixo, e com a paleta do
 * gestor (dourado, marinho, Natal...) o botão e o fundo brigavam com ele.
 * O tema claro/escuro continua valendo.
 */
export const ROTAS_SEM_PALETA = /^\/(login|onboarding|redefinir-senha|limpar)(\/|$)/;

export const SCRIPT_DO_TEMA = `(function(){try{if(${ROTAS_SEMPRE_CLARAS}.test(location.pathname)){document.documentElement.classList.remove("dark");return;}var t=localStorage.getItem("${CHAVE_DO_TEMA}");var e=t==="escuro"||((!t||t==="sistema")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",e);if(${ROTAS_SEM_PALETA}.test(location.pathname))return;var a=JSON.parse(localStorage.getItem("${CHAVE_APARENCIA}")||"null");if(a){var h=document.documentElement;if(/^[a-z]+$/.test(a.p))h.dataset.paleta=a.p;if(/^[a-z]+$/.test(a.f))h.dataset.fundoPipeline=a.f;}}catch(_){}})();`;
