-- 20261103132448 101_aviso_do_lead_com_whatsapp

create or replace function public.aura_avisar_dono_do_lead()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_dono uuid;
  v_nome text;
  v_fone text;
  v_do_site boolean;
  v_recado text;
begin
  v_dono := coalesce(new.vendedor_id, new.sdr_id);
  if v_dono is null then return new; end if;
  if tg_op = 'UPDATE'
     and coalesce(old.vendedor_id, old.sdr_id) is not distinct from v_dono then
    return new;
  end if;

  v_nome := coalesce(nullif(btrim(new.nome), ''), new.telefone, 'Novo lead');
  v_fone := regexp_replace(coalesce(new.telefone, ''), '\D', '', 'g');
  v_do_site := coalesce(new.origem, '') ilike 'Site MF%';
  v_recado := nullif(btrim(regexp_replace(coalesce(new.mensagem_inicial, ''), '\s+', ' ', 'g')), '');
  if v_recado is not null and length(v_recado) > 220 then
    v_recado := left(v_recado, 217) || '...';
  end if;

  insert into public.notificacoes (vendedor_id, titulo, mensagem, tipo, acao_url)
  values (
    v_dono,
    case when v_do_site then '🌐 Lead do site para você chamar' else 'Lead novo para chamar' end,
    v_nome || ' · ' || coalesce(new.origem, 'origem não informada')
      || case when v_fone <> '' then ' · WhatsApp +' || v_fone else '' end
      || case when v_recado is not null then E'\n' || v_recado else '' end
      || E'\nToque para chamar no WhatsApp. Responda antes do prazo.',
    'lead',
    case when v_fone <> '' then '/whatsapp?numero=' || v_fone else '/leads' end
  );
  return new;
end;
$function$;
