-- 072 — O lado do banco passa a falar a língua do funil editável
--
-- ESTE É O CONSERTO DE UMA BOMBA ARMADA. Ler com atenção.
--
-- Quando o funil virou editável, o código TypeScript inteiro foi convertido
-- para perguntar as etapas ao funil da loja. O lado SQL não foi — e o lado SQL
-- tem gatilhos que disparam sozinhos, sem ninguém pedir:
--
--   aura_venda_fecha_pipeline           dispara a cada venda registrada
--   aura_atividade_move_pipeline        dispara a cada atividade do vendedor
--   aura_lead_respondido_vira_pipeline  dispara a cada lead respondido
--
-- Os três carregavam nomes de etapa escritos à mão: 'Fechados', 'Proposta',
-- 'Apresentação'. Depois da migração 068, 'Fechados' e 'Proposta' não existem
-- em nenhuma das quatro lojas (viraram 'Fechamento' e 'Follow-up').
--
-- O QUE IA ACONTECER: o vendedor registra uma venda na tela de Vendas; o
-- gatilho grava etapa = 'Fechados' na oportunidade; o quadro do pipeline monta
-- as colunas a partir do funil da loja, onde 'Fechados' não existe — e o card
-- DESAPARECE DA TELA. Sem erro, sem aviso. O mesmo com um orçamento
-- registrado, que jogava o negócio em 'Proposta'.
--
-- Ainda não aconteceu: as 19 combinações de loja/etapa em oportunidades
-- estavam todas dentro do funil quando isto foi escrito. Ninguém havia
-- registrado venda pela tela nem atividade de orçamento desde o deploy do
-- funil editável. Esta migração fecha a porta antes do primeiro.
--
-- A SOLUÇÃO é a mesma que o TypeScript já usa: ninguém escreve nome de etapa.
-- Fala-se pela CHAVE SEMÂNTICA (prospeccao, qualificacao, apresentacao,
-- followup, negociacao, fechamento, posvenda, perda) e a chave é traduzida
-- para o nome que AQUELA loja escolheu, na hora.

-- ------------------------------------------------- tradutores chave <-> nome

create or replace function public.aura_etapa_da_chave(p_empresa text, p_chave text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  -- O nome que esta loja deu para esta chave. Se a loja nunca editou o funil
  -- (não há linha em etapas_funil), cai no padrão do sistema — os mesmos
  -- nomes de FUNIL_PADRAO em src/lib/funil.ts.
  select coalesce(
    (select nome from public.etapas_funil
      where empresa = p_empresa and chave = p_chave
      order by ordem limit 1),
    case p_chave
      when 'prospeccao'   then 'Prospecção'
      when 'qualificacao' then 'Qualificação e Abordagem'
      when 'apresentacao' then 'Apresentação'
      when 'followup'     then 'Follow-up'
      when 'negociacao'   then 'Negociação'
      when 'fechamento'   then 'Fechamento'
      when 'posvenda'     then 'Pós-venda'
      when 'perda'        then 'Perdidos'
    end
  );
$$;

create or replace function public.aura_chave_da_etapa(p_empresa text, p_etapa text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  -- A chave de um nome gravado. Os nomes antigos continuam respondendo porque
  -- ainda podem existir em dado histórico (relatório, análise de conversa) —
  -- é o mesmo mapa de CHAVE_DOS_NOMES_ANTIGOS em src/lib/funil.ts.
  select coalesce(
    (select chave from public.etapas_funil
      where empresa = p_empresa and nome = p_etapa
      order by ordem limit 1),
    case p_etapa
      when 'Prospecção'               then 'prospeccao'
      when 'Qualificação'             then 'qualificacao'
      when 'Qualificação e Abordagem' then 'qualificacao'
      when 'Abordagem'                then 'qualificacao'
      when 'Apresentação'             then 'apresentacao'
      when 'Proposta'                 then 'followup'
      when 'Follow-up'                then 'followup'
      when 'Followup'                 then 'followup'
      when 'Negociação'               then 'negociacao'
      when 'Fechados'                 then 'fechamento'
      when 'Fechamento'               then 'fechamento'
      when 'Ganhos'                   then 'fechamento'
      when 'Pós-venda'                then 'posvenda'
      when 'Pos-venda'                then 'posvenda'
      when 'Perdidos'                 then 'perda'
      when 'Perdido'                  then 'perda'
    end
  );
$$;

-- A etapa de ganho da loja, agora sem repetir a lógica.
create or replace function public.aura_etapa_de_ganho(p_empresa text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select nome from public.etapas_funil
      where empresa = p_empresa and tipo = 'ganho'
      order by ordem limit 1),
    public.aura_etapa_da_chave(p_empresa, 'fechamento')
  );
$$;

create or replace function public.aura_etapa_de_perda(p_empresa text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select nome from public.etapas_funil
      where empresa = p_empresa and tipo = 'perda'
      order by ordem limit 1),
    public.aura_etapa_da_chave(p_empresa, 'perda')
  );
$$;

-- Ordem e probabilidade passam a depender da CHAVE, não do nome. Antes,
-- 'Fechamento' devolvia ordem -1 (nome desconhecido) e qualquer etapa
-- "avançava" por cima dele.
create or replace function public.aura_ordem_da_chave(p_chave text)
returns int
language sql
immutable
as $$
  select case p_chave
    when 'prospeccao'   then 0
    when 'qualificacao' then 1
    when 'apresentacao' then 2
    when 'followup'     then 3
    when 'negociacao'   then 4
    when 'fechamento'   then 5
    when 'posvenda'     then 6
    when 'perda'        then -1
    else -1
  end;
$$;

create or replace function public.aura_prob_da_chave(p_chave text)
returns text
language sql
immutable
as $$
  select case p_chave
    when 'followup'   then 'Média'
    when 'negociacao' then 'Alta'
    when 'fechamento' then 'Alta'
    when 'posvenda'   then 'Alta'
    else 'Baixa'
  end;
$$;

-- As duas antigas ficam, delegando, porque podem estar em uso em algum lugar
-- que eu não enxergo (view, função de outro projeto). Elas agora respondem
-- certo também para os nomes novos.
create or replace function public.aura_ordem_etapa(e text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select public.aura_ordem_da_chave(public.aura_chave_da_etapa('', e));
$$;

create or replace function public.aura_prob_etapa(e text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.aura_prob_da_chave(public.aura_chave_da_etapa('', e));
$$;

revoke all on function public.aura_etapa_da_chave(text, text) from public, anon;
revoke all on function public.aura_chave_da_etapa(text, text) from public, anon;
revoke all on function public.aura_etapa_de_perda(text) from public, anon;
revoke all on function public.aura_ordem_da_chave(text) from public, anon;
revoke all on function public.aura_prob_da_chave(text) from public, anon;
grant execute on function public.aura_etapa_da_chave(text, text) to authenticated, service_role;
grant execute on function public.aura_chave_da_etapa(text, text) to authenticated, service_role;
grant execute on function public.aura_etapa_de_perda(text) to authenticated, service_role;
grant execute on function public.aura_ordem_da_chave(text) to authenticated, service_role;
grant execute on function public.aura_prob_da_chave(text) to authenticated, service_role;
