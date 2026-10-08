-- O painel de custo guardava só o TOTAL de tokens de entrada, somando três
-- fatias de preços muito diferentes: entrada crua (1x), escrita no cache (2x)
-- e leitura do cache (0,1x). Com isso dava para ver quanto se gasta, mas não
-- POR QUE: a média de US$ 1,87 por milhão na análise de WhatsApp só podia ser
-- explicada por dedução. Separando as três, o painel passa a dizer se o cache
-- está sendo lido ou só reescrito.
alter table public.ia_uso
  add column if not exists tokens_entrada_crua bigint not null default 0,
  add column if not exists tokens_cache_escrita bigint not null default 0,
  add column if not exists tokens_cache_leitura bigint not null default 0;

comment on column public.ia_uso.tokens_entrada_crua is
  'Entrada que não passou pelo cache. Preço cheio (1x).';
comment on column public.ia_uso.tokens_cache_escrita is
  'Tokens gravados no cache de prompt. Custa 2x — vale a pena só se forem lidos depois.';
comment on column public.ia_uso.tokens_cache_leitura is
  'Tokens lidos do cache. Custa 0,1x. É aqui que a economia aparece.';
