-- 20261016165218 087_venda_e_card_param_de_girar_em_circulo

-- 087: a venda e o card não podem se criar mutuamente.
--
-- O CICLO: existem dois gatilhos que se olham.
--   vendas → aura_venda_fecha_pipeline: venda registrada move/cria o card em
--            Fechamento.
--   oportunidades → aura_fechar_card_cria_venda: card que entra em
--            Fechamento cria uma venda.
-- Cada um se protege pelo oportunidade_id. Só que a venda do formulário
-- chega SEM esse id, e ele só é preenchido pelo primeiro gatilho — que, ao
-- mover o card, já disparou o segundo antes de a venda original existir na
-- tabela. O segundo não acha venda ligada ao card e cria outra. Foi assim
-- que a Maristela apareceu duas vezes no mesmo segundo.
--
-- Com a 085 (que faz a venda CRIAR o card quando não existe), o ciclo
-- piorava: a segunda venda era recusada pela trava de duplicata, e a
-- transação inteira voltava — inclusive a venda original. Registrar venda
-- pelo formulário passaria a falhar sempre. Esta migração desfaz isso.
--
-- A SAÍDA: uma marca na transação. Quem começou pela venda avisa
-- (set_config com is_local = true, que morre no fim da transação), e o
-- gatilho do card, vendo a marca, não cria uma segunda venda. É o padrão do
-- Postgres para quebrar ciclo de gatilho; nada vaza para outra transação.

create or replace function public.aura_venda_fecha_pipeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op uuid;
begin
  if new.oportunidade_id is not null or new.relacionamento_id is not null then
    -- Avisa o gatilho do card: esta transação já tem a venda; não crie outra.
    perform set_config('aura.venda_em_curso', 'sim', true);

    v_op := public.aura_avancar_oportunidade(
      new.oportunidade_id, new.relacionamento_id, 'fechamento',
      'Venda registrada: ' || to_char(coalesce(new.valor_fechado, new.valor), 'FM999G999G990D00'),
      true);

    if v_op is not null then
      if new.oportunidade_id is null then new.oportunidade_id := v_op; end if;
      update oportunidades
         set valor = case when coalesce(valor, 0) = 0 then coalesce(new.valor_fechado, new.valor) else valor end,
             produto = coalesce(produto, new.produto),
             updated_at = now()
       where id = v_op;
    end if;
  end if;
  if new.relacionamento_id is not null then
    update relacionamentos set temperatura = 'quente', ultimo_contato_em = now(), updated_at = now()
     where id = new.relacionamento_id;
  end if;
  return new;
end;
$$;

create or replace function public.aura_fechar_card_cria_venda()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  etapa_ganho text;
begin
  etapa_ganho := public.aura_etapa_de_ganho(new.empresa);
  if new.etapa is distinct from etapa_ganho then return new; end if;
  if tg_op = 'UPDATE' and old.etapa = etapa_ganho then return new; end if;

  -- A venda é que está fechando este card: ela já existe (está sendo
  -- gravada nesta mesma transação). Criar outra aqui é o ciclo.
  if current_setting('aura.venda_em_curso', true) = 'sim' then return new; end if;

  if exists (select 1 from vendas where oportunidade_id = new.id) then return new; end if;

  insert into vendas (
    owner_id, empresa, cliente, produto,
    valor, valor_original, valor_fechado,
    desconto_valor, desconto_percentual,
    quantidade_parcelas, valor_parcela, entrada_valor, taxa_financeira,
    comissao_base, data, relacionamento_id, oportunidade_id, status,
    parceiro_id, percentual_parceiro
  ) values (
    new.owner_id, new.empresa, new.cliente, new.produto,
    coalesce(new.valor, 0), coalesce(new.valor, 0), coalesce(new.valor, 0),
    0, 0, 1, coalesce(new.valor, 0), 0, 0,
    coalesce(new.valor, 0), current_date, new.relacionamento_id, new.id,
    'aguardando_detalhes',
    case when new.parceiro_id is distinct from new.owner_id then new.parceiro_id end,
    case when new.parceiro_id is not null and new.parceiro_id is distinct from new.owner_id
         then coalesce(new.percentual_parceiro, 50) else 0 end
  );
  return new;
end;
$$;
