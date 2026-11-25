-- 108 · Equipe de agentes da AURA e base de conhecimento que nunca se perde
--
-- Pedido do Elton (25/11/2026): um agente para cada função do CRM, um
-- "escritório virtual" onde eles conversam e uma Diretora comandando todos;
-- e a base de conhecimento da AURA guardada de um jeito que nada se perca.
-- O desenho está em docs/agentes.md; o contrato, em src/lib/agentes/tipos.ts.
--
-- O QUE ESTA MIGRAÇÃO FAZ
--   1. aura_agentes ............ liga/desliga e orçamento de cada agente, e os
--                                agentes criados pela equipe (configuráveis).
--   2. aura_agente_execucoes ... diário de cada rodada de cada agente.
--   3. aura_escritorio_mensagens a conversa do escritório (relatos, pedidos,
--                                respostas, plano do dia).
--   4. aura_agente_propostas ... agentes novos propostos, esperando o gestor.
--   5. aura_recomendacoes ...... passa a receber os achados dos agentes, sem
--                                repetir (agente + chave) e com validade.
--   6. aura_conhecimento_historico: toda inclusão, alteração e exclusão na
--                                base de conhecimento vira uma linha que
--                                ninguém (fora o service_role) altera ou apaga.
--   7. RLS em tudo: gestor aprovado lê; ninguém de fora lê nada; escrita só
--      pelo servidor (service_role), atrás das rotas que conferem o login.
--
-- ORDEM: 105 → 106 → 107 → 108. Esta usa administro_a_loja(), criada na 105.
-- Sem a 105 ela para no bloco 0, sem mudar nada.
--
-- Pode rodar mais de uma vez: tudo é "if not exists", "drop ... if exists"
-- antes de "create" e "create or replace".
--
-- NENHUM TETO DE TAMANHO: texto é text, estrutura é jsonb, sem limite de
-- caracteres. Base de conhecimento cortada por tamanho é base que perde.
--
-- Tudo numa transação só: se qualquer passo falhar, nada fica pela metade.

begin;

-- ===================================================================
-- 0. Trava: a 105 precisa estar aplicada.
-- ===================================================================
do $$
begin
  if to_regprocedure('public.administro_a_loja(text)') is null then
    raise exception 'Aplique a migração 105 antes da 108 (falta administro_a_loja).';
  end if;
  if to_regprocedure('public.pode_ver_todas_empresas()') is null
     or to_regprocedure('public.vejo_a_loja_toda()') is null
     or to_regprocedure('public.minha_empresa()') is null then
    raise exception 'Faltam as funções de acesso (pode_ver_todas_empresas, vejo_a_loja_toda, minha_empresa).';
  end if;
  if to_regclass('public.aura_execucoes_cron') is null then
    raise exception 'Aplique a migração 105 antes da 108 (falta aura_execucoes_cron).';
  end if;
end $$;

-- Gestor aprovado (da loja ou mestre). É a régua de leitura do escritório:
-- vendedor não vê o escritório, só os achados que são dele (no Meu Dia).
create or replace function public.sou_gestor_aprovado()
returns boolean language sql stable security definer set search_path = public as $$
  select public.pode_ver_todas_empresas() or public.vejo_a_loja_toda();
$$;
revoke all on function public.sou_gestor_aprovado() from public, anon;
grant execute on function public.sou_gestor_aprovado() to authenticated, service_role;

