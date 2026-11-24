-- 20260928125852 gestores_mestres_e_permissoes

-- Hoje qualquer pessoa que se cadastre escolhendo "Gestor" vira gestor, com
-- acesso a tudo: faturamento do grupo, carteira de todos, custo da IA.
-- Não existe nenhuma aprovação no caminho.
--
-- Passa a existir gestor mestre: ele é quem aprova os outros gestores e
-- define o que cada pessoa pode ver e fazer. Um gestor não aprovado entra
-- como pendente e enxerga só o próprio dia.

alter table profiles
  add column if not exists gestor_mestre boolean not null default false,
  add column if not exists gestor_aprovado boolean not null default false,
  add column if not exists aprovado_por uuid,
  add column if not exists aprovado_em timestamptz,
  -- O que este usuário pode, além do que o cargo já dá. Cada chave é uma
  -- permissão; ausente significa o padrão do cargo.
  add column if not exists permissoes jsonb not null default '{}'::jsonb;

comment on column profiles.gestor_mestre is
  'Pode aprovar outros gestores e alterar permissões. Só outro mestre concede.';
comment on column profiles.permissoes is
  'Ajustes por pessoa sobre o padrão do cargo, por chave. Ex.: {"definir_propria_meta": false}.';

-- Charles e Elton entram como mestres; o Alexandre entra quando o e-mail
-- dele for informado.
update profiles set gestor_mestre = true, gestor_aprovado = true, aprovado_em = now()
where id in (
  select u.id from auth.users u
  where u.email in ('lflareiras23@gmail.com', 'charles@mfinternational.com.br')
);

-- Quem já é gestor hoje e não é mestre fica aprovado, para ninguém perder
-- acesso de uma migração para a outra.
update profiles set gestor_aprovado = true, aprovado_em = now()
where cargo = 'Gestor' and gestor_aprovado = false;

/** Gestor que passou pela aprovação de um mestre. */
create or replace function gestor_ativo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.cargo = 'Gestor' and p.gestor_aprovado and p.ativo is not false
       from profiles p where p.id = auth.uid()),
    false)
$$;

create or replace function gestor_mestre()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.gestor_mestre and p.ativo is not false
       from profiles p where p.id = auth.uid()),
    false)
$$;

revoke execute on function public.gestor_ativo() from public, anon;
revoke execute on function public.gestor_mestre() from public, anon;
grant execute on function public.gestor_ativo() to authenticated;
grant execute on function public.gestor_mestre() to authenticated;

-- Ninguém se promove sozinho: virar mestre ou aprovar-se como gestor só
-- acontece pela mão de um mestre, nunca pela própria.
create policy profiles_nao_se_autopromove on profiles
  as restrictive
  for update
  using (
    gestor_mestre()
    or id = auth.uid()
  )
  with check (
    gestor_mestre()
    or (
      id = auth.uid()
      and gestor_mestre = (select p.gestor_mestre from profiles p where p.id = auth.uid())
      and gestor_aprovado = (select p.gestor_aprovado from profiles p where p.id = auth.uid())
      and cargo = (select p.cargo from profiles p where p.id = auth.uid())
    )
  );
