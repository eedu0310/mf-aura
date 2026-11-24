-- 20261013132931 084_ficha_do_relacionamento

-- Informações do CADASTRO, não do negócio.
--
-- A coluna `observacao` já existia e nenhuma tela a usava: o campo estava
-- no banco e ninguém conseguia preencher. Faltavam endereço e responsável —
-- "falei com o Joãozinho, que é quem resolve no escritório" é a anotação que
-- some hoje e some junto com a pessoa que atendeu.
--
-- cidade e estado já existem e continuam onde estão.
alter table public.relacionamentos
  add column if not exists endereco text,
  add column if not exists responsavel text;

comment on column public.relacionamentos.observacao is
  'Anotações livres sobre o cadastro (o escritório, o jeito de trabalhar, o histórico). Não confundir com a descrição do negócio, que mora em oportunidades.';
comment on column public.relacionamentos.responsavel is
  'Quem resolve do lado do cliente: o arquiteto titular, o comprador, o mestre de obra.';
