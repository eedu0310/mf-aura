-- 120 — Revisão geral de 27/11/2026 (pedido do Elton: "uma revisão completa
-- de todo o sistema, etapa por etapa"). Só o que precisa do banco; o resto
-- foi no código. Cada bloco diz o que estava errado.

-- =====================================================================
-- 1. SEGURANÇA
-- =====================================================================

-- 1a. A pessoa não muda as PRÓPRIAS permissões, nem se reativa, nem se
-- aprova. A regra restritiva de profiles travava só cargo/mestre/aprovado/
-- loja; "permissoes", "ativo", "excluido_*" e "aprovado_*" ficavam abertos
-- para qualquer um chamando a API com o próprio login.
create or replace function public.aura_profiles_nao_se_autoedita()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Servidor (chave de serviço) e gestor mestre passam.
  if auth.uid() is null or public.gestor_mestre() then return new; end if;
  if new.id = auth.uid() and (
       new.permissoes is distinct from old.permissoes
    or new.ativo is distinct from old.ativo
    or new.excluido_em is distinct from old.excluido_em
    or new.excluido_por is distinct from old.excluido_por
    or new.excluido_motivo is distinct from old.excluido_motivo
    or new.aprovado_em is distinct from old.aprovado_em
    or new.aprovado_por is distinct from old.aprovado_por
  ) then
    raise exception 'Permissões, status e aprovação do próprio perfil são do gestor.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_aura_profiles_nao_se_autoedita on public.profiles;
create trigger trg_aura_profiles_nao_se_autoedita
  before update on public.profiles
  for each row execute function public.aura_profiles_nao_se_autoedita();

-- 1b. As funções da 118 nasceram executáveis por qualquer um (anon). A
-- aura_espalhar_campanha grava campanha em cliente/negócio/venda de qualquer
-- loja por cima da RLS. Só os gatilhos (que rodam como dono) as usam.
revoke execute on function public.aura_espalhar_campanha(uuid) from public, anon, authenticated;
revoke execute on function public.aura_campanha_da_conversa(uuid, uuid, date) from public, anon, authenticated;
revoke execute on function public.aura_conversa_espalha_campanha() from public, anon, authenticated;
revoke execute on function public.aura_venda_campanha_da_conversa() from public, anon, authenticated;
revoke execute on function public.aura_posvenda_sem_venda_cria_venda() from public, anon, authenticated;
revoke execute on function public.aura_profiles_nao_se_autoedita() from public, anon, authenticated;
-- E funções novas deixam de nascer abertas para quem não tem login.
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- =====================================================================
-- 2. VENDAS
-- =====================================================================

-- 2a. Pós-venda sem venda (118) virava venda para cliente antigo e para
-- manutenção (vedação de vidro, troca de tijolo, limpeza de chaminé): era a
-- IA usando Pós-venda para "já comprou". Agora só cria quando é venda nova
-- de verdade: com valor, cliente que não comprou nos últimos 180 dias e que
-- não está marcado como "já é cliente" na conversa. Data em Brasília.
create or replace function public.aura_posvenda_sem_venda_cria_venda()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  tipo_novo text;
  tipo_antigo text;
begin
  if new.etapa is not distinct from old.etapa then return new; end if;
  select tipo into tipo_novo from public.etapas_funil where empresa = new.empresa and nome = new.etapa limit 1;
  if tipo_novo is distinct from 'posvenda' then return new; end if;
  select tipo into tipo_antigo from public.etapas_funil where empresa = new.empresa and nome = old.etapa limit 1;
  if coalesce(tipo_antigo, 'aberta') <> 'aberta' then return new; end if;
  if current_setting('aura.venda_em_curso', true) = 'sim' then return new; end if;
  if exists (select 1 from public.vendas where oportunidade_id = new.id) then return new; end if;
  if coalesce(new.valor, 0) <= 0 then return new; end if;
  if new.relacionamento_id is not null and (
       exists (select 1 from public.vendas v
                where v.relacionamento_id = new.relacionamento_id
                  and v.data >= (now() at time zone 'America/Sao_Paulo')::date - 180)
    or exists (select 1 from public.whatsapp_ia_leads l
                where (l.relacionamento_id = new.relacionamento_id or l.carteira_relacionamento_id = new.relacionamento_id)
                  and l.natureza = 'cliente')
  ) then
    return new;
  end if;

  insert into public.vendas (
    owner_id, empresa, cliente, produto,
    valor, valor_original, valor_fechado,
    desconto_valor, desconto_percentual,
    quantidade_parcelas, valor_parcela, entrada_valor, taxa_financeira,
    comissao_base, data, relacionamento_id, oportunidade_id, status,
    parceiro_id, percentual_parceiro
  ) values (
    new.owner_id, new.empresa, new.cliente, new.produto,
    new.valor, new.valor, new.valor,
    0, 0, 1, new.valor, 0, 0,
    new.valor, (now() at time zone 'America/Sao_Paulo')::date, new.relacionamento_id, new.id,
    'aguardando_detalhes',
    case when new.parceiro_id is distinct from new.owner_id then new.parceiro_id end,
    case when new.parceiro_id is not null and new.parceiro_id is distinct from new.owner_id
         then coalesce(new.percentual_parceiro, 50) else 0 end
  );
  return new;
end;
$$;
revoke execute on function public.aura_posvenda_sem_venda_cria_venda() from public, anon, authenticated;

-- 2b. Fechamento → Pós-venda é o caminho normal da venda (entrega,
-- instalação). O gatilho de "reabrir" apagava a venda automática nesse
-- passo. Agora só desfaz quando o card volta para trás ou vai para Perdidos.
create or replace function public.aura_reabrir_card_desfaz_venda()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  etapa_ganho text;
  tipo_novo text;
begin
  etapa_ganho := public.aura_etapa_de_ganho(new.empresa);
  if old.etapa = etapa_ganho and new.etapa is distinct from etapa_ganho then
    select tipo into tipo_novo from public.etapas_funil where empresa = new.empresa and nome = new.etapa limit 1;
    if tipo_novo = 'posvenda' then return new; end if;
    -- Só a venda que o próprio fechamento criou e que ninguém completou.
    delete from vendas
     where oportunidade_id = new.id
       and status = 'aguardando_detalhes';
  end if;
  return new;
end;
$$;

-- 2c. Datas de venda em Brasília. current_date é UTC: card fechado depois
-- das 21h gravava o dia seguinte (e, no dia 30, o mês seguinte).
alter table public.vendas alter column data set default ((now() at time zone 'America/Sao_Paulo')::date);

create or replace function public.aura_fechar_card_cria_venda()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  etapa_ganho text;
begin
  etapa_ganho := public.aura_etapa_de_ganho(new.empresa);
  if new.etapa is distinct from etapa_ganho then return new; end if;
  if tg_op = 'UPDATE' and old.etapa = etapa_ganho then return new; end if;
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
    coalesce(new.valor, 0), (now() at time zone 'America/Sao_Paulo')::date, new.relacionamento_id, new.id,
    'aguardando_detalhes',
    case when new.parceiro_id is distinct from new.owner_id then new.parceiro_id end,
    case when new.parceiro_id is not null and new.parceiro_id is distinct from new.owner_id
         then coalesce(new.percentual_parceiro, 50) else 0 end
  );
  return new;
