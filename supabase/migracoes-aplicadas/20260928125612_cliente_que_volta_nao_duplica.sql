-- 20260928125612 cliente_que_volta_nao_duplica

-- O cliente que volta depois de um ano precisa cair na ficha que já existe,
-- não numa nova. Sem isso o histórico se parte em dois, o vendedor não vê
-- que já vendeu para aquela pessoa, e a recompra não pontua no ranking —
-- justamente o comportamento que o ranking novo quer premiar.
--
-- O telefone normalizado já existia e já era preenchido por gatilho; o que
-- faltava era impedir o segundo cadastro. Índice único por empresa, porque
-- o mesmo telefone pode ser cliente de duas lojas do grupo.
create unique index if not exists relacionamentos_telefone_unico_por_empresa
  on relacionamentos (empresa, telefone_normalizado)
  where telefone_normalizado is not null and telefone_normalizado <> '';

-- O gatilho que cria relacionamento a partir do WhatsApp passa a reaproveitar
-- a ficha existente em vez de esbarrar no índice.
create or replace function aura_achar_ou_criar_relacionamento(
  p_owner uuid,
  p_empresa text,
  p_nome text,
  p_telefone text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalizado text;
  v_id uuid;
begin
  v_normalizado := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');

  if v_normalizado <> '' then
    select id into v_id
      from relacionamentos
     where empresa = p_empresa
       and telefone_normalizado = v_normalizado
     limit 1;

    if v_id is not null then
      -- Cliente que voltou: atualiza o contato e devolve a ficha de sempre.
      update relacionamentos
         set ultimo_contato_em = now(),
             nome = case
                      when coalesce(nome, '') = '' or nome ~ '^\+?[0-9 ()-]+$'
                      then coalesce(nullif(p_nome, ''), nome)
                      else nome
                    end
       where id = v_id;
      return v_id;
    end if;
  end if;

  insert into relacionamentos (owner_id, empresa, nome, telefone, categoria, origem, ultimo_contato_em)
  values (p_owner, p_empresa, coalesce(nullif(p_nome, ''), p_telefone, 'Sem nome'),
          p_telefone, 'Cliente Final', 'WhatsApp', now())
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.aura_achar_ou_criar_relacionamento(uuid, text, text, text)
  from public, anon, authenticated;
