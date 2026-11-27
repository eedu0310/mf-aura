-- 122 — A decisão do vendedor sobre o card vale em todo lugar
-- (27/11/2026, depois do "mesmo colocando lead frio não sai dos leads em
-- alerta", do Elton).
--
-- O card ia para Leads frios, Perdidos, Fechamento ou Pós-venda, mas três
-- coisas guardadas em OUTRAS tabelas não ficavam sabendo e continuavam
-- cobrando o vendedor:
--
--  1. whatsapp_ia_leads.alertas — os avisos da última análise da IA. Quem lê
--     essa coluna (Meu Dia "WhatsApp esperando", Ouvinte das Conversas,
--     contagem do gestor, nota "crítico") seguia acusando. 40 contatos hoje.
--  2. leads_recebidos.status — o prazo de resposta do lead. O lead só fechava
--     quando o vendedor mandava mensagem pelo WhatsApp do AURA; atividade
--     registrada, card avançado ou card decidido não contavam. 12 dos 23
--     leads "escalados ao gestor" já tinham atividade do vendedor.
--  3. relacionamentos.proximo_contato_em — o retorno vencido de um negócio
--     perdido virava "Follow-up vencido" toda manhã, e com 7 dias ia ao
--     gestor. 25 clientes hoje.
--
-- Tudo pela CHAVE da etapa (aura_chave_da_etapa), não pelo nome: a loja pode
-- renomear "Perdidos" e a regra continua valendo.

-- ---------------------------------------------------------------- trava
-- Quando é esta sincronização que muda o status do lead, o gatilho
-- "lead respondido vira pipeline" não pode agir: ele criaria card, mandaria
-- "Lead virou negócio no pipeline" e, num lead frio, ainda arrastaria OUTRO
-- card do cliente para Leads frios.
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
  -- Mudança feita pela sincronização do card (migração 122): o card já está certo.
  if coalesce(current_setting('aura.sincronizando_card', true), '') = 'on' then return new; end if;

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
      and coalesce(public.aura_chave_da_etapa(o.empresa, o.etapa), '') not in ('fechamento', 'perda', 'posvenda')
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
      and coalesce(public.aura_chave_da_etapa(o.empresa, o.etapa), '') not in ('fechamento', 'perda', 'posvenda')
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

-- ------------------------------------------- 1. card decidido limpa cobranças
create or replace function public.aura_card_decidido_limpa_cobrancas()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_chave text;
  v_outro_aberto boolean;
begin
  if new.etapa is not distinct from old.etapa then return new; end if;
  v_chave := coalesce(public.aura_chave_da_etapa(new.empresa, new.etapa), '');
  if v_chave not in ('lead_frio', 'perda', 'fechamento', 'posvenda') then return new; end if;

  -- Avisos da IA guardados na conversa deste card: o vendedor já decidiu.
  -- Se o cliente voltar a falar, a próxima análise escreve de novo.
  update public.whatsapp_ia_leads
     set alertas = '[]'::jsonb
   where oportunidade_id = new.id
     and jsonb_array_length(coalesce(alertas, '[]'::jsonb)) > 0;

  if new.relacionamento_id is null then return new; end if;

  -- Outro negócio do mesmo cliente ainda em jogo? Então o lead e o retorno
  -- continuam valendo para ele.
  select exists (
    select 1 from public.oportunidades o
     where o.relacionamento_id = new.relacionamento_id
       and o.id <> new.id
       and coalesce(public.aura_chave_da_etapa(o.empresa, o.etapa), '')
           in ('prospeccao', 'qualificacao', 'apresentacao', 'followup', 'negociacao')
  ) into v_outro_aberto;

  -- Prazo de resposta do lead: vendeu ou foi para o pós-venda = atendido;
  -- frio = lead frio; perdido = perdido.
  if v_chave in ('fechamento', 'posvenda') or not v_outro_aberto then
    perform set_config('aura.sincronizando_card', 'on', true);
    update public.leads_recebidos
       set status = case
                      when v_chave in ('fechamento', 'posvenda') then 'respondido'
                      when v_chave = 'lead_frio' then 'lead_frio'
                      else 'perdido'
                    end
     where relacionamento_id = new.relacionamento_id
       and status in ('aguardando_sdr', 'atribuido_sdr', 'repassado_vendedor');
    perform set_config('aura.sincronizando_card', 'off', true);
  end if;

  -- Retorno JÁ VENCIDO de um negócio que acabou de ser perdido: não cobra
  -- mais. Data no futuro fica — pode ser o "retomar no inverno" do vendedor.
  if v_chave = 'perda' and not v_outro_aberto then
    update public.relacionamentos
       set proximo_contato_em = null,
           proximo_contato = 'a definir'
     where id = new.relacionamento_id
       and proximo_contato_em is not null
       and proximo_contato_em < now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_aura_card_decidido_limpa_cobrancas on public.oportunidades;
create trigger trg_aura_card_decidido_limpa_cobrancas
  after update of etapa on public.oportunidades
  for each row execute function public.aura_card_decidido_limpa_cobrancas();

-- ------------------------------------- 2. atividade do vendedor atende o lead
-- O Guardião já contava atividade registrada como lead atendido; o prazo do
-- banco (repassar_leads_expirados) e o cartão do gestor não. Agora contam os
-- dois. Atividade da IA não vale: quem atende é gente.
create or replace function public.aura_atividade_atende_lead()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_quando timestamptz := coalesce(new.ocorrida_em, new.created_at, now());
begin
  if new.relacionamento_id is null then return new; end if;
  if coalesce(new.origem, '') = 'whatsapp_ia'
     or new.titulo ilike 'IA moveu%'
     or new.titulo ilike 'Oportunidade criada pela IA%'
     or new.titulo ilike 'Etapa alterada no WhatsApp%' then
    return new;
  end if;

  perform set_config('aura.sincronizando_card', 'on', true);
  update public.leads_recebidos
     set status = 'respondido',
         respondido_em = coalesce(respondido_em, v_quando),
         respondido_por = coalesce(respondido_por, new.owner_id)
   where relacionamento_id = new.relacionamento_id
     and status in ('aguardando_sdr', 'atribuido_sdr', 'repassado_vendedor')
     and created_at <= v_quando;
  perform set_config('aura.sincronizando_card', 'off', true);
  return new;
end;
$$;

drop trigger if exists trg_aura_atividade_atende_lead on public.atividades;
create trigger trg_aura_atividade_atende_lead
  after insert on public.atividades
  for each row execute function public.aura_atividade_atende_lead();

revoke execute on function public.aura_card_decidido_limpa_cobrancas() from public, anon, authenticated;
revoke execute on function public.aura_atividade_atende_lead() from public, anon, authenticated;

-- ------------------------------------------------ 3. acerto do que já existe
do $$
begin
  perform set_config('aura.sincronizando_card', 'on', true);

  -- 3a. Avisos guardados em conversa de card decidido.
  update public.whatsapp_ia_leads w
     set alertas = '[]'::jsonb
    from public.oportunidades o
   where o.id = w.oportunidade_id
     and coalesce(public.aura_chave_da_etapa(o.empresa, o.etapa), '') in ('lead_frio', 'perda', 'fechamento', 'posvenda')
     and jsonb_array_length(coalesce(w.alertas, '[]'::jsonb)) > 0;

  -- 3b. Lead na fila que já teve atividade do vendedor depois de chegar.
  update public.leads_recebidos l
     set status = 'respondido',
         respondido_em = coalesce(l.respondido_em, a.quando),
         respondido_por = coalesce(l.respondido_por, a.owner_id)
    from (
      select distinct on (l2.id) l2.id as lead_id,
             coalesce(atv.ocorrida_em, atv.created_at) as quando, atv.owner_id
        from public.leads_recebidos l2
        join public.atividades atv on atv.relacionamento_id = l2.relacionamento_id
       where l2.status in ('aguardando_sdr', 'atribuido_sdr', 'repassado_vendedor')
         and coalesce(atv.ocorrida_em, atv.created_at) >= l2.created_at
         and coalesce(atv.origem, '') <> 'whatsapp_ia'
         and atv.titulo not ilike 'IA moveu%'
         and atv.titulo not ilike 'Oportunidade criada pela IA%'
         and atv.titulo not ilike 'Etapa alterada no WhatsApp%'
       order by l2.id, coalesce(atv.ocorrida_em, atv.created_at)
    ) a
   where l.id = a.lead_id;

  -- 3c. Lead na fila cujo cliente só tem cards decididos.
  update public.leads_recebidos l
     set status = case
                    when exists (select 1 from public.oportunidades o where o.relacionamento_id = l.relacionamento_id
                                  and public.aura_chave_da_etapa(o.empresa, o.etapa) in ('fechamento', 'posvenda')) then 'respondido'
                    when exists (select 1 from public.oportunidades o where o.relacionamento_id = l.relacionamento_id
                                  and public.aura_chave_da_etapa(o.empresa, o.etapa) = 'lead_frio') then 'lead_frio'
                    else 'perdido'
                  end
   where l.status in ('aguardando_sdr', 'atribuido_sdr', 'repassado_vendedor')
     and l.relacionamento_id is not null
     and exists (select 1 from public.oportunidades o where o.relacionamento_id = l.relacionamento_id)
     and not exists (
       select 1 from public.oportunidades o
        where o.relacionamento_id = l.relacionamento_id
          and coalesce(public.aura_chave_da_etapa(o.empresa, o.etapa), '')
              not in ('lead_frio', 'perda', 'fechamento', 'posvenda'));

  -- 3d. Retorno vencido de cliente cujos negócios foram todos perdidos.
  update public.relacionamentos r
     set proximo_contato_em = null,
         proximo_contato = 'a definir'
   where r.proximo_contato_em is not null
     and r.proximo_contato_em < now()
     and exists (select 1 from public.oportunidades o where o.relacionamento_id = r.id)
     and not exists (
       select 1 from public.oportunidades o
        where o.relacionamento_id = r.id
          and coalesce(public.aura_chave_da_etapa(o.empresa, o.etapa), '') <> 'perda');

  perform set_config('aura.sincronizando_card', 'off', true);
end $$;

-- ------------------------- 4. Pós-venda não é "negócio aberto" na automação
-- O card que foi para o Pós-venda já tem a venda dele. Antes, a próxima venda
-- do mesmo cliente (recompra) achava esse card como "o negócio aberto", tentava
-- pendurar a venda nova nele e a trava "uma venda por card" (migração 120)
-- recusava: "Esta venda já está registrada" — a recompra não entrava.
-- Etapa que a automação não entende (criada pelo gestor, sem chave) também não
-- é mexida: "Visita" registrada num card em "Aguardando obra" puxava o card
-- de volta para Apresentação.
create or replace function public.aura_avancar_oportunidade(
  p_oportunidade_id uuid, p_relacionamento_id uuid, p_etapa text, p_motivo text,
  p_criar_se_nao_existir boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  op record;
  rel record;
  nova_id uuid;
  v_empresa text;
  nome_alvo text;
  chave_atual text;
  em_venda boolean := coalesce(current_setting('aura.venda_em_curso', true), '') = 'sim';
begin
  if p_oportunidade_id is not null then
    select * into op from oportunidades where id = p_oportunidade_id;
  elsif p_relacionamento_id is not null then
    select o.* into op
      from oportunidades o
     where o.relacionamento_id = p_relacionamento_id
       and coalesce(public.aura_chave_da_etapa(o.empresa, o.etapa), '') not in ('fechamento', 'perda', 'posvenda')
     order by o.updated_at desc nulls last, o.created_at desc
     limit 1;
  end if;

  if op.id is null then
    if not p_criar_se_nao_existir or p_relacionamento_id is null then return null; end if;
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

  -- Negócio já decidido não volta; a automação só avança; e etapa que ela não
  -- conhece fica com o vendedor (a venda é a exceção: ela fecha o card).
  if chave_atual in ('fechamento', 'perda', 'posvenda')
     or (chave_atual = '' and not em_venda)
     or (chave_atual <> '' and public.aura_ordem_da_chave(p_etapa) <= public.aura_ordem_da_chave(chave_atual)) then
    return op.id;
  end if;

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
$$;

-- -------------------- 5. gatilhos da venda pela CHAVE da etapa, não pelo nome
-- Cards guardados com nome antigo ("Fechados", "Pos-venda") eram tratados
-- como etapa desconhecida por estes dois gatilhos.
create or replace function public.aura_reabrir_card_desfaz_venda()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.aura_chave_da_etapa(old.empresa, old.etapa), '') = 'fechamento'
     and new.etapa is distinct from old.etapa
     and coalesce(public.aura_chave_da_etapa(new.empresa, new.etapa), '') <> 'posvenda' then
    delete from vendas
     where oportunidade_id = new.id
       and status = 'aguardando_detalhes';
  end if;
  return new;
end;
$$;

create or replace function public.aura_posvenda_sem_venda_cria_venda()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  chave_nova text;
  chave_antiga text;
begin
  if new.etapa is not distinct from old.etapa then return new; end if;
  chave_nova := coalesce(public.aura_chave_da_etapa(new.empresa, new.etapa), '');
  if chave_nova <> 'posvenda' then return new; end if;
  chave_antiga := coalesce(public.aura_chave_da_etapa(new.empresa, old.etapa), '');
  if chave_antiga not in ('lead_frio', 'prospeccao', 'qualificacao', 'apresentacao', 'followup', 'negociacao') then return new; end if;
  if current_setting('aura.venda_em_curso', true) = 'sim' then return new; end if;
  -- Cliente antigo sendo arquivado no pós-venda ("Já é cliente" no WhatsApp):
  -- não há venda nova a criar. A rota liga esta bandeira (aura_card_para_posvenda_sem_venda).
  if coalesce(current_setting('aura.cliente_antigo', true), '') = 'on' then return new; end if;
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

-- "Já é cliente" no WhatsApp: leva o card aberto para o Pós-venda SEM criar
-- venda. Antes o card era movido antes de a conversa ficar marcada como
-- cliente, e o gatilho acima, sem saber, criava uma venda que ninguém fez.
create or replace function public.aura_card_para_posvenda_sem_venda(p_oportunidade_id uuid, p_etapa text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('aura.cliente_antigo', 'on', true);
  update oportunidades set etapa = p_etapa, updated_at = now() where id = p_oportunidade_id;
  perform set_config('aura.cliente_antigo', 'off', true);
end;
$$;
revoke execute on function public.aura_card_para_posvenda_sem_venda(uuid, text) from public, anon, authenticated;
grant execute on function public.aura_card_para_posvenda_sem_venda(uuid, text) to service_role;
