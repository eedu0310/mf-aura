-- 20260922145007 aura_pipeline_automatico

-- Pipeline automático da AURA: atividades e vendas movem a oportunidade.
-- Regra de ouro: só AVANÇA etapa, nunca volta; nunca marca "Perdidos" sozinha.

create or replace function public.aura_ordem_etapa(e text) returns int
language sql immutable set search_path = public as $$
  select case e when 'Prospecção' then 0 when 'Apresentação' then 1 when 'Proposta' then 2
                when 'Negociação' then 3 when 'Fechados' then 4 else -1 end
$$;

create or replace function public.aura_prob_etapa(e text) returns text
language sql immutable set search_path = public as $$
  select case e when 'Proposta' then 'Média' when 'Negociação' then 'Alta' when 'Fechados' then 'Alta' else 'Baixa' end
$$;

-- Move a oportunidade aberta (ou a indicada) para a etapa, se for avanço.
create or replace function public.aura_avancar_oportunidade(
  p_oportunidade_id uuid, p_relacionamento_id uuid, p_etapa text, p_motivo text, p_criar_se_nao_existir boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  op record;
  rel record;
  nova_id uuid;
begin
  if p_oportunidade_id is not null then
    select * into op from oportunidades where id = p_oportunidade_id;
  elsif p_relacionamento_id is not null then
    select * into op from oportunidades
     where relacionamento_id = p_relacionamento_id and etapa not in ('Fechados','Perdidos')
     order by updated_at desc nulls last, created_at desc limit 1;
  end if;

  if op.id is null then
    if not p_criar_se_nao_existir or p_relacionamento_id is null then return null; end if;
    select * into rel from relacionamentos where id = p_relacionamento_id;
    if rel.id is null then return null; end if;
    insert into oportunidades (owner_id, empresa, cliente, valor, etapa, probabilidade, relacionamento_id, descricao)
    values (rel.owner_id, rel.empresa, rel.nome, 0, p_etapa, aura_prob_etapa(p_etapa), rel.id,
            'Criada automaticamente pela AURA: ' || coalesce(p_motivo, ''))
    returning id into nova_id;
    insert into notificacoes (vendedor_id, titulo, mensagem, tipo, lida, acao_url, criada_em)
    values (rel.owner_id, '🤖 Nova oportunidade no pipeline', rel.nome || ' entrou em ' || p_etapa || '. ' || coalesce(p_motivo,''), 'ia', false, '/pipeline', now());
    return nova_id;
  end if;

  if op.etapa in ('Fechados','Perdidos') or aura_ordem_etapa(p_etapa) <= aura_ordem_etapa(op.etapa) then
    return op.id;
  end if;

  update oportunidades
     set etapa = p_etapa, probabilidade = aura_prob_etapa(p_etapa), dias_parado = 0, updated_at = now()
   where id = op.id;

  insert into notificacoes (vendedor_id, titulo, mensagem, tipo, lida, acao_url, criada_em)
  values (op.owner_id,
          case when p_etapa = 'Fechados' then '🎉 Negócio fechado' else '🤖 AURA moveu no pipeline' end,
          op.cliente || ': ' || op.etapa || ' → ' || p_etapa || '. ' || coalesce(p_motivo, ''),
          'ia', false, '/pipeline', now());
  return op.id;
end $$;

revoke execute on function public.aura_avancar_oportunidade(uuid, uuid, text, text, boolean) from anon, public;

-- Atividade registrada → etapa
create or replace function public.aura_atividade_move_pipeline() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  texto text;
  etapa_alvo text;
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
    etapa_alvo := 'Fechados';
  elsif texto ~ '(desconto|parcel|condicao de pagamento|negocia|contraproposta)' then
    etapa_alvo := 'Negociação';
  elsif new.tipo = 'Orçamento' or texto ~ '(orcamento|proposta enviada|enviei (a )?proposta|cotacao)' then
    etapa_alvo := 'Proposta'; criar := true;
  elsif new.tipo in ('Visita', 'Reunião') or texto ~ '(apresentacao|showroom|catalogo|visita tecnica|medicao)' then
    etapa_alvo := 'Apresentação'; criar := true;
  else
    return new;
  end if;

  perform aura_avancar_oportunidade(null, new.relacionamento_id, etapa_alvo,
                                    'Atividade: ' || coalesce(new.tipo,'') || ' — ' || coalesce(new.titulo,''), criar);
  return new;
end $$;

drop trigger if exists trg_aura_atividade_move_pipeline on public.atividades;
create trigger trg_aura_atividade_move_pipeline after insert on public.atividades
  for each row execute function public.aura_atividade_move_pipeline();

-- Venda registrada → Fechados
create or replace function public.aura_venda_fecha_pipeline() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.oportunidade_id is not null or new.relacionamento_id is not null then
    perform aura_avancar_oportunidade(new.oportunidade_id, new.relacionamento_id, 'Fechados',
      'Venda registrada: ' || to_char(coalesce(new.valor_fechado, new.valor), 'FM999G999G990D00'), false);
  end if;
  if new.relacionamento_id is not null then
    update relacionamentos set temperatura = 'quente', ultimo_contato_em = now(), updated_at = now()
     where id = new.relacionamento_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_aura_venda_fecha_pipeline on public.vendas;
create trigger trg_aura_venda_fecha_pipeline after insert on public.vendas
  for each row execute function public.aura_venda_fecha_pipeline();

revoke execute on function public.aura_atividade_move_pipeline() from anon, public;
revoke execute on function public.aura_venda_fecha_pipeline() from anon, public;
