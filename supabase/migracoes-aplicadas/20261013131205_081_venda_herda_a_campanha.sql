-- 20261013131205 081_venda_herda_a_campanha

-- A venda herda a campanha do negócio (ou do cliente) que a originou.
--
-- POR QUE NO BANCO E NÃO NO CÓDIGO: existe mais de um caminho para uma venda
-- nascer — o registro manual pelo vendedor, o fechamento pelo pipeline, a
-- importação. Preencher em cada tela significa lembrar de todas, hoje e nas
-- próximas; esquecer uma faz o marketing perder vendas que ele gerou, sem
-- erro nenhum aparecer. Aqui é um lugar só, e vale para qualquer caminho.
--
-- Só PREENCHE o que está vazio: se alguém atribuir a venda a outra campanha
-- na mão, a decisão da pessoa manda.

create or replace function public.venda_herda_campanha()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_campanha uuid;
  v_origem text;
begin
  if new.campanha_id is not null and new.origem_lead is not null then
    return new;
  end if;

  -- O negócio é a fonte mais confiável: é dele que a venda saiu.
  if new.oportunidade_id is not null then
    select o.campanha_id, o.origem_lead into v_campanha, v_origem
    from public.oportunidades o where o.id = new.oportunidade_id;
  end if;

  -- Sem negócio ligado, vale a origem do cliente na carteira.
  if v_campanha is null and new.relacionamento_id is not null then
    select r.campanha_id, r.origem_lead into v_campanha, v_origem
    from public.relacionamentos r where r.id = new.relacionamento_id;
  end if;

  if new.campanha_id is null then new.campanha_id := v_campanha; end if;
  if new.origem_lead is null then new.origem_lead := v_origem; end if;

  return new;
end;
$$;

create or replace trigger venda_herda_campanha_trg
  before insert or update of oportunidade_id, relacionamento_id on public.vendas
  for each row execute function public.venda_herda_campanha();
