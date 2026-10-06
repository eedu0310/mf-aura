-- 070c — A divisão combinada viaja com o atendimento
--
-- Em 070 o percentual só existia na venda. Na prática a dupla combina a
-- divisão quando o atendimento é repassado, não no momento de fechar: se o
-- percentual só nascesse na venda, alguém teria que lembrar de digitá-lo no
-- fechamento e o padrão seria sempre "tudo para o dono" — ou seja, o
-- atendimento em dupla existiria sem dividir dinheiro, que é justamente o que
-- faltava.
--
-- Então o percentual acompanha o cliente e o negócio, e a venda só herda.
--
-- Padrão 50: foi assim que o caso chegou ("dividir o valor entre os dois").
-- Quem quiser outra divisão muda na tela.

alter table public.relacionamentos
  add column if not exists percentual_parceiro numeric(5,2) not null default 50;

alter table public.oportunidades
  add column if not exists percentual_parceiro numeric(5,2) not null default 50;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'relacionamentos_percentual_parceiro_faixa') then
    alter table public.relacionamentos
      add constraint relacionamentos_percentual_parceiro_faixa
      check (percentual_parceiro >= 0 and percentual_parceiro <= 100);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'oportunidades_percentual_parceiro_faixa') then
    alter table public.oportunidades
      add constraint oportunidades_percentual_parceiro_faixa
      check (percentual_parceiro >= 0 and percentual_parceiro <= 100);
  end if;
end $$;
