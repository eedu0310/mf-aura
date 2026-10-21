-- 091: negócio só entra em Negociação ou Fechamento com valor.
--
-- Pedido de 21/10: "não adianta ter vários leads em negociação sem valor".
-- Havia 17 em Negociação com R$ 0, e a previsão do mês do gestor não valia.
--
-- 1. Trava no banco: INSERT ou UPDATE que leve o card para uma etapa de
--    chave 'negociacao' ou 'fechamento' com valor zero é recusado (23514),
--    com mensagem para o vendedor. Só dispara quando a etapa ou o valor
--    mudam: os 17 cards que já estão lá continuam editáveis (nome, produto)
--    e são cobrados à parte.
-- 2. Exceção: o lançamento de uma VENDA. O gatilho da venda move o card
--    para Fechamento e grava o valor logo em seguida, na mesma transação, e
--    marca isso com a bandeira aura.venda_em_curso (migração 087).
-- 3. A automação por atividade (aura_avancar_oportunidade) não tenta mais
--    mover card sem valor para essas etapas: avisa o vendedor e deixa o card
--    onde está. Sem isso, registrar uma atividade que falasse em "desconto"
--    num cliente com card em R$ 0 faria a atividade inteira falhar.

create or replace function public.oportunidade_exige_valor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chave text;
begin
  if coalesce(current_setting('aura.venda_em_curso', true), '') = 'sim' then
    return new;
  end if;
  v_chave := coalesce(public.aura_chave_da_etapa(new.empresa, new.etapa), '');
  if v_chave not in ('negociacao', 'fechamento') then
    return new;
  end if;
  if coalesce(new.valor, 0) > 0 then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.etapa is not distinct from old.etapa and new.valor is not distinct from old.valor then
    return new;
  end if;
  raise exception 'Informe o valor do negócio antes de colocá-lo em %.', new.etapa
    using errcode = '23514',
          hint = 'A partir da Negociação o negócio precisa ter valor estimado.';
end;
$$;

revoke execute on function public.oportunidade_exige_valor() from public, anon, authenticated;

create or replace trigger trg_oportunidade_exige_valor
  before insert or update on public.oportunidades
  for each row execute function public.oportunidade_exige_valor();

