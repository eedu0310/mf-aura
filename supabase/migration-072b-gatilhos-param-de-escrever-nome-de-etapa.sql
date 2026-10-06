-- 072b — Os gatilhos param de escrever nome de etapa à mão
--
-- Continuação de 072. Aqui os gatilhos que disparam sozinhos passam a falar
-- por chave semântica, em vez de carregar 'Fechados' e 'Proposta' escritos à
-- mão — nomes que a migração 068 apagou das quatro lojas.
--
-- MUDANÇA DE CONTRATO: aura_avancar_oportunidade recebia um NOME de etapa no
-- terceiro argumento e agora recebe uma CHAVE ('fechamento', 'followup'...).
-- A assinatura continua a mesma de propósito: trocá-la exigiria DROP FUNCTION
-- e os gatilhos que a chamam ficariam órfãos por um instante. Nenhum código da
-- aplicação chama esta função — só gatilhos, todos atualizados aqui.

create or replace function public.aura_avancar_oportunidade(
  p_oportunidade_id uuid,
  p_relacionamento_id uuid,
  p_etapa text,                    -- ATENÇÃO: agora é a CHAVE, não o nome
  p_motivo text,
  p_criar_se_nao_existir boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  op record;
  rel record;
  nova_id uuid;
  v_empresa text;
  nome_alvo text;
  chave_atual text;
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

    -- O parceiro também é avisado: ele atende junto, e um negócio criado para
    -- o cliente dele sem ninguém contar é exatamente o "os dois estarem
    -- cientes" que faltava.
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
$$;

-- Venda registrada fecha o negócio. Antes mandava para 'Fechados' e o card
-- sumiria do quadro; agora vai para a etapa de ganho da loja.
create or replace function public.aura_venda_fecha_pipeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.oportunidade_id is not null or new.relacionamento_id is not null then
    perform public.aura_avancar_oportunidade(
      new.oportunidade_id, new.relacionamento_id, 'fechamento',
      'Venda registrada: ' || to_char(coalesce(new.valor_fechado, new.valor), 'FM999G999G990D00'),
      false);
  end if;
  if new.relacionamento_id is not null then
    update relacionamentos set temperatura = 'quente', ultimo_contato_em = now(), updated_at = now()
     where id = new.relacionamento_id;
  end if;
  return new;
end;
$$;

-- Atividade do vendedor move o negócio. Antes jogava em 'Proposta' e
-- 'Fechados', que não existem mais em nenhuma loja.
create or replace function public.aura_atividade_move_pipeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  texto text;
  chave_alvo text;
  criar boolean := false;
begin
  if new.relacionamento_id is null then return new; end if;
  -- Ignora registros do próprio sistema (movimentações, IA do WhatsApp).
  if coalesce(new.origem, '') = 'whatsapp_ia'
     or new.titulo ilike 'Oportunidade %' or new.titulo ilike 'IA moveu%' or new.titulo ilike 'Etapa alterada%' then
    return new;
  end if;

  texto := lower(translate(coalesce(new.titulo,'') || ' ' || coalesce(new.contexto,'') || ' ' || coalesce(new.observacao,'') || ' ' ||
                           coalesce(new.resultado,'') || ' ' || coalesce(new.proximo_passo,'') || ' ' || coalesce(new.subtipo,''),
                           'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'));

  if new.tipo = 'Venda' or texto ~ '(venda fechada|negocio fechado|fechou|fechamos|pedido confirmado|contrato assinado|pagamento (confirmado|recebido))' then
    chave_alvo := 'fechamento';
  elsif texto ~ '(desconto|parcel|condicao de pagamento|negocia|contraproposta)' then
    chave_alvo := 'negociacao';
  elsif new.tipo = 'Orçamento' or texto ~ '(orcamento|proposta enviada|enviei (a )?proposta|cotacao)' then
    chave_alvo := 'followup'; criar := true;
  elsif new.tipo in ('Visita', 'Reunião') or texto ~ '(apresentacao|showroom|catalogo|visita tecnica|medicao)' then
    chave_alvo := 'apresentacao'; criar := true;
  else
    return new;
  end if;

  perform public.aura_avancar_oportunidade(null, new.relacionamento_id, chave_alvo,
    'Atividade: ' || coalesce(new.tipo,'') || ' — ' || coalesce(new.titulo,''), criar);
  return new;
end;
$$;

-- Lead respondido vira negócio. Aqui o 'Fechados' do filtro deixava passar um
-- cliente já fechado (hoje 'Fechamento'), criando um segundo negócio para
-- quem já comprou.
create or replace function public.aura_lead_respondido_vira_pipeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dono uuid;
  v_rel uuid;
  v_nome text;
begin
  if new.status <> 'respondido' or coalesce(old.status,'') = 'respondido' then
    return new;
  end if;

  v_dono := coalesce(new.vendedor_id, new.respondido_por, new.sdr_id);
  if v_dono is null then return new; end if;

  v_nome := coalesce(nullif(btrim(new.nome), ''), new.telefone, 'Cliente sem nome');
  v_rel  := new.relacionamento_id;

  -- Acha o cliente pelo telefone antes de criar outro.
  if v_rel is null and new.telefone is not null then
    select id into v_rel
    from public.relacionamentos
    where empresa = new.empresa
      and telefone_normalizado = public.aura_normalizar_telefone(new.telefone)
    limit 1;
  end if;

  if v_rel is null then
    insert into public.relacionamentos (owner_id, empresa, nome, telefone, email, categoria, origem, observacao)
    values (v_dono, new.empresa, v_nome, new.telefone, new.email, 'Cliente',
            coalesce(new.origem, 'Lead'),
            nullif(new.mensagem_inicial, ''))
    returning id into v_rel;
  end if;

  update public.leads_recebidos set relacionamento_id = v_rel where id = new.id;

  if not exists (
    select 1 from public.oportunidades o
    where o.relacionamento_id = v_rel
      and coalesce(public.aura_chave_da_etapa(o.empresa, o.etapa), '') not in ('fechamento', 'perda')
  ) then
    insert into public.oportunidades (owner_id, empresa, cliente, produto, valor, etapa, probabilidade, relacionamento_id, descricao)
    values (v_dono, new.empresa, v_nome,
            coalesce(nullif(new.resumo_ia,''), nullif(new.mensagem_inicial,''), 'Lead recebido'),
            0, public.aura_etapa_da_chave(new.empresa, 'prospeccao'),
            case new.urgencia when 'alta' then 'Alta' when 'baixa' then 'Baixa' else 'Média' end,
            v_rel,
            'Criado automaticamente a partir de um lead de ' || coalesce(new.origem,'origem não informada') || '.');
  end if;

  insert into public.notificacoes (vendedor_id, titulo, mensagem, tipo, acao_url)
  values (v_dono, 'Lead virou negócio no pipeline',
          v_nome || ' entrou no pipeline. Registre o próximo passo.',
          'lead', '/pipeline');

  return new;
end;
$$;
