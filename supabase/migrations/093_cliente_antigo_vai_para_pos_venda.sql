-- 093: cliente antigo vai para o pós-venda, e deixa de ser cobrado como lead.
--
-- O problema (Elton, 22/10/2026): cliente que comprou há um mês ou dois anos
-- manda mensagem, e a AURA trata como lead novo — "não está sendo atendido".
--
-- A causa no banco: marcar "Já é nosso cliente" cadastrava o contato na
-- carteira E o colocava na fila de leads (leads_recebidos) com prazo de 30
-- minutos. Ninguém "responde" um cliente antigo como se responde lead, o prazo
-- vencia e o gestor recebia "Lead sem resposta". Eram 18 clientes antigos
-- nessa fila no dia desta migração.
--
-- O que muda:
--   1. pos_vendas aceita cliente antigo, sem venda registrada (cliente de
--      antes do CRM não tem venda, e inventar uma seria faturamento falso):
--      origem 'cliente_antigo' e coluna própria no quadro, status
--      'cliente_antigo'. Um card por cliente.
--   2. A fila de leads ignora quem foi classificado como cliente ou não-lead
--      (coluna natureza, que já existia e ninguém preenchia): o gestor não é
--      mais avisado deles.
--   3. Acerto dos que já estavam marcados: saem da fila, ganham a etiqueta
--      "Cliente antigo" na carteira, ganham o card de pós-venda, e negócio
--      aberto que a IA tinha criado para eles vai para a etapa Pós-venda
--      (que não conta no pipeline nem como perda).

-- 1. pós-venda sem venda -------------------------------------------------

alter table public.pos_vendas alter column venda_id drop not null;

alter table public.pos_vendas
  add column if not exists origem text not null default 'venda';

alter table public.pos_vendas drop constraint if exists pos_vendas_origem_check;
alter table public.pos_vendas
  add constraint pos_vendas_origem_check check (origem in ('venda', 'cliente_antigo'));

-- Só o cliente antigo pode existir sem venda.
alter table public.pos_vendas drop constraint if exists pos_vendas_venda_ou_cliente_antigo;
alter table public.pos_vendas
  add constraint pos_vendas_venda_ou_cliente_antigo
  check (venda_id is not null or origem = 'cliente_antigo');

alter table public.pos_vendas drop constraint if exists pos_vendas_status_check;
alter table public.pos_vendas
  add constraint pos_vendas_status_check check (status = any (array[
    'aguardando_instalacao', 'agendamento_realizado', 'instalacao_pendente',
    'reclamacao', 'pos_venda_realizado', 'cliente_antigo'
  ]));

create unique index if not exists pos_vendas_cliente_antigo_unico
  on public.pos_vendas (relacionamento_id)
  where origem = 'cliente_antigo';

comment on column public.pos_vendas.origem is
  'venda = nasceu de uma venda registrada; cliente_antigo = cliente que comprou antes (ou fora) do CRM, marcado pelo vendedor no WhatsApp. Este não tem venda_id.';

-- 2. a fila de leads não cobra cliente nem não-lead ------------------------

create or replace function public.repassar_leads_expirados()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_vendedor_id uuid;
  v_minutos int;
  v_total int := 0;