end;
$$;

-- 2d. Uma venda por negócio e um pedido de avaliação por venda, garantidos
-- pelo banco (hoje só os gatilhos seguravam; gravação simultânea passava).
create unique index if not exists vendas_uma_por_oportunidade
  on public.vendas (oportunidade_id) where oportunidade_id is not null;
create unique index if not exists pedidos_avaliacao_um_por_venda
  on public.pedidos_avaliacao (venda_id) where venda_id is not null;

-- 2e. As 7 vendas que a tela "Editar venda" gravou com o valor dividido por
-- 100 (abria "12900" e salvava 129). As telas mostram valor_fechado, que
-- ficou certo: "valor" volta a bater com ele.
update public.vendas
   set valor = valor_fechado
 where valor_fechado > 0 and valor > 0
   and abs(valor * 100 - valor_fechado) <= valor_fechado * 0.03;

-- =====================================================================
-- 3. AVALIAÇÕES
-- =====================================================================

-- 3a. Apagar a venda apagava o pedido junto, com envio/abertura/avaliação,
-- e o vendedor perdia o ponto. Agora: pedido sem nada marcado sai com a
-- venda; o que tem histórico fica, sem venda.
create or replace function public.aura_venda_apagada_guarda_avaliacao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.pedidos_avaliacao
   where venda_id = old.id
     and enviado_em is null and aberto_em is null and confirmado_em is null;
  update public.pedidos_avaliacao set venda_id = null where venda_id = old.id;
  return old;
