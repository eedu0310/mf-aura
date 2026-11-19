-- 102 · Lead frio / curioso, e o "Perdido" dos leads que nunca gravava (19/11/2026)
--
-- 1. O botão "Perdido" da tela de Leads mandava status = 'perdido', mas a
--    trava do banco só aceitava aguardando_sdr, atribuido_sdr, respondido e
--    repassado_vendedor. O banco recusava calado e o lead voltava para a fila.
--    Nenhum lead está como perdido hoje por causa disso.
-- 2. Lead que não é para descartar, mas também não está pronto para comprar
--    (curioso, pesquisando), vira 'lead_frio': sai da fila e ganha um card na
--    nova coluna "Leads frios", antes da Prospecção, nas quatro lojas.
--    A coluna não soma no valor do funil. A IA nunca move negócio para ela e
--    negócio novo nunca nasce nela (src/lib/funil.ts, primeiraEtapa).

begin;

-- 1) Os status que a tela usa
alter table public.leads_recebidos drop constraint if exists leads_recebidos_status_check;
alter table public.leads_recebidos add constraint leads_recebidos_status_check
  check (status = any (array[
    'aguardando_sdr', 'atribuido_sdr', 'respondido', 'repassado_vendedor', 'perdido', 'lead_frio'
  ]));

-- 2) A coluna "Leads frios" em cada loja que já tem funil gravado
insert into public.etapas_funil (empresa, nome, ordem, tipo, conta_no_pipeline, probabilidade, cor, ativa, chave)
select distinct e.empresa, 'Leads frios', 0, 'aberta', false, 'Baixa', '#94a3b8', true, 'lead_frio'
from public.etapas_funil e
where not exists (
  select 1 from public.etapas_funil x where x.empresa = e.empresa and x.chave = 'lead_frio'
)
on conflict (empresa, nome) do nothing;

-- 3) O nome padrão da chave nova, para loja sem a linha
create or replace function public.aura_etapa_da_chave(p_empresa text, p_chave text)
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- O nome que esta loja deu para esta chave. Se a loja nunca editou o funil
  -- (não há linha em etapas_funil), cai no padrão do sistema — os mesmos
  -- nomes de FUNIL_PADRAO em src/lib/funil.ts.
  select coalesce(
    (select nome from public.etapas_funil
      where empresa = p_empresa and chave = p_chave
      order by ordem limit 1),
    case p_chave
      when 'lead_frio'    then 'Leads frios'
      when 'prospeccao'   then 'Prospecção'
      when 'qualificacao' then 'Qualificação e Abordagem'
      when 'apresentacao' then 'Apresentação'
      when 'followup'     then 'Follow-up'
      when 'negociacao'   then 'Negociação'
      when 'fechamento'   then 'Fechamento'
      when 'posvenda'     then 'Pós-venda'
      when 'perda'        then 'Perdidos'
    end
  );
$function$;

-- 3b) E o caminho de volta: o nome padrão responde pela chave nova
create or replace function public.aura_chave_da_etapa(p_empresa text, p_etapa text)
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  -- A chave de um nome gravado. Os nomes antigos continuam respondendo porque
  -- ainda podem existir em dado histórico (relatório, análise de conversa) —
  -- é o mesmo mapa de CHAVE_DOS_NOMES_ANTIGOS em src/lib/funil.ts.
  select coalesce(
    (select chave from public.etapas_funil
      where empresa = p_empresa and nome = p_etapa
      order by ordem limit 1),
    case p_etapa
      when 'Leads frios'              then 'lead_frio'
      when 'Prospecção'               then 'prospeccao'
      when 'Qualificação'             then 'qualificacao'
      when 'Qualificação e Abordagem' then 'qualificacao'
      when 'Abordagem'                then 'qualificacao'
      when 'Apresentação'             then 'apresentacao'
      when 'Proposta'                 then 'followup'
      when 'Follow-up'                then 'followup'
      when 'Followup'                 then 'followup'
      when 'Negociação'               then 'negociacao'
      when 'Fechados'                 then 'fechamento'
      when 'Fechamento'               then 'fechamento'
      when 'Ganhos'                   then 'fechamento'
      when 'Pós-venda'                then 'posvenda'
      when 'Pos-venda'                then 'posvenda'
      when 'Perdidos'                 then 'perda'
      when 'Perdido'                  then 'perda'
    end
  );
$function$;

-- 4) O lead que vira negócio: respondido vai para a Prospecção (como antes),
--    lead frio vai para a coluna de leads frios.
create or replace function public.aura_lead_respondido_vira_pipeline()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_dono uuid;
  v_rel uuid;
  v_nome text;
  v_frio boolean;
  v_etapa_frio text;
  v_op uuid;
  v_op_etapa text;
begin
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
      -- Card que só existia porque o lead chegou volta para a coluna fria.
      -- Negócio que já andou (apresentação em diante) fica onde está.
      update public.oportunidades
         set etapa = v_etapa_frio, probabilidade = 'Baixa', updated_at = now()
       where id = v_op;
    end if;
    return new;
  end if;

  -- Lead frio que esquentou: o card sai da coluna fria e vai para a Prospecção.
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
$function$;

commit;
