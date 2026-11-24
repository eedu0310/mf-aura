-- 105: fecha os cargos que liberavam acesso sem aprovação, corrige a
-- categoria dos contatos que vêm de lead e cria a base das Sentinelas
-- (os agentes que vigiam a saúde do sistema).
--
-- Auditoria de 24/11/2026, conferida contra o esquema exportado
-- (supabase/esquema.sql) e não contra o repositório, que estava incompleto.
--
-- Pode rodar mais de uma vez: tudo é create or replace / drop if exists.
-- Nenhum perfil de produção perde acesso: ninguém tem cargo Diretor (o cargo
-- saiu da empresa) e os 4 gestores ativos são mestres aprovados.

begin;

-- ===================================================================
-- 1. O cadastro próprio não aceita cargo inventado.
-- ===================================================================
-- A regra de criação conferia gestor_mestre e gestor_aprovado, mas deixava o
-- cargo livre. O cargo "Diretor" saiu da empresa e da base, mas ficou nas
-- funções do banco enxergando as quatro lojas SEM aprovação: qualquer conta
-- sem perfil podia nascer Diretor com a chave pública e ler clientes, leads e
-- vendas de todas as lojas. Agora o cadastro só aceita os cargos da tela, e
-- "Gestor" continua nascendo sem aprovação (espera o gestor mestre).
alter policy "Usuário pode criar o próprio perfil" on public.profiles
  with check (
    (select auth.uid()) = id
    and gestor_mestre = false
    and gestor_aprovado = false
    and cargo in ('Vendedor', 'Vendedor Interno', 'SDR', 'Marketing', 'Pós-venda', 'Gestor')
    and (empresa is null or empresa in ('MF International', 'LF Lareiras', 'A&G Aquecimento', 'Sole Aquecimento'))
  );

-- ===================================================================
-- 2. O cargo "Diretor" sai das funções de acesso.
-- ===================================================================
-- Quem vê a loja toda é o Gestor aprovado; quem vê as quatro lojas é o
-- gestor mestre aprovado. Mais ninguém.
create or replace function public.vejo_a_loja_toda()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.ativo is not false
       and p.cargo = 'Gestor'
       and p.gestor_aprovado
    from public.profiles p where p.id = auth.uid()
  ), false);
$$;

create or replace function public.pode_ver_todas_empresas()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.ativo is not false
       and p.cargo = 'Gestor'
       and p.gestor_aprovado
       and coalesce(p.gestor_mestre, false)
    from public.profiles p where p.id = auth.uid()
  ), false);
$$;

