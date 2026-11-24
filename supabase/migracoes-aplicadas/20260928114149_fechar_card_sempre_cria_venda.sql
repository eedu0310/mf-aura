-- 20260928114149 fechar_card_sempre_cria_venda

-- Fechar um negócio tem três caminhos na tela: arrastar o card, editar a
-- etapa na ficha, e criar a oportunidade já como "Fechados". Só o arraste
-- criava a venda. Resultado: três negócios do Charles (R$ 24.132) estavam
-- fechados no funil e não existiam em vendas — o mês não fechava, o ranking
-- não mexia e o faturamento marcava zero.
--
-- A regra passa a viver no banco, onde nenhum caminho escapa dela: nem a
-- tela, nem a AURA, nem uma importação futura.

create or replace function aura_fechar_card_cria_venda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Só age quando o negócio ENTRA em Fechados.
  if new.etapa is distinct from 'Fechados' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.etapa = 'Fechados' then
    return new;
  end if;

  -- Já existe venda para este negócio? Então o vendedor registrou pela tela
  -- de Vendas, com os dados completos. Não duplicar.
  if exists (select 1 from vendas where oportunidade_id = new.id) then
    return new;
  end if;

  insert into vendas (
    owner_id, empresa, cliente, produto,
    valor, valor_original, valor_fechado,
    desconto_valor, desconto_percentual,
    quantidade_parcelas, valor_parcela, entrada_valor, taxa_financeira,
    comissao_base, data, relacionamento_id, oportunidade_id, status
  ) values (
    new.owner_id, new.empresa, new.cliente, new.produto,
    coalesce(new.valor, 0), coalesce(new.valor, 0), coalesce(new.valor, 0),
    0, 0,
    1, coalesce(new.valor, 0), 0, 0,
    coalesce(new.valor, 0), current_date, new.relacionamento_id, new.id,
    'aguardando_detalhes'
  );

  return new;
end;
$$;

drop trigger if exists trg_aura_fechar_card_cria_venda on oportunidades;
create trigger trg_aura_fechar_card_cria_venda
  after insert or update of etapa on oportunidades
  for each row execute function aura_fechar_card_cria_venda();

revoke execute on function public.aura_fechar_card_cria_venda() from public, anon, authenticated;

-- Tirar o negócio de Fechados desfaz a venda que o próprio fechamento criou.
-- Só a que ainda está "aguardando_detalhes": se alguém já preencheu forma de
-- pagamento, comissão ou parcelas, aquilo é trabalho humano e fica.
create or replace function aura_reabrir_card_desfaz_venda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.etapa = 'Fechados' and new.etapa is distinct from 'Fechados' then
    delete from vendas
     where oportunidade_id = new.id
       and status = 'aguardando_detalhes';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_aura_reabrir_card_desfaz_venda on oportunidades;
create trigger trg_aura_reabrir_card_desfaz_venda
  after update of etapa on oportunidades
  for each row execute function aura_reabrir_card_desfaz_venda();

revoke execute on function public.aura_reabrir_card_desfaz_venda() from public, anon, authenticated;
