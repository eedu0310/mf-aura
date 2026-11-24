-- 20261002130858 054_lead_distribuido_nasce_com_dono

-- O relacionamento nasce quando o lead ganha dono, e com esse dono.
--
-- DEFEITO: o webhook da API oficial criava o relacionamento ANTES de saber de
-- quem o lead seria, e por isso o criava SEM owner_id. Pior: antes de criar,
-- procurava um relacionamento existente por loja + telefone, sem olhar dono -
-- entao um lead novo se prendia ao registro de OUTRO vendedor que ja tivesse
-- aquele numero na carteira. Era mistura de lead pela porta de tras.
--
-- Nao foi essa via que cruzou a Sole (ela usa o WhatsApp ao vivo, e ali o
-- codigo ja recusava contato de outro vendedor), mas morderia no dia em que o
-- Instagram e a API oficial entrassem no ar.
--
-- CORRECAO: quem distribui o lead tambem garante o relacionamento. Faz sentido
-- estar aqui - e o unico ponto do sistema que sabe de quem o lead passou a
-- ser, e faz as duas coisas numa transacao so, sem janela em que o lead tem
-- dono e a carteira nao.
--
-- A busca por relacionamento existente passa a ser DENTRO da carteira do dono.
-- Se o numero ja esta com outro vendedor, nao reaproveita: cria o registro do
-- novo dono. Dois vendedores podem ter o mesmo numero na carteira (acontece:
-- construtora que fala com dois representantes), e isso e melhor do que um
-- vendedor herdar o contato do outro sem ninguem decidir.
create or replace function public.distribuir_lead_novo(p_lead_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_empresa text;
  v_sdr_id uuid;
  v_vendedor_id uuid;
  v_minutos int;
  v_dono uuid;
  v_rel uuid;
  v_tel text;
  v_tel_norm text;
  v_nome text;
begin
  select empresa, telefone, nome, relacionamento_id
    into v_empresa, v_tel, v_nome, v_rel
  from public.leads_recebidos where id = p_lead_id;

  select coalesce(tempo_resposta_sdr_minutos, 15) into v_minutos
  from public.config_distribuicao_leads where empresa = v_empresa;
  if v_minutos is null then v_minutos := 15; end if;

  select p.id into v_sdr_id
  from public.profiles p
  where p.empresa = v_empresa and p.cargo = 'SDR' and p.ativo = true
  order by (select max(created_at) from public.leads_recebidos lr where lr.sdr_id = p.id) nulls first
  limit 1;

  if v_sdr_id is not null then
    update public.leads_recebidos
       set status = 'atribuido_sdr',
           sdr_id = v_sdr_id,
           prazo_resposta = now() + (v_minutos || ' minutes')::interval
     where id = p_lead_id;
    v_dono := v_sdr_id;
  else
    select p.id into v_vendedor_id
    from public.profiles p
    where p.empresa = v_empresa and p.cargo = 'Vendedor Interno' and p.ativo = true
    order by (select max(created_at) from public.leads_recebidos lr where lr.vendedor_id = p.id) nulls first
    limit 1;

    if v_vendedor_id is null then
      select p.id into v_vendedor_id
      from public.profiles p
      where p.empresa = v_empresa and p.cargo = 'Vendedor' and p.ativo = true
      order by (select max(created_at) from public.leads_recebidos lr where lr.vendedor_id = p.id) nulls first
      limit 1;
    end if;

    update public.leads_recebidos
       set status = 'repassado_vendedor',
           vendedor_id = v_vendedor_id,
           prazo_resposta = now() + (v_minutos || ' minutes')::interval
     where id = p_lead_id;
    v_dono := v_vendedor_id;
  end if;

  -- Sem dono (loja sem ninguem ativo) nao se cria carteira: registro sem dono
  -- fica invisivel para todo vendedor e so o gestor acha. Melhor o lead ficar
  -- esperando distribuicao do que virar contato orfao.
  if v_dono is null or v_rel is not null or v_tel is null then
    return;
  end if;

  v_tel_norm := public.aura_normalizar_telefone(v_tel);
  if v_tel_norm is null or v_tel_norm = '' then
    return;
  end if;

  -- Procura NA CARTEIRA DO DONO, nao na loja inteira.
  select id into v_rel
  from public.relacionamentos
  where owner_id = v_dono and telefone_normalizado = v_tel_norm
  limit 1;

  if v_rel is null then
    insert into public.relacionamentos (
      owner_id, empresa, nome, categoria, cidade, telefone,
      temperatura, origem, observacao, ultimo_contato_em
    ) values (
      v_dono,
      v_empresa,
      coalesce(nullif(btrim(v_nome), ''), 'Lead WhatsApp ' || v_tel),
      'Cliente Final',
      'Não informado',
      v_tel,
      'quente',
      'WhatsApp',
      'Lead recebido automaticamente e distribuído pelo AURA.',
      now()
    )
    returning id into v_rel;
  end if;

  update public.leads_recebidos set relacionamento_id = v_rel where id = p_lead_id;
end;
$function$;
