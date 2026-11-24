-- 20261001130720 037b_estampar_origem_sem_campo_dinamico

-- Reescrito: a versao anterior referenciava new.oportunidade_id tambem no
-- trigger de oportunidades, onde esse campo nao existe. Em PL/pgSQL isso
-- estoura em execucao em vez de ser ignorado, o que derrubaria a criacao de
-- qualquer oportunidade. Agora o caminho e escolhido por TG_TABLE_NAME, que e
-- deterministico e nao depende de curto-circuito.
create or replace function public.estampar_origem_do_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.origem_lead;
  c uuid;
begin
  if new.origem_lead is not null then
    return new;
  end if;

  if TG_TABLE_NAME = 'vendas' and new.oportunidade_id is not null then
    select origem_lead, campanha_id into o, c
      from public.oportunidades where id = new.oportunidade_id;
  end if;

  if o is null and new.relacionamento_id is not null then
    select origem_lead, campanha_id into o, c
      from public.relacionamentos where id = new.relacionamento_id;
  end if;

  new.origem_lead := o;
  if new.campanha_id is null then
    new.campanha_id := c;
  end if;
  return new;
end;
$$;
