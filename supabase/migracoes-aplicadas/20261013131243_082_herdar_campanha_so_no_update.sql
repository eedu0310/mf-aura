-- 20261013131243 082_herdar_campanha_so_no_update

-- Correção da 081: eu havia reimplementado o que já existia.
--
-- O trigger `vendas_estampa_origem` (função estampar_origem_da_venda) já fazia
-- a herança de origem_lead e campanha_id no INSERT, exatamente da mesma forma:
-- primeiro pelo negócio, depois pelo cliente. Eu só descobri porque fui
-- conferir os triggers da tabela depois de criar o meu.
--
-- Duas funções fazendo a mesma coisa no mesmo evento não quebram nada hoje —
-- a segunda vê o campo já preenchido e sai — mas no dia em que a regra mudar,
-- alguém vai corrigir uma e não a outra, e o número vai divergir sem erro.
--
-- Então o INSERT continua inteiramente com a função que já existia, e esta
-- cobre só o buraco que ela não cobria: a venda que é ligada a um negócio
-- DEPOIS de criada, caso em que a campanha nunca era atribuída.

create or replace function public.venda_herda_campanha()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_campanha uuid;
  v_origem public.origem_lead;
begin
  -- Já atribuída (inclusive à mão por alguém): a decisão existente manda.
  if new.campanha_id is not null then
    return new;
  end if;

  if new.oportunidade_id is not null then
    select o.campanha_id, o.origem_lead into v_campanha, v_origem
    from public.oportunidades o where o.id = new.oportunidade_id;
  end if;

  if v_campanha is null and new.relacionamento_id is not null then
    select r.campanha_id, r.origem_lead into v_campanha, v_origem
    from public.relacionamentos r where r.id = new.relacionamento_id;
  end if;

  new.campanha_id := v_campanha;
  if new.origem_lead is null then new.origem_lead := v_origem; end if;

  return new;
end;
$$;

-- Só UPDATE. O INSERT é da estampar_origem_da_venda, que já existia.
create or replace trigger venda_herda_campanha_trg
  before update of oportunidade_id, relacionamento_id on public.vendas
  for each row execute function public.venda_herda_campanha();
