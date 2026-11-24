-- 20261005143448 067_chave_semantica_da_etapa

-- A etapa precisa de um NOME e de um PAPEL, e eles sao coisas diferentes.
--
-- O gestor renomeia "Proposta" para "Follow-up" e o codigo nao pode quebrar.
-- Hoje ele compara o nome em 86 lugares -- etapa = 'Fechados' decide se a
-- venda do mes entra, etapa = 'Perdidos' decide se o negocio morreu, e a
-- ordem do funil esta escrita na mao. Nome e o que o vendedor le; papel e o
-- que o sistema decide.
--
-- "tipo" ja dava o papel grosso (aberta, ganho, perda, posvenda). Falta o
-- papel FINO, para as regras que leem a conversa saberem a que etapa levar um
-- "me manda o orcamento": isso e a chave.
--
-- ETAPA NOVA, criada pelo gestor, NASCE SEM CHAVE -- e isso e de proposito. A
-- IA e as regras automaticas nunca movem um negocio para uma etapa que nao
-- sabem o que significa; quem move e o vendedor. Melhor a etapa nova ficar
-- esperando a mao humana do que receber card por adivinhacao.
alter table public.etapas_funil
  add column if not exists chave text;

comment on column public.etapas_funil.chave is
  'Papel fino da etapa para as regras automaticas (prospeccao, qualificacao, apresentacao, followup, negociacao, fechamento, posvenda, perda). Nulo = so o vendedor move cards para ca.';

update public.etapas_funil set chave = case nome
  when 'Prospecção' then 'prospeccao'
  when 'Qualificação e Abordagem' then 'qualificacao'
  when 'Apresentação' then 'apresentacao'
  when 'Follow-up' then 'followup'
  when 'Negociação' then 'negociacao'
  when 'Fechamento' then 'fechamento'
  when 'Pós-venda' then 'posvenda'
  when 'Perdidos' then 'perda'
  else chave end
where chave is null;

-- Duas etapas com a mesma chave na mesma loja deixaria o sistema sem saber
-- qual delas registra a venda.
create unique index if not exists etapas_funil_chave_unica
  on public.etapas_funil (empresa, chave) where chave is not null;
