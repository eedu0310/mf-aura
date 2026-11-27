-- 119 — A venda lançada depois do link de avaliação adota o pedido que já existe
-- (27/11/2026).
--
-- Desde a 27/11 a AURA conta o link de avaliação que o vendedor manda na
-- conversa; se o cliente ainda não tinha venda, nasce um pedido sem venda.
-- Quando a venda é lançada depois (Jociane → Flávio: link às 10:54, venda às
-- 10:58), o gatilho da venda criava um SEGUNDO pedido, vazio, e o cliente
-- aparecia como "falta pedir avaliação" no Meu Dia.
--
-- Agora: venda nova procura um pedido sem venda da mesma loja e do mesmo
-- telefone (últimos 8 dígitos, até 90 dias) e fica com ele. Não achando, cria
-- como antes.

create or replace function public.aura_criar_pedido_avaliacao()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  v_cliente text;
  v_telefone text;
  v_fim text;
  v_orfao uuid;
begin
  select r.nome, r.telefone into v_cliente, v_telefone
  from relacionamentos r where r.id = new.relacionamento_id;

  v_fim := right(regexp_replace(coalesce(v_telefone, ''), '\D', '', 'g'), 8);
  if length(v_fim) = 8 then
    select p.id into v_orfao
      from pedidos_avaliacao p
     where p.venda_id is null
       and p.empresa = new.empresa
       and right(regexp_replace(coalesce(p.telefone, ''), '\D', '', 'g'), 8) = v_fim
       and p.criado_em >= now() - interval '90 days'
     order by p.criado_em desc
     limit 1;
  end if;

  if v_orfao is not null then
    update pedidos_avaliacao
       set venda_id = new.id,
           cliente = coalesce(v_cliente, new.cliente, cliente)
     where id = v_orfao;
  else
    insert into pedidos_avaliacao (venda_id, vendedor_id, empresa, cliente, telefone)
    values (new.id, new.owner_id, new.empresa, coalesce(v_cliente, new.cliente), v_telefone);
  end if;
  return new;
end;
$$;

-- O caso que já aconteceu: o pedido vazio da venda passa a venda para o
-- pedido do envio e sai (nada nele foi marcado: sem envio, abertura ou avaliação).
with par as (
  select vazio.id as vazio_id, vazio.venda_id, orfao.id as orfao_id
    from pedidos_avaliacao vazio
    join pedidos_avaliacao orfao
      on orfao.venda_id is null
     and orfao.empresa = vazio.empresa
     and orfao.enviado_em is not null
     and right(regexp_replace(coalesce(orfao.telefone, ''), '\D', '', 'g'), 8)
       = right(regexp_replace(coalesce(vazio.telefone, ''), '\D', '', 'g'), 8)
     and length(right(regexp_replace(coalesce(vazio.telefone, ''), '\D', '', 'g'), 8)) = 8
     and orfao.criado_em <= vazio.criado_em
   where vazio.venda_id is not null
     and vazio.enviado_em is null and vazio.aberto_em is null and vazio.confirmado_em is null
     and vazio.criado_em >= '2026-11-27'
), apagados as (
  delete from pedidos_avaliacao d using par where d.id = par.vazio_id
  returning par.venda_id, par.orfao_id
)
update pedidos_avaliacao p set venda_id = a.venda_id from apagados a where p.id = a.orfao_id;