-- Régua da loja: quem manda na loja do registro, ou em todas.
create or replace function public.administro_a_loja(p_empresa text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode_ver_todas_empresas()
      or (public.vejo_a_loja_toda() and p_empresa is not distinct from public.minha_empresa());
$$;

-- Mesma régua, a partir do dono do registro (tabelas sem coluna empresa).
create or replace function public.administro_o_dono(p_dono uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode_ver_todas_empresas()
      or (public.vejo_a_loja_toda()
          and exists (select 1 from public.profiles d
                      where d.id = p_dono and d.empresa = public.minha_empresa()));
$$;

-- Marketing lê os números da própria loja (migração 065), nunca das outras.
create or replace function public.marketing_da_loja(p_empresa text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode_ver_marketing() and p_empresa is not distinct from public.minha_empresa();
$$;

revoke all on function public.administro_a_loja(text) from public, anon;
revoke all on function public.administro_o_dono(uuid) from public, anon;
revoke all on function public.marketing_da_loja(text) from public, anon;
grant execute on function public.administro_a_loja(text) to authenticated, service_role;
grant execute on function public.administro_o_dono(uuid) to authenticated, service_role;
grant execute on function public.marketing_da_loja(text) to authenticated, service_role;

-- ===================================================================
-- 3. Políticas que conferiam o cargo cru.
-- ===================================================================
-- A 061 reescreveu as políticas que usavam meu_cargo() = 'Gestor', mas estas
-- testavam p.cargo direto e ficaram para trás. Efeito: um "Gestor" recém-
-- cadastrado, ainda sem aprovação, já lia supervisões, metas e indicadores
-- da loja — e em metas_indicadores, indicadores_semanais e planilha_linhas,
-- de TODAS as lojas, porque nem a loja era conferida. Algumas regras de
-- escrita usavam vejo_a_loja_toda() sem loja: o gestor de uma loja editava
-- metas da outra.

-- aura_recomendacoes / aura_supervisoes
drop policy if exists "Gestor vê recomendações da loja" on public.aura_recomendacoes;
create policy "Gestor vê recomendações da loja" on public.aura_recomendacoes
  for select using (public.administro_a_loja(empresa));

drop policy if exists "Gestor vê supervisões da loja" on public.aura_supervisoes;
create policy "Gestor vê supervisões da loja" on public.aura_supervisoes
  for select using (public.administro_a_loja(empresa));

-- metas
drop policy if exists "Ver metas conforme papel" on public.metas;
create policy "Ver metas conforme papel" on public.metas
  for select using (owner_id = (select auth.uid()) or public.administro_o_dono(owner_id));

drop policy if exists "Atualizar metas conforme papel" on public.metas;
create policy "Atualizar metas conforme papel" on public.metas
  for update using (owner_id = (select auth.uid()) or public.administro_o_dono(owner_id))
  with check (owner_id = (select auth.uid()) or public.administro_o_dono(owner_id));

drop policy if exists "Criar metas conforme papel" on public.metas;
create policy "Criar metas conforme papel" on public.metas
  for insert with check (owner_id = (select auth.uid()) or public.administro_o_dono(owner_id));

-- metas_atividade
drop policy if exists "Gestor gerencia metas de atividade" on public.metas_atividade;
create policy "Gestor gerencia metas de atividade" on public.metas_atividade
  for all using (public.administro_o_dono(vendedor_id))
  with check (public.administro_o_dono(vendedor_id));

drop policy if exists "Ver metas de atividade conforme papel" on public.metas_atividade;
create policy "Ver metas de atividade conforme papel" on public.metas_atividade
  for select using (vendedor_id = (select auth.uid()) or public.administro_o_dono(vendedor_id));

-- metas_indicadores
drop policy if exists "Gestor gerencia metas de indicadores" on public.metas_indicadores;
create policy "Gestor gerencia metas de indicadores" on public.metas_indicadores
  for all using (public.administro_a_loja(empresa))
  with check (public.administro_a_loja(empresa));

drop policy if exists "Ver metas de indicadores conforme papel" on public.metas_indicadores;
create policy "Ver metas de indicadores conforme papel" on public.metas_indicadores
  for select using (
    vendedor_id = (select auth.uid())
    or public.administro_a_loja(empresa)
    or public.marketing_da_loja(empresa)
  );

-- indicadores_semanais (a trava restritiva da loja continua valendo por cima)
drop policy if exists "Ver indicadores conforme papel" on public.indicadores_semanais;
create policy "Ver indicadores conforme papel" on public.indicadores_semanais
  for select using (
    vendedor_id = (select auth.uid())
    or public.administro_a_loja(empresa)
    or public.marketing_da_loja(empresa)
  );

drop policy if exists "Vendedor gerencia os próprios indicadores" on public.indicadores_semanais;
create policy "Vendedor gerencia os próprios indicadores" on public.indicadores_semanais
  for all using (vendedor_id = (select auth.uid()) or public.administro_a_loja(empresa))
  with check (vendedor_id = (select auth.uid()) or public.administro_a_loja(empresa));

-- planilha_linhas
drop policy if exists planilha_linhas_leitura on public.planilha_linhas;
create policy planilha_linhas_leitura on public.planilha_linhas
  for select using (empresa = public.minha_empresa() or public.pode_ver_todas_empresas());

drop policy if exists planilha_linhas_gestor_escreve on public.planilha_linhas;
create policy planilha_linhas_gestor_escreve on public.planilha_linhas
  for all using (public.administro_a_loja(empresa))
  with check (public.administro_a_loja(empresa));

-- planilha_leads_indicadores (a leitura já tinha trava restritiva; a regra
-- permissiva ainda listava o cargo cru)
drop policy if exists marketing_see_all on public.planilha_leads_indicadores;
create policy marketing_see_all on public.planilha_leads_indicadores
  for select using (
    usuario_id = (select auth.uid())
    or public.administro_o_dono(usuario_id)
    or (public.pode_ver_marketing()
        and exists (select 1 from public.profiles d
                    where d.id = planilha_leads_indicadores.usuario_id
                      and d.empresa = public.minha_empresa()))
  );

-- pos_vendas: Diretor cru e Gestor sem aprovação
drop policy if exists pos_vendas_insert on public.pos_vendas;
create policy pos_vendas_insert on public.pos_vendas
  for insert to authenticated with check (
    vendedor_id = (select auth.uid())
    or public.administro_a_loja(empresa)
    or (public.meu_cargo() = 'Pós-venda' and empresa = public.minha_empresa()
        and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ativo is not false))
  );

drop policy if exists pos_vendas_update on public.pos_vendas;
create policy pos_vendas_update on public.pos_vendas
  for update to authenticated
  using (
    responsavel_id = (select auth.uid())
    or public.administro_a_loja(empresa)
    or (public.meu_cargo() = 'Pós-venda' and empresa = public.minha_empresa()
        and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ativo is not false))
  )
  with check (
    responsavel_id = (select auth.uid())
    or public.administro_a_loja(empresa)
    or (public.meu_cargo() = 'Pós-venda' and empresa = public.minha_empresa()
        and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.ativo is not false))
  );