begin
  -- 1) SDR passou do prazo: o lead vai para um vendedor.
  for r in
    select id, empresa, nome, telefone from public.leads_recebidos
    where status = 'atribuido_sdr'
      and prazo_resposta is not null
      and prazo_resposta < now()
      and coalesce(natureza, 'lead') = 'lead'
  loop
    select coalesce(tempo_resposta_sdr_minutos, 15) into v_minutos
    from public.config_distribuicao_leads where empresa = r.empresa;
    if v_minutos is null then v_minutos := 15; end if;

    select p.id into v_vendedor_id
    from public.profiles p
    where p.empresa = r.empresa and p.cargo = 'Vendedor Interno' and p.ativo = true
    order by (
      select max(created_at) from public.leads_recebidos lr where lr.vendedor_id = p.id
    ) nulls first
    limit 1;

    if v_vendedor_id is null then
      select p.id into v_vendedor_id
      from public.profiles p
      where p.empresa = r.empresa and p.cargo = 'Vendedor' and p.ativo = true
      order by (
        select max(created_at) from public.leads_recebidos lr where lr.vendedor_id = p.id
      ) nulls first
      limit 1;
    end if;

    update public.leads_recebidos
    set status = 'repassado_vendedor',
        vendedor_id = v_vendedor_id,
        prazo_resposta = now() + (v_minutos || ' minutes')::interval
    where id = r.id;

    v_total := v_total + 1;
  end loop;

  -- 2) Vendedor também passou do prazo: agora o gestor é avisado de verdade.
  --    Cliente da casa e não-lead não são lead: não há prazo a cobrar.
  insert into public.notificacoes (vendedor_id, titulo, mensagem, tipo, acao_url)
  select g.id,
         'Lead sem resposta na ' || l.empresa,
         coalesce(nullif(btrim(l.nome), ''), l.telefone, 'Um lead')
           || ' passou do prazo de resposta. Origem: ' || coalesce(l.origem, 'não informada') || '.',
         'alerta',
         '/gestor'
  from public.leads_recebidos l
  join public.profiles g
    on g.cargo in ('Gestor', 'Diretor')
   and g.ativo = true
   and (g.cargo = 'Diretor' or g.empresa = l.empresa)
  where l.status = 'repassado_vendedor'
    and l.prazo_resposta is not null
    and l.prazo_resposta < now()
    and l.gestor_notificado = false
    and coalesce(l.natureza, 'lead') = 'lead';

  update public.leads_recebidos
  set gestor_notificado = true
  where status = 'repassado_vendedor'
    and prazo_resposta is not null
    and prazo_resposta < now()
    and gestor_notificado = false
    and coalesce(natureza, 'lead') = 'lead';

  return v_total;
end;
$$;

-- 3. acerto de quem já estava marcado -------------------------------------

-- 3a. Sai da fila de leads (com registro de quem decidiu e quando).
update public.leads_recebidos lr
set natureza = w.natureza,
    motivo_natureza = coalesce(lr.motivo_natureza,
      case when w.natureza = 'cliente' then 'Cliente antigo' else w.motivo_natureza end),
    descartado_em = coalesce(lr.descartado_em, w.classificado_em, now()),
    descartado_por = coalesce(lr.descartado_por, w.classificado_por)
from (
  select distinct on (relacionamento_id)
         relacionamento_id, natureza, motivo_natureza, classificado_em, classificado_por
  from public.whatsapp_ia_leads
  where natureza in ('cliente', 'nao_lead') and ignorado and relacionamento_id is not null
  order by relacionamento_id, classificado_em desc nulls last
) w
where lr.relacionamento_id = w.relacionamento_id
  and lr.status <> 'respondido'
  and lr.natureza is null;

-- 3b. Etiqueta na carteira.
update public.relacionamentos r
set tags = array_append(r.tags, 'Cliente antigo'),
    updated_at = now()
where r.id in (
  select relacionamento_id from public.whatsapp_ia_leads
  where natureza = 'cliente' and ignorado and relacionamento_id is not null
)
  and not ('Cliente antigo' = any (r.tags));

-- 3c. Card de pós-venda para quem não tem venda nem pós-venda.
insert into public.pos_vendas (empresa, status, origem, relacionamento_id, vendedor_id,
                               cliente, telefone, produto, observacao)
select distinct on (w.relacionamento_id)
       r.empresa, 'cliente_antigo', 'cliente_antigo', r.id, w.owner_id,
       coalesce(nullif(btrim(r.nome), ''), w.nome, r.telefone),
       coalesce(r.telefone, w.telefone),
       coalesce(nullif(btrim(w.interesse), ''), 'Cliente antigo'),
       'Marcado como cliente antigo no WhatsApp.'
from public.whatsapp_ia_leads w
join public.relacionamentos r on r.id = w.relacionamento_id
where w.natureza = 'cliente' and w.ignorado
  and not exists (select 1 from public.pos_vendas pv where pv.relacionamento_id = r.id)
  and not exists (select 1 from public.vendas v where v.relacionamento_id = r.id)
order by w.relacionamento_id, w.classificado_em desc nulls last;

-- 3d. Negócio aberto criado para cliente antigo vai para a etapa Pós-venda.
--     Só etapas abertas: card em Fechamento já virou venda e não se mexe.
update public.oportunidades o
set etapa = public.aura_etapa_da_chave(o.empresa, 'posvenda'),
    updated_at = now()
from public.whatsapp_ia_leads w
where w.oportunidade_id = o.id
  and w.natureza = 'cliente' and w.ignorado
  and public.aura_etapa_da_chave(o.empresa, 'posvenda') is not null
  and coalesce(public.aura_chave_da_etapa(o.empresa, o.etapa), '')
      in ('prospeccao', 'qualificacao', 'apresentacao', 'followup', 'negociacao');