-- ===================================================================
-- 1. Propostas de agente novo (vem antes de aura_agentes por causa da FK).
-- ===================================================================
-- Um agente (quase sempre a Diretora) vê um buraco que ninguém cobre e
-- propõe um agente configurável. Só nasce se o gestor mestre aprovar.
create table if not exists public.aura_agente_propostas (
  id uuid primary key default gen_random_uuid(),
  proposto_por text not null,
  nome text not null,
  setor text not null,
  missao text not null default '',
  justificativa text not null default '',
  config jsonb not null default '{}'::jsonb,
  status text not null default 'proposta'
    check (status in ('proposta', 'aprovada', 'recusada', 'criada')),
  decidido_por uuid,
  decidido_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists aura_agente_propostas_status_idx
  on public.aura_agente_propostas (status, criado_em desc);
-- A mesma ideia não entra duas vezes enquanto está aberta.
create unique index if not exists aura_agente_propostas_nome_aberta_idx
  on public.aura_agente_propostas (lower(nome))
  where status in ('proposta', 'aprovada');

-- ===================================================================
-- 2. Agentes: o que o banco acrescenta ao registro do código.
-- ===================================================================
-- Os agentes nativos e as rotinas do sistema moram no código
-- (src/lib/agentes). Uma linha aqui SOBREPÕE o que o código diz (ligado ou
-- desligado, orçamento) e é onde vivem os agentes configuráveis criados a
-- partir de uma proposta aprovada.
create table if not exists public.aura_agentes (
  id text primary key,
  nome text not null,
  cargo text not null default '',
  setor text not null default 'gestao'
    check (setor in ('direcao', 'vendas', 'pos-venda', 'marketing', 'gestao', 'conhecimento', 'dados')),
  icone text not null default 'Bot',
  missao text not null default '',
  tipo text not null default 'configuravel'
    check (tipo in ('nativo', 'sistema', 'configuravel')),
  ativo boolean not null default true,
  agenda jsonb,
  usa_ia boolean not null default false,
  orcamento_mensal_usd numeric not null default 0 check (orcamento_mensal_usd >= 0),
  config jsonb not null default '{}'::jsonb,
  criado_por text not null default 'sistema'
    check (criado_por in ('sistema', 'diretora', 'agente', 'gestor')),
  proposta_id uuid references public.aura_agente_propostas(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create or replace function public.aura_agentes_toca_atualizado_em()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists aura_agentes_atualizado_em on public.aura_agentes;
create trigger aura_agentes_atualizado_em before update on public.aura_agentes
  for each row execute function public.aura_agentes_toca_atualizado_em();

-- ===================================================================
-- 3. Diário de execuções dos agentes.
-- ===================================================================
-- Sem FK para aura_agentes de propósito: o agente nativo existe no código e
-- pode nunca ter ganhado linha lá.
create table if not exists public.aura_agente_execucoes (
  id uuid primary key default gen_random_uuid(),
  agente_id text not null,
  inicio timestamptz not null default now(),
  fim timestamptz,
  status text not null default 'rodando' check (status in ('rodando', 'ok', 'erro')),
  resumo text,
  achados integer not null default 0,
  metricas jsonb not null default '{}'::jsonb,
  custo_usd numeric not null default 0,
  erro text
);
create index if not exists aura_agente_execucoes_agente_inicio_idx
  on public.aura_agente_execucoes (agente_id, inicio desc);
create index if not exists aura_agente_execucoes_inicio_idx
  on public.aura_agente_execucoes (inicio desc);

-- ===================================================================
-- 4. O escritório: o que os agentes dizem uns aos outros.
-- ===================================================================
-- para_agente: null = para a Diretora; 'todos' = mural; ou o id do agente.
create table if not exists public.aura_escritorio_mensagens (
  id uuid primary key default gen_random_uuid(),
  de_agente text not null,
  para_agente text,
  tipo text not null
    check (tipo in ('relato', 'pedido', 'resposta', 'ideia', 'alerta', 'aprendizado', 'plano')),
  texto text not null,
  empresa text,
  dados jsonb not null default '{}'::jsonb,
  lida_por_agente boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists aura_escritorio_mensagens_criado_idx
  on public.aura_escritorio_mensagens (criado_em desc);
create index if not exists aura_escritorio_mensagens_caixa_idx
  on public.aura_escritorio_mensagens (para_agente, lida_por_agente, criado_em desc);

-- ===================================================================
-- 5. aura_recomendacoes recebe os achados dos agentes.
-- ===================================================================
-- Até aqui só a Supervisão gravava recomendação, sempre presa a uma
-- supervisão. Achado de agente não tem supervisão: a coluna vira opcional.
alter table public.aura_recomendacoes alter column supervisao_id drop not null;

alter table public.aura_recomendacoes add column if not exists agente text;
-- Chave estável do problema ("followup:vencido:<id>"): o motor atualiza a
-- recomendação pendente em vez de criar outra igual a cada rodada.
alter table public.aura_recomendacoes add column if not exists chave text;
-- Depois disso some sozinha (status 'expirada') se ninguém resolveu.
alter table public.aura_recomendacoes add column if not exists expira_em timestamptz;
-- Mensagem de WhatsApp sugerida pela IA (o vendedor é quem envia).
alter table public.aura_recomendacoes add column if not exists mensagem_sugerida text;
alter table public.aura_recomendacoes add column if not exists atualizado_em timestamptz not null default now();
-- Para onde o botão do card leva e se ele mostra "Gerar mensagem".
alter table public.aura_recomendacoes add column if not exists acao_url text;
alter table public.aura_recomendacoes add column if not exists pode_gerar_mensagem boolean not null default false;

-- Dois estados novos, ambos escritos só pelo motor:
--   expirada ........... passou do prazo de validade sem ninguém resolver;
--   resolvida_sozinha .. o agente rodou de novo e o problema não existe mais
--                        (o vendedor resolveu sem marcar o card).
alter table public.aura_recomendacoes drop constraint if exists aura_recomendacoes_status_check;
alter table public.aura_recomendacoes add constraint aura_recomendacoes_status_check
  check (status in ('pendente', 'concluida', 'dispensada', 'expirada', 'resolvida_sozinha'));

-- Um problema aberto por agente: é o que impede o card de se repetir.
create unique index if not exists aura_recomendacoes_agente_chave_pendente_idx
  on public.aura_recomendacoes (agente, chave)
  where status = 'pendente' and agente is not null;
create index if not exists aura_recomendacoes_agente_status_idx
  on public.aura_recomendacoes (agente, status, atualizado_em desc)
  where agente is not null;

-- atualizado_em anda sozinho: é por ele que o motor sabe QUANDO o vendedor
-- dispensou um card (e não o recria no dia seguinte).
create or replace function public.aura_recomendacoes_toca_atualizado_em()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists aura_recomendacoes_atualizado_em on public.aura_recomendacoes;
create trigger aura_recomendacoes_atualizado_em before update on public.aura_recomendacoes
  for each row execute function public.aura_recomendacoes_toca_atualizado_em();

-- ===================================================================
-- 5b. Revisão do aprendizado por agente.
-- ===================================================================
-- O agente "revisor-aprendizado" é a ÚNICA exceção à regra "agente não
-- altera dado": ele aprova ou recusa sugestões de aura_aprendizado (status e,
-- se preciso, a resposta). Tudo reversível: estas colunas dizem quem decidiu,
-- por quê e com que confiança, o gestor desfaz com um clique (volta a
-- "sugerido") e cada mudança fica no histórico do bloco 6.
alter table public.aura_aprendizado add column if not exists revisado_por_agente text;
alter table public.aura_aprendizado add column if not exists revisao_motivo text;
alter table public.aura_aprendizado add column if not exists revisao_confianca numeric;

-- ===================================================================
-- 6. CONHECIMENTO QUE NUNCA SE PERDE: o histórico.
-- ===================================================================
-- Cada INSERT, UPDATE e DELETE nas tabelas da base de conhecimento grava a
-- linha inteira de antes e de depois. Um material apagado por engano, um
-- FAQ sobrescrito, um aprendizado recusado sem querer: tudo volta daqui.
--
-- Além do pedido original, a tabela leva `empresa` (copiada da linha), para
-- a regra de leitura poder separar as lojas.
create table if not exists public.aura_conhecimento_historico (
  id bigint generated always as identity primary key,
  tabela text not null,
  registro_id text,
  empresa text,
  operacao text not null check (operacao in ('INSERT', 'UPDATE', 'DELETE')),
  antes jsonb,
  depois jsonb,
  por uuid default auth.uid(),
  em timestamptz not null default now()
);
create index if not exists aura_conhecimento_historico_registro_idx
  on public.aura_conhecimento_historico (tabela, registro_id, em desc);
create index if not exists aura_conhecimento_historico_em_idx
  on public.aura_conhecimento_historico (em desc);

-- A função do gatilho roda como dona da tabela (security definer): grava o
-- histórico mesmo quando quem mexeu é um gestor pela tela, que não tem
-- permissão nenhuma de escrita no histórico.
create or replace function public.aura_registrar_historico_conhecimento()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_antes jsonb;
  v_depois jsonb;
begin
  -- `busca` é o tsvector dos trechos: é derivado do texto e se refaz sozinho.
  if tg_op in ('UPDATE', 'DELETE') then v_antes := to_jsonb(old) - 'busca'; end if;
  if tg_op in ('INSERT', 'UPDATE') then v_depois := to_jsonb(new) - 'busca'; end if;
  -- UPDATE que não mudou nada não é versão nova.
  if tg_op = 'UPDATE' and v_antes is not distinct from v_depois then
    return null;
  end if;
  insert into public.aura_conhecimento_historico (tabela, registro_id, empresa, operacao, antes, depois, por)
  values (
    tg_table_name,
    -- playbook não tem id: a chave dele é a loja.
    coalesce(v_depois ->> 'id', v_antes ->> 'id', v_depois ->> 'empresa', v_antes ->> 'empresa'),
    coalesce(v_depois ->> 'empresa', v_antes ->> 'empresa'),
    tg_op,
    v_antes,
    v_depois,
    auth.uid()
  );
  return null;
end $$;
revoke all on function public.aura_registrar_historico_conhecimento() from public, anon, authenticated;

-- O histórico não se edita nem se apaga, a não ser pelo service_role (a
-- faxina de um dia, se a empresa decidir). Revogar o privilégio já basta;
-- o gatilho abaixo é a segunda tranca, para o caso de alguém devolver o
-- privilégio sem pensar.
create or replace function public.aura_historico_e_somente_leitura()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'O histórico da base de conhecimento não pode ser alterado nem apagado.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists aura_conhecimento_historico_trava on public.aura_conhecimento_historico;
create trigger aura_conhecimento_historico_trava
  before update or delete on public.aura_conhecimento_historico
  for each row execute function public.aura_historico_e_somente_leitura();

-- Gatilhos nas tabelas da base de conhecimento. Os nomes saíram do esquema
-- de produção (supabase/esquema.sql) e das telas do gestor:
--   aura_aprendizado / aura_aprendizado_origem .. o que a AURA aprendeu
--   aura_materiais / aura_material_trechos ...... manuais e o índice deles
--   playbook .................................... playbook da loja
--   perguntas_frequentes ........................ FAQ (faq-manager)
--   treinamentos ................................ Academy (academy-manager)
--   links_uteis ................................. links e textos prontos
--   perguntas_qualificacao ...................... roteiro de qualificação
do $$
declare
  t text;
begin
  foreach t in array array[
    'aura_aprendizado', 'aura_aprendizado_origem', 'aura_materiais', 'aura_material_trechos',
    'playbook', 'perguntas_frequentes', 'treinamentos', 'links_uteis', 'perguntas_qualificacao'
  ]
  loop
    if to_regclass(format('public.%I', t)) is null then
      raise notice 'Tabela % não existe; sem histórico para ela.', t;
      continue;
    end if;
    execute format('drop trigger if exists aura_historico_conhecimento on public.%I', t);
    execute format(
      'create trigger aura_historico_conhecimento after insert or update or delete on public.%I '
      'for each row execute function public.aura_registrar_historico_conhecimento()', t);
  end loop;
end $$;

-- ===================================================================
-- 7. RLS e privilégios.
-- ===================================================================
-- Ninguém de fora (anon) lê nada. Gestor aprovado lê o escritório. A
-- escrita é toda do servidor (service_role), atrás de rotas que conferem
-- quem está logado — nenhuma política de escrita para authenticated.
alter table public.aura_agentes enable row level security;
alter table public.aura_agente_execucoes enable row level security;
alter table public.aura_escritorio_mensagens enable row level security;
alter table public.aura_agente_propostas enable row level security;
alter table public.aura_conhecimento_historico enable row level security;

revoke all on public.aura_agentes from anon, authenticated;
revoke all on public.aura_agente_execucoes from anon, authenticated;
revoke all on public.aura_escritorio_mensagens from anon, authenticated;
revoke all on public.aura_agente_propostas from anon, authenticated;
revoke all on public.aura_conhecimento_historico from anon, authenticated;

grant select on public.aura_agentes to authenticated;
grant select on public.aura_agente_execucoes to authenticated;
grant select on public.aura_escritorio_mensagens to authenticated;
grant select on public.aura_agente_propostas to authenticated;
grant select on public.aura_conhecimento_historico to authenticated;

grant all on public.aura_agentes to service_role;
grant all on public.aura_agente_execucoes to service_role;
grant all on public.aura_escritorio_mensagens to service_role;
grant all on public.aura_agente_propostas to service_role;
grant all on public.aura_conhecimento_historico to service_role;

drop policy if exists "Gestor vê a equipe de agentes" on public.aura_agentes;
create policy "Gestor vê a equipe de agentes" on public.aura_agentes
  for select to authenticated using (public.sou_gestor_aprovado());

drop policy if exists "Gestor vê as execuções dos agentes" on public.aura_agente_execucoes;
create policy "Gestor vê as execuções dos agentes" on public.aura_agente_execucoes
  for select to authenticated using (public.sou_gestor_aprovado());

-- Fala sem loja (plano do dia, conversa entre agentes) é do grupo; fala de
-- uma loja só o gestor dela (ou o mestre) vê.
drop policy if exists "Gestor vê o escritório" on public.aura_escritorio_mensagens;
create policy "Gestor vê o escritório" on public.aura_escritorio_mensagens
  for select to authenticated using (
    public.pode_ver_todas_empresas()
    or (public.vejo_a_loja_toda() and (empresa is null or empresa = public.minha_empresa()))
  );

drop policy if exists "Gestor vê as propostas de agente" on public.aura_agente_propostas;
create policy "Gestor vê as propostas de agente" on public.aura_agente_propostas
  for select to authenticated using (public.sou_gestor_aprovado());

drop policy if exists "Gestor lê o histórico do conhecimento da loja" on public.aura_conhecimento_historico;
create policy "Gestor lê o histórico do conhecimento da loja" on public.aura_conhecimento_historico
  for select to authenticated using (public.administro_a_loja(empresa));

-- ===================================================================
-- 8. Conferência final.
-- ===================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'aura_agentes', 'aura_agente_execucoes', 'aura_escritorio_mensagens',
    'aura_agente_propostas', 'aura_conhecimento_historico'
  ]
  loop
    if not (select relrowsecurity from pg_class where oid = format('public.%I', t)::regclass) then
      raise exception 'RLS desligado em %', t;
    end if;
  end loop;
end $$;

commit;
