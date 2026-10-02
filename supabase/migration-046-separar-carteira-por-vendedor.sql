-- Cada vendedor com a sua carteira.
--
-- O DEFEITO: relacionamentos, oportunidades, atividades e vendas tinham DUAS
-- politicas permissivas de SELECT ao mesmo tempo:
--
--   "Gestor e diretor veem todas as empresas" -> empresa = minha_empresa()
--   "Ver ... conforme papel"                  -> owner_id = auth.uid() OR gestor
--
-- No Postgres, politicas permissivas do mesmo comando se somam com OU, nao com
-- E. Entao bastava a primeira ser verdadeira e a checagem de dono nunca valia:
-- QUALQUER pessoa da loja via a carteira inteira da loja. Era o que a Sole
-- estava vendo - as 29 leads do Jeferson e as 12 da Denise juntas, para os dois,
-- e as 41 para a Jucelane, que havia entrado no dia anterior.
--
-- Nao da para apagar politica neste projeto (DROP e barrado pela politica do
-- banco), entao as duas politicas de cada tabela recebem a MESMA condicao
-- correta. Somadas com OU, o resultado e exatamente essa condicao.
--
-- A REGRA, agora igual em toda tabela de carteira:
--   gestor mestre              -> todas as lojas
--   gestor/diretor da loja     -> tudo da loja dele
--   qualquer outro             -> so o que e dele

-- 1) "Pode ver todas as empresas" passa a exigir gestor mestre.
--    Antes bastava o cargo ser Gestor, e o campo gestor_mestre nao era olhado:
--    um gestor de uma loja so enxergaria as outras tres. Nao aparecia porque os
--    gestores ativos eram justamente os mestres - uma armadilha para o primeiro
--    gestor de loja que fosse cadastrado.
create or replace function public.pode_ver_todas_empresas()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.cargo = 'Diretor'
        or (p.cargo = 'Gestor' and coalesce(p.gestor_mestre, false))
    from public.profiles p where p.id = auth.uid()
  ), false);
$$;

-- 2) Quem tem direito de ver a loja inteira, e nao apenas a propria carteira.
create or replace function public.vejo_a_loja_toda()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select p.cargo in ('Gestor', 'Diretor')
    from public.profiles p where p.id = auth.uid()
  ), false);
$$;

-- 3) Leitura e escrita das quatro tabelas de carteira.
--    Na escrita, o ramo de gestor nao checava loja nenhuma: com cargo 'Gestor'
--    a condicao era verdadeira para registro de qualquer uma das quatro lojas -
--    o gestor da MF podia alterar e apagar a carteira da LF.
do $$
declare
  leitura text := $r$
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or owner_id = auth.uid()
  $r$;
  escrita text := $r$
    owner_id = auth.uid()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or pode_ver_todas_empresas()
  $r$;
  p record;
begin
  for p in
    select * from (values
      ('relacionamentos', 'Gestor e diretor veem todas as empresas',  'leitura'),
      ('relacionamentos', 'Ver relacionamentos conforme papel',       'leitura'),
      ('oportunidades',   'Gestor e diretor veem todas as empresas',  'leitura'),
      ('oportunidades',   'Ver oportunidades conforme papel',         'leitura'),
      ('atividades',      'Gestor e diretor veem todas as empresas',  'leitura'),
      ('atividades',      'Ver atividades conforme papel',            'leitura'),
      ('vendas',          'Gestor e diretor veem todas as empresas',  'leitura'),
      ('vendas',          'Ver vendas conforme papel',                'leitura'),
      ('relacionamentos', 'Atualizar relacionamentos conforme papel', 'escrita'),
      ('relacionamentos', 'Excluir relacionamentos conforme papel',   'escrita'),
      ('oportunidades',   'Atualizar oportunidades conforme papel',   'escrita'),
      ('oportunidades',   'Excluir oportunidades conforme papel',     'escrita'),
      ('vendas',          'Atualizar vendas conforme papel',          'escrita'),
      ('vendas',          'Excluir vendas conforme papel',            'escrita')
    ) as t(tabela, politica, tipo)
  loop
    execute format(
      'alter policy %I on public.%I using (%s)',
      p.politica, p.tabela,
      case p.tipo when 'leitura' then leitura else escrita end
    );
  end loop;
end $$;
