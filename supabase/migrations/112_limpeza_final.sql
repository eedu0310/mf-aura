-- 112 · Limpeza final antes do lançamento (25/11/2026)
--
-- Auditoria final do banco de produção (somente leitura) contra o código em
-- src/**. Esta migração faz SÓ o que é seguro:
--
--   1. Conserta o gatilho de metas (mesmo conserto da 111). Se a 111 já foi
--      aplicada, este bloco não muda nada; se não foi, ela deixa de ser
--      necessária.
--   2. Fecha o descompasso código x banco onde quem deve mudar é o banco:
--      perguntas_qualificacao.ordem e leads_recebidos.etapa_qualificacao,
--      que o webhook do WhatsApp oficial (src/app/api/whatsapp/webhook/route.ts)
--      lê e grava e que não existem.
--   3. Apaga tabelas legadas VAZIAS que nenhum código usa (conferido no src,
--      nos scripts, no deploy e no histórico do git: o código que as usava
--      saiu em 23/09/2026). Cada uma só cai se estiver vazia na hora.
--   4. Apaga funções antigas que ninguém chama (nem o código, nem outra
--      função, nem política, nem gatilho).
--   5. Tira das funções de gatilho o EXECUTE do anon/authenticated (aviso do
--      Supabase). Gatilho não confere EXECUTE na hora de disparar, então nada
--      muda no funcionamento.
--   6. Índices: tira dois repetidos e cria os que cobrem chaves estrangeiras
--      usadas em filtro (telas, relatórios de campanha e exclusão de usuário).
--
-- O que tem risco ficou COMENTADO no fim (bloco 7), com o motivo de cada um.
--
-- ORDEM: depois da 110. Para no bloco 0 se a 110 não estiver aplicada.
-- Pode rodar mais de uma vez: tudo é "if exists" / "if not exists" /
-- "create or replace". Tudo numa transação: se algo falhar, nada muda.
-- Nada aqui usa CASCADE: se aparecer uma dependência que a auditoria não viu,
-- a migração falha inteira em vez de levar junto o que não devia.

begin;

-- ===================================================================
-- 0. Trava: a 110 precisa estar aplicada.
-- ===================================================================
do $$
begin
  if to_regclass('public.aura_agentes') is null
     or to_regclass('public.aura_agente_execucoes') is null
     or to_regclass('public.aura_escritorio_mensagens') is null
     or to_regclass('public.aura_conhecimento_historico') is null then
    raise exception 'Aplique a migração 110 antes da 112 (faltam as tabelas dos agentes).';
  end if;
  if to_regprocedure('public.sou_gestor_aprovado()') is null then
    raise exception 'Aplique a migração 110 antes da 112 (falta sou_gestor_aprovado).';
  end if;
  if to_regclass('public.pos_venda_manutencoes') is null then
    raise exception 'Aplique a migração 108 antes da 112 (falta pos_venda_manutencoes).';
  end if;
end $$;

-- ===================================================================
-- 1. Gatilho de metas (o mesmo conserto da 111).
--    A função gravava NEW.atualizado_em, coluna que metas não tem (ela tem
--    updated_at). Conferido em produção hoje: o defeito continua lá, e
--    QUALQUER update em metas falha ('record "new" has no field
--    "atualizado_em"'), inclusive definirMeta em src/lib/supabase/metas.ts.
-- ===================================================================
create or replace function public.atualizar_meta_atualizada_em()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;
revoke all on function public.atualizar_meta_atualizada_em() from public, anon, authenticated;

-- ===================================================================
-- 2. Colunas que o código usa e o banco não tem.
--    src/app/api/whatsapp/webhook/route.ts:282 ordena as perguntas por
--    "ordem"; a linha 162/170/176 avança o lead pela pergunta seguinte em
--    "etapa_qualificacao". Sem as colunas a consulta das perguntas falha e o
--    lead fica preso na primeira pergunta. Colunas novas com padrão 0: não
--    reescrevem a tabela e não mudam nada do que já existe.
-- ===================================================================
alter table public.perguntas_qualificacao
  add column if not exists ordem integer not null default 0;
create index if not exists perguntas_qualificacao_empresa_ordem_idx
  on public.perguntas_qualificacao (empresa, ordem);

alter table public.leads_recebidos
  add column if not exists etapa_qualificacao integer not null default 0;

-- ===================================================================
-- 3. Tabelas legadas vazias, sem código e sem dependentes.
--    Evidência (25/11/2026): 0 linhas; nenhuma referência em src/, scripts/,
--    deploy/ (o código que as usava saiu no commit 3d17fc9, 23/09/2026);
--    nenhuma função, view ou chave estrangeira apontando para elas, fora as
--    três agent_* entre si. As três agent_* estão na publicação
--    supabase_realtime; o DROP as tira de lá sozinho.
--    Se alguma tiver ganhado linha até a hora de rodar, ela fica e sai um
--    aviso (NOTICE) em vez de apagar dado.
-- ===================================================================
do $$
declare
  t text;
  n bigint;
begin
  -- Ordem importa: agent_notifications aponta para agent_suggestions.
  foreach t in array array[
    'agent_notifications', 'agent_auto_responses', 'agent_suggestions',
    'aura_agent_logs', 'emails_enviados', 'mensagens_whatsapp',
    'whatsapp_auth_state'
  ]
  loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    execute format('select count(*) from public.%I', t) into n;
    if n > 0 then
      raise notice 'Tabela % tem % linha(s): ficou, confira antes de apagar.', t, n;
      continue;
    end if;
    execute format('drop table public.%I', t);
    raise notice 'Tabela % apagada (estava vazia).', t;
  end loop;
end $$;

-- ===================================================================
-- 4. Funções que ninguém chama.
--    Conferido: nenhuma chamada no código (rpc), no corpo de outra função,
--    em política RLS, em gatilho ou em view.
--      aura_transferir_carteira ...... substituída por aura_mover_carteira (064b)
--      aura_ordem_etapa / aura_prob_etapa  usavam o NOME da etapa; o funil
--                                       editável usa a chave (aura_ordem_da_chave,
--                                       aura_prob_da_chave)
--      aura_achar_ou_criar_relacionamento  sem chamador (e já sem EXECUTE
--                                       para o authenticated)
--      cargo_atual / gestor_ativo ....... sem chamador; as políticas usam
--                                       meu_cargo, gestor_mestre e afins
--      tocar_ultima_mensagem_conversa ... gatilho da whatsapp_conversas antiga,
--                                       que não está ligado em tabela nenhuma
-- ===================================================================
drop function if exists public.aura_transferir_carteira(uuid, uuid, text, boolean);
drop function if exists public.aura_ordem_etapa(text);
drop function if exists public.aura_prob_etapa(text);
drop function if exists public.aura_achar_ou_criar_relacionamento(uuid, text, text, text);
drop function if exists public.cargo_atual();
drop function if exists public.gestor_ativo();
drop function if exists public.tocar_ultima_mensagem_conversa();

-- ===================================================================
-- 5. Funções de gatilho fora da API.
--    O Supabase avisa que o authenticated pode chamar estas funções pela
--    /rest/v1/rpc. Chamada fora de gatilho só dá erro, mas não há por que
--    ficarem expostas. O Postgres não confere EXECUTE quando o gatilho
--    dispara, então os gatilhos continuam funcionando igual.
-- ===================================================================
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- ===================================================================
-- 6. Índices.
-- 6a. Repetidos: whatsapp_conversas_linha_idx é idêntico a
--     idx_whatsapp_conversas_linha_data; pos_vendas_empresa_status_idx
--     (empresa, status) é o começo de idx_pos_vendas_empresa_status
--     (empresa, status, updated_at), que atende as mesmas consultas.
-- ===================================================================
drop index if exists public.whatsapp_conversas_linha_idx;
drop index if exists public.pos_vendas_empresa_status_idx;

-- 6b. Chaves estrangeiras sem índice que entram em filtro.
--     Exclusão/restauração de funcionário (filtra por respondido_por,
--     aprovado_por, descartado_por e apaga o usuário, o que confere as FKs).
create index if not exists leads_recebidos_respondido_por_idx
  on public.leads_recebidos (respondido_por) where respondido_por is not null;
create index if not exists leads_recebidos_descartado_por_idx
  on public.leads_recebidos (descartado_por) where descartado_por is not null;
create index if not exists compromissos_mensais_aprovado_por_idx
  on public.compromissos_mensais (aprovado_por) where aprovado_por is not null;
create index if not exists ia_uso_usuario_idx
  on public.ia_uso (usuario_id);

--     Ficha do relacionamento (agenda, Instagram, orçamentos, carteira).
create index if not exists compromissos_relacionamento_idx
  on public.compromissos (relacionamento_id) where relacionamento_id is not null;
create index if not exists meta_conversas_owner_idx
  on public.meta_conversas (owner_id);
create index if not exists meta_conversas_relacionamento_idx
  on public.meta_conversas (relacionamento_id) where relacionamento_id is not null;
create index if not exists orcamentos_anexos_relacionamento_idx
  on public.orcamentos_anexos (relacionamento_id);
create index if not exists whatsapp_ia_leads_carteira_rel_idx
  on public.whatsapp_ia_leads (carteira_relacionamento_id) where carteira_relacionamento_id is not null;
create index if not exists aura_feedback_fechamento_oportunidade_idx
  on public.aura_feedback_fechamento (oportunidade_id);
create index if not exists aura_feedback_fechamento_relacionamento_idx
  on public.aura_feedback_fechamento (relacionamento_id);

--     Relatórios de campanha (retorno_por_origem, campanhas_resumo).
create index if not exists atividades_campanha_idx
  on public.atividades (campanha_id) where campanha_id is not null;
create index if not exists oportunidades_campanha_idx
  on public.oportunidades (campanha_id) where campanha_id is not null;
create index if not exists relacionamentos_campanha_idx
  on public.relacionamentos (campanha_id) where campanha_id is not null;
create index if not exists vendas_campanha_idx
  on public.vendas (campanha_id) where campanha_id is not null;
create index if not exists vendas_indicador_idx
  on public.vendas (indicador_id) where indicador_id is not null;

--     Site MF (chat e formulários).
create index if not exists site_conversas_lead_idx
  on public.site_conversas (lead_id) where lead_id is not null;
create index if not exists site_conversas_atendente_idx
  on public.site_conversas (atendente_id) where atendente_id is not null;
create index if not exists site_envios_responsavel_idx
  on public.site_envios (responsavel_id) where responsavel_id is not null;
create index if not exists site_envios_formulario_idx
  on public.site_envios (formulario_id) where formulario_id is not null;

--     Relatório semanal, prêmios e Academy.
create index if not exists relatorios_periodicos_vendedor_idx
  on public.relatorios_periodicos (vendedor_id);
create index if not exists premios_vencedor_idx
  on public.premios (vencedor_id) where vencedor_id is not null;
create index if not exists treinamento_progresso_treinamento_idx
  on public.treinamento_progresso (treinamento_id);

-- ===================================================================
-- 6c. Setores novos da equipe de agentes. A sala dos atendentes (chat do
--     site, Instagram, WhatsApp) e a Equipe Vermelha usam "atendimento" e
--     "seguranca"; o CHECK da 110 recusava os dois, e o código gravava o
--     setor mais próximo no lugar (setorParaOBanco). Só amplia a lista.
-- ===================================================================
alter table public.aura_agentes drop constraint if exists aura_agentes_setor_check;
alter table public.aura_agentes add constraint aura_agentes_setor_check
  check (setor in (direcao, vendas, pos-venda, marketing, gestao,
                   conhecimento, dados, atendimento, seguranca));

-- ===================================================================
-- Conferência: o que esta migração promete, ficou.
-- ===================================================================
do $$
begin
  if position('updated_at' in (select prosrc from pg_proc
       where oid = 'public.atualizar_meta_atualizada_em()'::regprocedure)) = 0 then
    raise exception 'Gatilho de metas continua errado.';
  end if;
  if not exists (select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'perguntas_qualificacao' and column_name = 'ordem')
     or not exists (select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'leads_recebidos' and column_name = 'etapa_qualificacao') then
    raise exception 'Colunas do webhook não foram criadas.';
  end if;
end $$;

commit;

-- ===================================================================
-- 7. COM RISCO — NÃO RODA. Cada item precisa de uma decisão do dono e, em
--    alguns casos, de mudar o código antes.
-- ===================================================================

-- 7a. acoes_pendentes_aprovacao (0 linhas, sem uso real). AINDA é citada em
--     src/app/api/admin/excluir-cadastro-incompleto/route.ts:145; apagar a
--     tabela antes de tirar essa linha faz a exclusão de cadastro falhar
--     ("Nada foi apagado"). Primeiro o código, depois:
-- drop table if exists public.acoes_pendentes_aprovacao;

-- 7b. whatsapp_conversas / whatsapp_mensagens (0 linhas): do WhatsApp oficial
--     (Cloud API), hoje inativo. Ainda usadas por
--     src/app/api/whatsapp/webhook/route.ts e src/app/api/whatsapp/enviar/route.ts.
--     Só depois de apagar essas duas rotas:
-- drop table if exists public.whatsapp_mensagens;
-- drop table if exists public.whatsapp_conversas;

-- 7c. whatsapp_contactos (710 linhas, com nome e telefone) e whatsapp_status
--     (1 linha): sem código desde 23/09/2026, e a auditoria de 24/11 apontou
--     que qualquer logado lê whatsapp_contactos. Têm dado: fazer backup antes.
-- drop table if exists public.whatsapp_contactos;
-- drop table if exists public.whatsapp_status;

-- 7d. motivos_perda (5 linhas): nenhum código lê; os motivos da perda vivem
--     em oportunidades.motivo_perda. Tem dado: confirmar com o dono.
-- drop table if exists public.motivos_perda;

-- 7e. compromisso_mensal_campos (0 linhas): sem uso hoje, mas a 109 acabou de
--     acertar as políticas dela (campos extras do compromisso mensal, ainda
--     sem tela). Apagar só se a ideia foi abandonada.
-- drop table if exists public.compromisso_mensal_campos;

-- 7f. View aura_ranking_vendas: nenhum código usa (o ranking é calculado no
--     app). Pode haver algum relatório externo lendo; confirmar antes.
-- drop view if exists public.aura_ranking_vendas;

-- 7g. Colunas repetidas em pos_vendas (todas com 0 valores preenchidos):
--     o app, registrar_avaliacao_publica e aura_proteger_avaliacao_pos_venda
--     usam nota_avaliacao / comentario_avaliacao. avaliacao_nota só aparece em
--     src/lib/agentes/configuravel.ts:100 (lê sempre vazio). Trocar ali para
--     nota_avaliacao e só então:
-- alter table public.pos_vendas drop constraint if exists pos_vendas_avaliacao_check;
-- alter table public.pos_vendas drop column if exists avaliacao_nota;
-- alter table public.pos_vendas drop column if exists avaliacao_comentario;
-- alter table public.pos_vendas drop column if exists observacao_instalacao;
--     (data_agendamento/hora_agendamento x instalacao_agendada_em e
--     reclamacao_resolvida x reclamacao_resolvida_em: as duas versões são
--     usadas pelo código — a tela grava uma, os agentes leem a outra. Resolver
--     no código antes de pensar em apagar.)

-- 7h. Funções-ajudante de etapa ainda abertas ao authenticated (aviso do
--     Supabase): aura_chave_da_etapa, aura_etapa_da_chave, aura_etapa_de_ganho,
--     aura_etapa_de_perda. Só são chamadas por funções SECURITY DEFINER (que
--     rodam como dono), mas conferir que nenhuma política ou view as usa
--     antes de fechar:
-- revoke execute on function public.aura_chave_da_etapa(text, text) from authenticated;
-- revoke execute on function public.aura_etapa_da_chave(text, text) from authenticated;
-- revoke execute on function public.aura_etapa_de_ganho(text) from authenticated;
-- revoke execute on function public.aura_etapa_de_perda(text) from authenticated;