-- pos_venda_notas: o ramo "Diretor" enxergava as notas de todas as lojas
drop policy if exists "Criar notas conforme papel" on public.pos_venda_notas;
create policy "Criar notas conforme papel" on public.pos_venda_notas
  for insert with check (exists (
    select 1 from public.pos_vendas pv
    where pv.id = pos_venda_notas.pos_venda_id
      and (public.administro_a_loja(pv.empresa)
           or (public.meu_cargo() = 'Pós-venda' and pv.empresa = public.minha_empresa()))
  ));

drop policy if exists "Ver notas conforme papel" on public.pos_venda_notas;
create policy "Ver notas conforme papel" on public.pos_venda_notas
  for select using (exists (
    select 1 from public.pos_vendas pv
    where pv.id = pos_venda_notas.pos_venda_id
      and (public.administro_a_loja(pv.empresa)
           or (public.meu_cargo() = 'Pós-venda' and pv.empresa = public.minha_empresa()))
  ));

-- transferencias_carteira
drop policy if exists transferencias_select on public.transferencias_carteira;
create policy transferencias_select on public.transferencias_carteira
  for select to authenticated using (public.administro_a_loja(empresa));

-- profiles: Diretor cru na regra de desativar
drop policy if exists "Gestor desativa vendedor da própria loja" on public.profiles;
create policy "Gestor desativa vendedor da própria loja" on public.profiles
  for update using (public.administro_a_loja(empresa))
  with check (public.administro_a_loja(empresa));

-- ===================================================================
-- 4. Contato que vem de lead nasce "Cliente Final".
-- ===================================================================
-- O gatilho gravava categoria 'Cliente', que o app não conhece (o tipo só
-- tem "Cliente Final"): o contato não aparecia em filtro nenhum e ficava sem
-- cor nem rótulo. Corrige o gatilho e os 8 contatos que já nasceram assim.
update public.relacionamentos set categoria = 'Cliente Final' where categoria = 'Cliente';

do $$
declare
  v_def text;
