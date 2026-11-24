-- 20261006174630 071_gatilhos_do_fechamento_seguem_o_funil_e_a_dupla

-- 071 — Os gatilhos de fechamento voltam a funcionar (e respeitam a dupla)
--
-- DOIS PROBLEMAS, UM DELES GRAVE.
--
-- 1) GATILHO MORTO. aura_fechar_card_cria_venda e aura_reabrir_card_desfaz_venda
--    comparavam a etapa com o texto literal 'Fechados'. Quando o funil virou
--    editável, a etapa de ganho passou a se chamar 'Fechamento' nas quatro
--    lojas — e os dois gatilhos pararam de disparar, em silêncio. Nenhum erro,
--    nenhum log: a condição simplesmente nunca é verdadeira.
--
--    Na prática a venda continuou nascendo, porque a tela e a IA do WhatsApp
--    criam a venda por conta própria. Mas a rede de segurança do banco estava
--    desligada: um negócio movido por qualquer outro caminho (SQL, importação,
--    uma tela futura) entrava em Fechamento sem gerar venda. E a volta também
--    não funcionava: arrastar o card de volta para Negociação deixava para trás
--    uma venda "aguardando_detalhes" de um negócio que não está mais fechado.
--
--    A correção é a mesma do resto do sistema: perguntar ao funil da loja qual
--    é a etapa de ganho, em vez de carregar o nome dela no código. Assim o
--    gestor pode renomear a etapa quantas vezes quiser sem matar nada.
--
-- 2) A DUPLA PRECISA CHEGAR NA VENDA. O parceiro e o percentual combinados no
--    negócio têm que viajar para a venda, senão o fechamento desfaz a divisão
--    e o colega que entrou junto não recebe nada.

create or replace function public.aura_etapa_de_ganho(p_empresa text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  -- A etapa de ganho da loja. Se a loja ainda não editou o funil, não há linha
  -- em etapas_funil e o padrão do sistema é 'Fechamento' (o mesmo de
  -- FUNIL_PADRAO em src/lib/funil.ts).
  select coalesce(
    (select nome from public.etapas_funil
      where empresa = p_empresa and tipo = 'ganho'
      order by ordem limit 1),
    'Fechamento'
  );
$$;

revoke all on function public.aura_etapa_de_ganho(text) from public, anon;
grant execute on function public.aura_etapa_de_ganho(text) to authenticated, service_role;

create or replace function public.aura_fechar_card_cria_venda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  etapa_ganho text;
begin
  etapa_ganho := public.aura_etapa_de_ganho(new.empresa);

  -- Só age quando o negócio ENTRA na etapa de ganho.
  if new.etapa is distinct from etapa_ganho then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.etapa = etapa_ganho then
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
    comissao_base, data, relacionamento_id, oportunidade_id, status,
    parceiro_id, percentual_parceiro
  ) values (
    new.owner_id, new.empresa, new.cliente, new.produto,
    coalesce(new.valor, 0), coalesce(new.valor, 0), coalesce(new.valor, 0),
    0, 0,
    1, coalesce(new.valor, 0), 0, 0,
    coalesce(new.valor, 0), current_date, new.relacionamento_id, new.id,
    'aguardando_detalhes',
    -- Atendimento em dupla: o parceiro e a divisão combinados no negócio vão
    -- junto. Parceiro igual ao dono é descartado aqui, senão a mesma pessoa
    -- receberia duas fatias da mesma venda.
    case when new.parceiro_id is distinct from new.owner_id then new.parceiro_id end,
    case
      when new.parceiro_id is not null and new.parceiro_id is distinct from new.owner_id
      then coalesce(new.percentual_parceiro, 50)
      else 0
    end
  );

  return new;
end;
$$;

create or replace function public.aura_reabrir_card_desfaz_venda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  etapa_ganho text;
begin
  etapa_ganho := public.aura_etapa_de_ganho(new.empresa);
  if old.etapa = etapa_ganho and new.etapa is distinct from etapa_ganho then
    -- Só a venda que o próprio fechamento criou e que ninguém completou. Uma
    -- venda com os detalhes preenchidos é trabalho de gente e não se apaga
    -- por causa de um card arrastado.
    delete from vendas
     where oportunidade_id = new.id
       and status = 'aguardando_detalhes';
  end if;
  return new;
end;
$$;
