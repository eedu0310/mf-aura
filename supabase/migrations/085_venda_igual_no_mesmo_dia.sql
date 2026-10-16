-- 085: a mesma venda não pode entrar duas vezes.
--
-- O QUE ACONTECEU: a Tatiane apareceu com 7 vendas que eram 3 ou 4. Maristela
-- três vezes, Innacio duas, Nicolas duas — linhas idênticas em cliente, valor
-- e data. A tela de Vendas somava R$ 78.500 e a AURA dizia R$ 43.000, porque
-- cada uma contava as duplicatas de um jeito.
--
-- POR QUÊ: existem três caminhos que gravam venda — o formulário de
-- atividade, arrastar o card para Fechamento no pipeline, e a AURA quando
-- detecta no WhatsApp que fechou. A proteção que existia comparava só o
-- oportunidade_id. Venda registrada pelo formulário não tem esse id, então
-- passava sempre, e os outros dois nunca a enxergavam.
--
-- A REGRA: mesmo vendedor, mesmo cliente, mesmo valor fechado, mesmo dia =
-- mesma venda. Vale para os três caminhos e para qualquer quarto que venha a
-- existir, porque mora no banco e não em cada tela.
--
-- O QUE ELA NÃO COBRE, de propósito: duas vendas DIFERENTES para o mesmo
-- cliente no mesmo dia com o MESMO valor (duas lareiras iguais). É raro a
-- ponto de não justificar deixar passar o caso comum; quem precisar, registra
-- com produto diferente ou em dias diferentes. Está dito na mensagem de erro.

create or replace function public.impedir_venda_igual_no_dia()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_existente uuid;
begin
  -- Mesmo cliente: pelo cadastro quando há, pelo nome quando não há.
  select v.id into v_existente
  from public.vendas v
  where v.owner_id = new.owner_id
    and v.data = new.data
    and coalesce(v.valor_fechado, v.valor) = coalesce(new.valor_fechado, new.valor)
    and (
      (new.relacionamento_id is not null and v.relacionamento_id = new.relacionamento_id)
      or (new.relacionamento_id is null and lower(trim(v.cliente)) = lower(trim(new.cliente)))
    )
    and v.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  limit 1;

  if v_existente is not null then
    raise exception
      'Este cliente já tem uma venda igual registrada hoje (mesmo valor). Se for outra venda, use produto ou data diferente.'
      using errcode = '23505';
  end if;

  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- Ordem dos gatilhos BEFORE INSERT: o Postgres dispara em ordem alfabética
-- de nome. A trava de duplicata precisa rodar ANTES de qualquer gatilho que
-- crie negócio ou notificação, senão o banco faz trabalho (e manda aviso)
-- para uma venda que vai ser recusada logo em seguida. O rollback desfaria
-- o dado, mas não o barulho. Por isso o nome começa com "trg_0_".
create or replace trigger trg_0_impedir_venda_igual_no_dia
  before insert on public.vendas
  for each row execute function public.impedir_venda_igual_no_dia();

-- ---------------------------------------------------------------------------
-- VENDA SEM NEGÓCIO NO PIPELINE.
--
-- O gatilho aura_venda_fecha_pipeline chamava aura_avancar_oportunidade com
-- p_criar_se_nao_existir = FALSE. Cliente sem negócio aberto → a venda entra
-- e o pipeline fica como estava. Foi assim que a Tatiane ficou com três
-- vendas na aba Vendas e uma só no pipeline, e o gestor sem saber em qual
-- número acreditar. E quando o negócio era criado, nascia com valor 0.
--
-- Agora: cria se não existir, já em Fechamento, com o valor e o produto da
-- venda, e grava o oportunidade_id de volta na venda. BEFORE, e não AFTER,
-- justamente para poder escrever em new.oportunidade_id.
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
    v_op := public.aura_avancar_oportunidade(
      new.oportunidade_id, new.relacionamento_id, 'fechamento',
      'Venda registrada: ' || to_char(coalesce(new.valor_fechado, new.valor), 'FM999G999G990D00'),
      true);

    if v_op is not null then
      if new.oportunidade_id is null then new.oportunidade_id := v_op; end if;
      -- Negócio criado agora nasce com valor 0; o da venda é o valor real.
      -- Só preenche o que está vazio: valor que o vendedor já tinha posto
      -- no card não é sobrescrito.
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

-- create or replace troca a definição inteira, inclusive AFTER → BEFORE.
create or replace trigger trg_aura_venda_fecha_pipeline
  before insert on public.vendas
  for each row execute function public.aura_venda_fecha_pipeline();