begin
  select pg_get_functiondef('public.aura_lead_respondido_vira_pipeline()'::regprocedure) into v_def;
  if v_def is not null and position('''Cliente'',' in v_def) > 0 then
    v_def := replace(v_def, 'new.email, ''Cliente'',', 'new.email, ''Cliente Final'',');
    execute v_def;
  end if;
end $$;

-- ===================================================================
-- 5. Soma do gasto da IA no banco.
-- ===================================================================
-- O teto de gasto somava ia_uso no servidor, e o Supabase devolve no máximo
-- 1000 linhas por consulta. Com 21 mil linhas, o "gasto" era o das últimas
-- mil chamadas: o bloqueio por falta de saldo nunca disparava e o painel do
-- gestor mostrava um consumo menor que o real. A soma agora é feita aqui.
--
-- O SALDO conta o gasto a partir do PRIMEIRO DEPÓSITO registrado, não desde
-- sempre. O único depósito (US$ 178,50) é de 05/11/2026, e o ia_uso tem gasto
-- desde setembro, pago com crédito que nunca foi registrado aqui. Somar tudo
-- daria saldo negativo e, com bloquear_sem_saldo ligado, desligaria a AURA
-- para todo mundo no minuto seguinte ao deploy.
drop function if exists public.aura_ia_totais(timestamptz, timestamptz);
create or replace function public.aura_ia_totais(p_inicio_dia timestamptz, p_inicio_mes timestamptz)
returns table (gasto_total numeric, gasto_hoje numeric, gasto_mes numeric, chamadas_hoje bigint,
               depositado numeric, gasto_desde_deposito numeric)
language sql stable security definer set search_path = public as $$
  select
    coalesce((select sum(custo_usd) from public.ia_uso), 0),
    coalesce((select sum(custo_usd) from public.ia_uso where criado_em >= p_inicio_dia), 0),
    coalesce((select sum(custo_usd) from public.ia_uso where criado_em >= p_inicio_mes), 0),
    (select count(*) from public.ia_uso where criado_em >= p_inicio_dia),
    coalesce((select sum(valor_usd) from public.ia_creditos), 0),
    coalesce((select sum(u.custo_usd) from public.ia_uso u
              where u.criado_em >= (select min(c.criado_em) from public.ia_creditos c)), 0);
$$;
revoke all on function public.aura_ia_totais(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.aura_ia_totais(timestamptz, timestamptz) to service_role;

-- ===================================================================
-- 6. Sentinelas: diário dos crons e relatório de saúde.
-- ===================================================================
create table if not exists public.aura_execucoes_cron (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  inicio timestamptz not null default now(),
  fim timestamptz,
  ok boolean not null default true,
  detalhe jsonb
);
create index if not exists aura_execucoes_cron_nome_inicio_idx on public.aura_execucoes_cron (nome, inicio desc);
alter table public.aura_execucoes_cron enable row level security;
-- Sem política: só a chave de serviço lê e grava. Quem lê é a Sentinela.

create table if not exists public.aura_sentinela (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  sentinela text not null,
  nivel text not null check (nivel in ('ok', 'atencao', 'critico')),
  achados jsonb not null default '[]'::jsonb,
  resumo text
);
create index if not exists aura_sentinela_criado_idx on public.aura_sentinela (criado_em desc);
alter table public.aura_sentinela enable row level security;
drop policy if exists "Gestor mestre lê a saúde do sistema" on public.aura_sentinela;
create policy "Gestor mestre lê a saúde do sistema" on public.aura_sentinela
  for select to authenticated using (public.pode_ver_todas_empresas());

-- Tabelas públicas sem RLS: a Sentinela de Segurança pergunta isto todo dia.
create or replace function public.aura_tabelas_sem_rls()
returns table (tabela text)
language sql stable security definer set search_path = public, pg_catalog as $$
  select c.relname::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  order by 1;
$$;

-- Políticas abertas para qualquer logado (using true) em tabela com dado de
-- cliente: a Sentinela de Segurança lista para o gestor decidir.
create or replace function public.aura_politicas_abertas()
returns table (tabela text, politica text, comando text)
language sql stable security definer set search_path = public, pg_catalog as $$
  select tablename::text, policyname::text, cmd::text
  from pg_policies
  where schemaname = 'public'
    and permissive = 'PERMISSIVE'
    and (qual = 'true' or with_check = 'true')
  order by 1, 2;
$$;

revoke all on function public.aura_tabelas_sem_rls() from public, anon, authenticated;
revoke all on function public.aura_politicas_abertas() from public, anon, authenticated;
grant execute on function public.aura_tabelas_sem_rls() to service_role;
grant execute on function public.aura_politicas_abertas() to service_role;

commit;
