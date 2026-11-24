-- 20260929132427 apagar_card_fechado_leva_a_venda

-- Apagar o card fechado leva junto a venda que o fechamento criou.
--
-- A chave estrangeira era ON DELETE SET NULL: o vendedor apagava a
-- oportunidade e a venda continuava lá, somando no faturamento do mês, sem
-- card nenhum apontando para ela. Ele achava que tinha apagado. Foi assim
-- que sobrou uma venda órfã na base.
--
-- A regra é a mesma do card que sai de Fechados: some a venda que o próprio
-- fechamento criou, e só enquanto ninguém completou os dados dela. Venda com
-- detalhes preenchidos é dinheiro que alguém conferiu — essa fica, e apenas
-- perde o vínculo, como antes.
create or replace function aura_apagar_card_leva_a_venda()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from vendas
   where oportunidade_id = old.id
     and status = 'aguardando_detalhes';
  return old;
end;
$$;

drop trigger if exists trg_aura_apagar_card_leva_a_venda on oportunidades;
create trigger trg_aura_apagar_card_leva_a_venda
  before delete on oportunidades
  for each row execute function aura_apagar_card_leva_a_venda();