end;
$$;
revoke execute on function public.aura_venda_apagada_guarda_avaliacao() from public, anon, authenticated;

drop trigger if exists trg_aura_venda_apagada_guarda_avaliacao on public.vendas;
create trigger trg_aura_venda_apagada_guarda_avaliacao
  before delete on public.vendas
  for each row execute function public.aura_venda_apagada_guarda_avaliacao();

alter table public.pedidos_avaliacao drop constraint if exists pedidos_avaliacao_venda_id_fkey;
alter table public.pedidos_avaliacao add constraint pedidos_avaliacao_venda_id_fkey
  foreign key (venda_id) references public.vendas(id) on delete set null;

-- 3b. Os 7 "envios" que eram o vendedor mandando o link para o próprio
-- número ou para um colega (Charles ×4, Alexsander, Anderson, Elton).
delete from public.pedidos_avaliacao
 where venda_id is null
   and right(regexp_replace(coalesce(telefone, ''), '\D', '', 'g'), 8)
       in ('91363560', '91032848', '89346350', '92320145');

-- 3c. Aberturas que eram o robô da pré-visualização do WhatsApp (antes do
-- filtro de 27/11): abriu antes do envio ou menos de 1 minuto depois.
update public.pedidos_avaliacao
   set aberto_em = null
 where aberto_em is not null and enviado_em is not null
   and aberto_em < enviado_em + interval '60 seconds'
   and aberto_em < '2026-11-27';

-- 3d. O "avaliei" detectado na conversa gravava também "abriu o link".
update public.pedidos_avaliacao
   set aberto_em = null
 where aberto_em is not null and aberto_em = confirmado_em and confirmado_por is null;

-- =====================================================================
-- 4. WHATSAPP → PIPELINE
-- =====================================================================

-- 4a. Lead descartado ("não é lead", "já é cliente") não vira card: o
-- gatilho criava negócio em Prospecção quando o vendedor mandava qualquer
-- mensagem para o número (14 cards assim).
create or replace function public.aura_lead_respondido_vira_pipeline()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_dono uuid;
  v_rel uuid;
  v_nome text;
  v_frio boolean;
  v_etapa_frio text;
  v_op uuid;
  v_op_etapa text;
