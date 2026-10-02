-- O relacionamento nasce quando o lead ganha dono, e com esse dono.
-- (Migrations 054 e 055 juntas: a 055 corrigiu um defeito achado no teste da 054.)
--
-- DEFEITO 1: o webhook da API oficial criava o relacionamento ANTES de saber de
-- quem o lead seria, e por isso o criava SEM owner_id. Pior: antes de criar,
-- procurava relacionamento existente por loja + telefone, sem olhar dono -
-- entao um lead novo se prendia ao registro de OUTRO vendedor que ja tivesse
-- aquele numero. Era mistura de lead pela porta de tras. Nao foi essa via que
-- cruzou a Sole (o WhatsApp ao vivo ja recusava contato de outro vendedor),
-- mas morderia quando o Instagram entrasse no ar.
--
-- DEFEITO 2, achado testando a correcao do primeiro: existe um gatilho
-- (trg_aura_distribuir_lead_ao_entrar) que distribui o lead ao entrar, e o
-- webhook chamava distribuir_lead_novo DE NOVO. O gatilho tem guarda de
-- status; a funcao nao tinha. A segunda chamada refazia o sorteio e, como o
-- sorteio e por quem recebeu lead menos recentemente, caia em OUTRO vendedor:
-- o lead terminava dizendo um nome e a carteira dizendo outro. No teste,
-- vendedor_id da Denise com relacionamento da Jucelane.
--
-- A guarda agora mora na funcao, nao no chamador - protege tambem codigo
-- futuro que chame isto sem saber do gatilho.
create or replace function public.distribuir_lead_novo(p_lead_id uuid)
returns void language plpgsql security definer set search_path = public
as $function$
declare
  v_empresa text; v_sdr_id uuid; v_vendedor_id uuid; v_minutos int;
  v_dono uuid; v_rel uuid; v_tel text; v_tel_norm text; v_nome text;
  v_ja_tem_dono boolean;
begin
  select empresa, telefone, nome, relacionamento_id,
         (vendedor_id is not null or sdr_id is not null)
    into v_empresa, v_tel, v_nome, v_rel, v_ja_tem_dono
  from public.leads_recebidos where id = p_lead_id;

  if v_empresa is null then return; end if;

  if v_ja_tem_dono then
    -- Ja distribuido: nao sorteia de novo. Segue so para garantir a carteira.
    select coalesce(vendedor_id, sdr_id) into v_dono
    from public.leads_recebidos where id = p_lead_id;
  else
    select coalesce(tempo_resposta_sdr_minutos, 15) into v_minutos
    from public.config_distribuicao_leads where empresa = v_empresa;
    if v_minutos is null then v_minutos := 15; end if;

    select p.id into v_sdr_id from public.profiles p
    where p.empresa = v_empresa and p.cargo = 'SDR' and p.ativo = true
    order by (select max(created_at) from public.leads_recebidos lr where lr.sdr_id = p.id) nulls first
    limit 1;

    if v_sdr_id is not null then
      update public.leads_recebidos
         set status = 'atribuido_sdr', sdr_id = v_sdr_id,
             prazo_resposta = now() + (v_minutos || ' minutes')::interval
       where id = p_lead_id;
      v_dono := v_sdr_id;
    else
      select p.id into v_vendedor_id from public.profiles p
      where p.empresa = v_empresa and p.cargo = 'Vendedor Interno' and p.ativo = true
      order by (select max(created_at) from public.leads_recebidos lr where lr.vendedor_id = p.id) nulls first
      limit 1;

      if v_vendedor_id is null then
        select p.id into v_vendedor_id from public.profiles p
        where p.empresa = v_empresa and p.cargo = 'Vendedor' and p.ativo = true
        order by (select max(created_at) from public.leads_recebidos lr where lr.vendedor_id = p.id) nulls first
        limit 1;
      end if;

      update public.leads_recebidos
         set status = 'repassado_vendedor', vendedor_id = v_vendedor_id,
             prazo_resposta = now() + (v_minutos || ' minutes')::interval
       where id = p_lead_id;
      v_dono := v_vendedor_id;
    end if;
  end if;

  -- Sem dono (loja sem ninguem ativo) nao se cria carteira: registro sem dono
  -- fica invisivel para todo vendedor. Melhor o lead esperar do que virar orfao.
  if v_dono is null or v_rel is not null or v_tel is null then return; end if;

  v_tel_norm := public.aura_normalizar_telefone(v_tel);
  if v_tel_norm is null or v_tel_norm = '' then return; end if;

  -- Procura NA CARTEIRA DO DONO, nao na loja inteira.
  select id into v_rel from public.relacionamentos
  where owner_id = v_dono and telefone_normalizado = v_tel_norm limit 1;

  if v_rel is null then
    insert into public.relacionamentos (
      owner_id, empresa, nome, categoria, cidade, telefone,
      temperatura, origem, observacao, ultimo_contato_em
    ) values (
      v_dono, v_empresa,
      coalesce(nullif(btrim(v_nome), ''), 'Lead WhatsApp ' || v_tel),
      'Cliente Final', 'Não informado', v_tel, 'quente', 'WhatsApp',
      'Lead recebido automaticamente e distribuído pelo AURA.', now()
    ) returning id into v_rel;
  end if;

  update public.leads_recebidos set relacionamento_id = v_rel where id = p_lead_id;
end;
$function$;
