-- 20261002115323 046_separar_carteira_por_vendedor

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
-- estava vendo - as 29 leads do Jeferson e as 12 da Denise juntas, para os dois.
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
--    um gestor de uma loja so enxergaria as outras tres. Hoje isso nao aparece
--    porque os gestores ativos sao justamente os mestres, mas e uma armadilha
--    para o primeiro gestor de loja que for cadastrado.
create or replace function public.pode_ver_todas_empresas()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.cargo = 'Diretor'
        or (p.cargo = 'Gestor' and coalesce(p.gestor_mestre, false))
    from public.profiles p where p.id = auth.uid()
  ), false);
$$;

-- 2) Quem tem direito de ver a loja inteira, e nao apenas a propria carteira.
create or replace function public.vejo_a_loja_toda()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.cargo in ('Gestor', 'Diretor')
    from public.profiles p where p.id = auth.uid()
  ), false);
$$;

-- 3) Leitura: as duas politicas de cada tabela com a condicao correta.
alter policy "Gestor e diretor veem todas as empresas" on public.relacionamentos
  using (
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or owner_id = auth.uid()
  );
alter policy "Ver relacionamentos conforme papel" on public.relacionamentos
  using (
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or owner_id = auth.uid()
  );

alter policy "Gestor e diretor veem todas as empresas" on public.oportunidades
  using (
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or owner_id = auth.uid()
  );
alter policy "Ver oportunidades conforme papel" on public.oportunidades
  using (
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or owner_id = auth.uid()
  );

alter policy "Gestor e diretor veem todas as empresas" on public.atividades
  using (
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or owner_id = auth.uid()
  );
alter policy "Ver atividades conforme papel" on public.atividades
  using (
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or owner_id = auth.uid()
  );

alter policy "Gestor e diretor veem todas as empresas" on public.vendas
  using (
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or owner_id = auth.uid()
  );
alter policy "Ver vendas conforme papel" on public.vendas
  using (
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or owner_id = auth.uid()
  );

-- 4) Escrita: o ramo de gestor nao checava loja nenhuma. Com cargo 'Gestor',
--    a condicao era verdadeira para registro de qualquer uma das quatro lojas -
--    o gestor da MF podia alterar e apagar a carteira da LF.
alter policy "Atualizar relacionamentos conforme papel" on public.relacionamentos
  using (
    owner_id = auth.uid()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or pode_ver_todas_empresas()
  );
alter policy "Excluir relacionamentos conforme papel" on public.relacionamentos
  using (
    owner_id = auth.uid()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or pode_ver_todas_empresas()
  );

alter policy "Atualizar oportunidades conforme papel" on public.oportunidades
  using (
    owner_id = auth.uid()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or pode_ver_todas_empresas()
  );
alter policy "Excluir oportunidades conforme papel" on public.oportunidades
  using (
    owner_id = auth.uid()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or pode_ver_todas_empresas()
  );

-- Em vendas o ramo de gestor usava pode_ver_todas_empresas(), que acabou de
-- ficar restrito ao gestor mestre. Sem a linha da loja, o gestor de uma loja
-- so perderia o direito de corrigir uma venda da equipe dele.
alter policy "Atualizar vendas conforme papel" on public.vendas
  using (
    owner_id = auth.uid()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or pode_ver_todas_empresas()
  );
alter policy "Excluir vendas conforme papel" on public.vendas
  using (
    owner_id = auth.uid()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or pode_ver_todas_empresas()
  );
