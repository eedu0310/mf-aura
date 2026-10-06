-- 075 — O funil editável estava travado no banco
--
-- ACHADO GRAVE, e só apareceu porque fui testar a renomeação de verdade.
--
-- A tabela oportunidades tem um CHECK com DEZ NOMES DE ETAPA ESCRITOS À MÃO:
--
--   CHECK (etapa = ANY (ARRAY['Prospecção','Apresentação','Proposta',
--     'Negociação','Fechados','Perdidos','Qualificação e Abordagem',
--     'Follow-up','Fechamento','Pós-venda']))
--
-- Ou seja: a aba "Etapas do Funil" promete que o gestor pode renomear as
-- etapas, mas o banco só aceita esses dez nomes. No dia em que ele renomear
-- "Fechamento" para "Vendido!", o que acontece é:
--
--   1. A tela salva o nome novo em etapas_funil (essa tabela não tem trava)
--   2. A rota tenta mover os negócios para o nome novo
--   3. O banco RECUSA com violação de constraint
--   4. O funil passa a dizer "Vendido!" e os negócios continuam em
--      "Fechamento" — que agora não é coluna de nada. Os cards somem do
--      quadro.
--
-- Exatamente o sumiço que as migrações 071 e 072 vieram impedir, entrando por
-- outra porta. Na prática o funil editável estava limitado a reordenar,
-- trocar cor e ligar/desligar etapa — renomear quebrava.
--
-- A TROCA: sai a lista fixa, entra um gatilho que confere contra o funil
-- DAQUELA loja. A regra continua a mesma — não se grava etapa inventada —
-- mas quem define o que é válido passa a ser o gestor, que é o ponto.
--
-- Loja sem funil configurado passa livre, de propósito: é o estado de uma
-- loja recém-criada, e travar o cadastro dela num erro de constraint seria
-- trocar um problema por outro.
--
-- ------------------------------------------------------------------------
-- A PRIMEIRA PARTE (o gatilho novo) JÁ ESTÁ APLICADA NO BANCO.
--
-- A SEGUNDA, ABAIXO, PRECISA SER RODADA À MÃO no editor SQL do Supabase: o
-- conector que uso cancela qualquer comando com DROP, e sem ele a lista fixa
-- continua de pé ao lado da guarda nova — isto é, renomear uma etapa segue
-- quebrando.
--
-- Supabase → SQL Editor → cole e rode:
-- ------------------------------------------------------------------------

alter table public.oportunidades
  drop constraint if exists oportunidades_etapa_check;

-- Conferência: tem que devolver 0 linhas.
select conname
  from pg_constraint
 where conrelid = 'public.oportunidades'::regclass
   and conname = 'oportunidades_etapa_check';
