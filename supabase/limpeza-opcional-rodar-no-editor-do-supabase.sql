-- LIMPEZA OPCIONAL - nao muda comportamento, so tira peso.
--
-- POR QUE NAO FOI APLICADO AUTOMATICAMENTE: a conexao que eu uso recusa
-- DROP POLICY e DROP INDEX. Para rodar: painel do Supabase > SQL Editor >
-- cola tudo > Run. Pode ser feito com o sistema no ar.
--
-- O QUE E: ao longo do tempo a mesma regra de RLS foi criada com nomes
-- diferentes. O Postgres avalia TODAS as politicas de leitura em cada
-- consulta, entao quatro copias da mesma regra custam quatro vezes o tempo e
-- entregam o mesmo resultado. O relatorio de performance do Supabase aponta
-- 243 casos desses.
--
-- SEGURANCA DESTA LISTA: so entram politicas em que a tabela, o comando, a
-- REGRA e os PAPEIS (roles) sao identicos, e sempre fica uma copia de pe.
-- Politicas parecidas mas com papeis diferentes -- "pos_vendas_select" e
-- "Trava de loja nos leads", por exemplo -- ficaram FORA de proposito:
-- apagar a mais estreita e deixar a mais larga afrouxaria o acesso em vez de
-- limpar.
drop policy if exists "Ver atividades conforme papel" on public.atividades;
drop policy if exists "Vendedores veem seus leads" on public.leads_recebidos;
drop policy if exists "Ver leads conforme papel" on public.leads_recebidos;
drop policy if exists "Ver oportunidades conforme papel" on public.oportunidades;
drop policy if exists "Ver pós-vendas conforme papel" on public.pos_vendas;
drop policy if exists "Ver relacionamentos conforme papel" on public.relacionamentos;
drop policy if exists "Usuário atualiza seu progresso" on public.treinamento_progresso;
drop policy if exists "Ver meu progresso" on public.treinamento_progresso;
drop policy if exists "Ver vendas conforme papel" on public.vendas;

-- Indices repetidos: duas copias do mesmo indice ocupam disco e fazem o banco
-- escrever duas vezes em cada insercao, sem acelerar nada. Em cada par fica o
-- que sustenta uma restricao de unicidade ou tem o nome mais descritivo.
drop index if exists public.idx_pos_vendas_venda_unica;        -- fica pos_vendas_venda_id_key
drop index if exists public.whatsapp_mensagens_conversa_idx;   -- fica idx_whatsapp_mensagens_conversa_data
drop index if exists public.whatsapp_conversas_linha_idx;      -- fica idx_whatsapp_conversas_linha_data
drop index if exists public.idx_atividades_relacionamento;     -- fica atividades_relacionamento_idx
drop index if exists public.metas_owner_mes_uidx;              -- fica metas_owner_id_mes_key

-- Depois de rodar, conferir que nada ficou sem politica de leitura:
--   select tablename, count(*) from pg_policies
--    where schemaname='public' and cmd='SELECT' group by tablename order by 2;