begin
  if new.natureza is not null then return new; end if;

  v_frio := new.status = 'lead_frio';

  if v_frio then
    if coalesce(old.status, '') = 'lead_frio' then return new; end if;
  elsif new.status <> 'respondido' or coalesce(old.status, '') = 'respondido' then
    return new;
  end if;

  v_dono := coalesce(new.vendedor_id, new.respondido_por, new.sdr_id);
  if v_dono is null then return new; end if;

  v_nome := coalesce(nullif(btrim(new.nome), ''), new.telefone, 'Cliente sem nome');
  v_rel  := new.relacionamento_id;

  if v_rel is null and new.telefone is not null then
    select id into v_rel
    from public.relacionamentos
    where empresa = new.empresa
      and telefone_normalizado = public.aura_normalizar_telefone(new.telefone)
    limit 1;
  end if;

  if v_rel is null then
    insert into public.relacionamentos (owner_id, empresa, nome, telefone, email, categoria, origem, observacao)
    values (v_dono, new.empresa, v_nome, new.telefone, new.email, 'Cliente Final',
            coalesce(new.origem, 'Lead'),
            nullif(new.mensagem_inicial, ''))
    returning id into v_rel;
  end if;

  update public.leads_recebidos set relacionamento_id = v_rel where id = new.id;

  if v_frio then
    v_etapa_frio := public.aura_etapa_da_chave(new.empresa, 'lead_frio');
    update public.relacionamentos set temperatura = 'frio' where id = v_rel;

    select o.id, o.etapa into v_op, v_op_etapa
    from public.oportunidades o
    where o.relacionamento_id = v_rel
      and coalesce(public.aura_chave_da_etapa(o.empresa, o.etapa), '') not in ('fechamento', 'perda')
    order by o.updated_at desc nulls last
    limit 1;

    if v_op is null then
      insert into public.oportunidades (owner_id, empresa, cliente, produto, valor, etapa, probabilidade, relacionamento_id, descricao)
      values (v_dono, new.empresa, v_nome,
              coalesce(nullif(new.resumo_ia,''), nullif(new.mensagem_inicial,''), 'Lead recebido'),
              0, v_etapa_frio, 'Baixa', v_rel,
              'Lead frio / curioso, marcado na tela de Leads. Origem: ' || coalesce(new.origem,'não informada') || '.');
    elsif coalesce(public.aura_chave_da_etapa(new.empresa, v_op_etapa), '') in ('prospeccao', 'qualificacao') then
      update public.oportunidades
         set etapa = v_etapa_frio, probabilidade = 'Baixa', updated_at = now()
       where id = v_op;
    end if;
    return new;
  end if;

  if coalesce(old.status, '') = 'lead_frio' then
    update public.oportunidades o
       set etapa = public.aura_etapa_da_chave(new.empresa, 'prospeccao'), updated_at = now()
     where o.relacionamento_id = v_rel
       and public.aura_chave_da_etapa(o.empresa, o.etapa) = 'lead_frio';
  end if;

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

-- Os 35 leads já descartados que ainda esperavam resposta: cada mensagem do
-- vendedor para eles viraria card. Saem da fila.
update public.leads_recebidos
   set status = 'perdido'
 where natureza is not null
   and status in ('aguardando_sdr', 'atribuido_sdr', 'repassado_vendedor');

-- 4b. Visita "com oportunidade": o formulário cria o card com valor e
-- produto, e o gatilho criava OUTRO (25 pares de cards duplicados). Nesse
-- caso o gatilho só avança um card que já exista; não cria.
create or replace function public.aura_atividade_move_pipeline()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  texto text;
  chave_alvo text;
  criar boolean := false;
begin
  if new.relacionamento_id is null then return new; end if;
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

  if coalesce(new.metadata ->> 'houve_oportunidade', '') = 'true' then
    criar := false;
  end if;

  perform public.aura_avancar_oportunidade(null, new.relacionamento_id, chave_alvo,
    'Atividade: ' || coalesce(new.tipo,'') || ' — ' || coalesce(new.titulo,''), criar);
  return new;
end;
$$;

-- 4c. "Atendimento pelo WhatsApp" registrado em dobro no mesmo dia (duas
-- instâncias conectadas ao mesmo tempo): fica o primeiro de cada dia.
delete from public.atividades a
 using (
   select id, row_number() over (
            partition by owner_id, relacionamento_id, (created_at at time zone 'America/Sao_Paulo')::date
            order by created_at, id) as n
     from public.atividades
    where origem = 'whatsapp_auto'
 ) d
 where a.id = d.id and d.n > 1;