create or replace function public.aura_avancar_oportunidade(p_oportunidade_id uuid, p_relacionamento_id uuid, p_etapa text, p_motivo text, p_criar_se_nao_existir boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  op record;
  rel record;
  nova_id uuid;
  v_empresa text;
  nome_alvo text;
  chave_atual text;
  -- coalesce é obrigatório: sem a bandeira ligada, current_setting devolve
  -- NULL, e "not NULL" não é verdadeiro — a trava seria pulada em silêncio
  -- (pego no teste de 21/10).
  em_venda boolean := coalesce(current_setting('aura.venda_em_curso', true), '') = 'sim';
begin
  if p_oportunidade_id is not null then
    select * into op from oportunidades where id = p_oportunidade_id;
  elsif p_relacionamento_id is not null then
    -- "Negócio ainda aberto" tem que ser perguntado à loja: as etapas de ganho
    -- e de perda têm nome escolhido pelo gestor.
    select o.* into op
      from oportunidades o
     where o.relacionamento_id = p_relacionamento_id
       and coalesce(public.aura_chave_da_etapa(o.empresa, o.etapa), '') not in ('fechamento', 'perda')
     order by o.updated_at desc nulls last, o.created_at desc
     limit 1;
  end if;

  if op.id is null then
    if not p_criar_se_nao_existir or p_relacionamento_id is null then return null; end if;
    -- Card novo nasce com valor 0: só pode nascer em Negociação/Fechamento
    -- quando é a venda que está criando (ela grava o valor em seguida).
    if p_etapa in ('negociacao', 'fechamento') and not em_venda then return null; end if;
    select * into rel from relacionamentos where id = p_relacionamento_id;
    if rel.id is null then return null; end if;

    nome_alvo := public.aura_etapa_da_chave(rel.empresa, p_etapa);
    if nome_alvo is null then return null; end if;

    insert into oportunidades (
      owner_id, empresa, cliente, valor, etapa, probabilidade, relacionamento_id, descricao,
      parceiro_id, percentual_parceiro
    )
    values (rel.owner_id, rel.empresa, rel.nome, 0, nome_alvo,
            public.aura_prob_da_chave(p_etapa), rel.id,
            'Criada automaticamente pela AURA: ' || coalesce(p_motivo, ''),
            -- Atendimento em dupla: o negócio nasce com a mesma dupla do cliente.
            case when rel.parceiro_id is distinct from rel.owner_id then rel.parceiro_id end,
            coalesce(rel.percentual_parceiro, 50))
    returning id into nova_id;

    insert into notificacoes (vendedor_id, titulo, mensagem, tipo, lida, acao_url, criada_em)
    values (rel.owner_id, '🤖 Nova oportunidade no pipeline',
            rel.nome || ' entrou em ' || nome_alvo || '. ' || coalesce(p_motivo,''),
            'ia', false, '/pipeline', now());

    if rel.parceiro_id is not null and rel.parceiro_id is distinct from rel.owner_id then
      insert into notificacoes (vendedor_id, titulo, mensagem, tipo, lida, acao_url, criada_em)
      values (rel.parceiro_id, '🤖 Nova oportunidade no atendimento em dupla',
              rel.nome || ' entrou em ' || nome_alvo || '. Você atende este cliente em dupla.',
              'ia', false, '/pipeline', now());
    end if;

    return nova_id;
  end if;

  v_empresa := op.empresa;
  nome_alvo := public.aura_etapa_da_chave(v_empresa, p_etapa);
  if nome_alvo is null then return op.id; end if;

  chave_atual := coalesce(public.aura_chave_da_etapa(v_empresa, op.etapa), '');

  -- Negócio já decidido não volta, e a automação só avança — nunca puxa para
  -- trás o que o vendedor adiantou à mão.
  if chave_atual in ('fechamento', 'perda')
     or public.aura_ordem_da_chave(p_etapa) <= public.aura_ordem_da_chave(chave_atual) then
    return op.id;
  end if;

  -- Sem valor não entra em Negociação/Fechamento (trava 091): avisa e para.
  -- Na venda, o valor chega na mesma transação, então ela segue.
  if p_etapa in ('negociacao', 'fechamento') and coalesce(op.valor, 0) <= 0 and not em_venda then
    if not exists (
      select 1 from notificacoes
       where vendedor_id = op.owner_id and lida = false
         and titulo = '💰 Falta o valor do negócio' and mensagem like op.cliente || ':%'
    ) then
      insert into notificacoes (vendedor_id, titulo, mensagem, tipo, lida, acao_url, criada_em)
      values (op.owner_id, '💰 Falta o valor do negócio',
              op.cliente || ': pelo que foi registrado, o negócio está em ' || nome_alvo
                || ', mas o card está sem valor. Abra o card e informe o valor estimado.',
              'ia', false, '/pipeline', now());
    end if;
    return op.id;
  end if;

  update oportunidades
     set etapa = nome_alvo,
         probabilidade = public.aura_prob_da_chave(p_etapa),
         dias_parado = 0,
         updated_at = now()
   where id = op.id;

  insert into notificacoes (vendedor_id, titulo, mensagem, tipo, lida, acao_url, criada_em)
  values (op.owner_id,
          case when p_etapa = 'fechamento' then '🎉 Negócio fechado' else '🤖 AURA moveu no pipeline' end,
          op.cliente || ': ' || op.etapa || ' → ' || nome_alvo || '. ' || coalesce(p_motivo, ''),
          'ia', false, '/pipeline', now());

  if op.parceiro_id is not null and op.parceiro_id is distinct from op.owner_id then
    insert into notificacoes (vendedor_id, titulo, mensagem, tipo, lida, acao_url, criada_em)
    values (op.parceiro_id,
            case when p_etapa = 'fechamento' then '🎉 Negócio da dupla fechado' else '🤖 O negócio da dupla andou' end,
            op.cliente || ': ' || op.etapa || ' → ' || nome_alvo || '. ' || coalesce(p_motivo, ''),
            'ia', false, '/pipeline', now());
  end if;

  return op.id;
end;
$function$;
