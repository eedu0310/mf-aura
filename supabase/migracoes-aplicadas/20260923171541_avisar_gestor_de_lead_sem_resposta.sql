-- 20260923171541 avisar_gestor_de_lead_sem_resposta

-- Antes, o lead vencido só marcava gestor_notificado = true e ninguém era
-- avisado de fato. Agora o gestor e o diretor da loja recebem a notificação.
CREATE OR REPLACE FUNCTION public.repassar_leads_expirados()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    and l.gestor_notificado = false;

  update public.leads_recebidos
  set gestor_notificado = true
  where status = 'repassado_vendedor'
    and prazo_resposta is not null
    and prazo_resposta < now()
    and gestor_notificado = false;

  return v_total;
end;
$$;
