-- 070b — O parceiro enxerga o atendimento
--
-- Já aplicada no banco (versão 20261006173335). Arquivo escrito depois, para o
-- histórico do repositório bater com o banco.
--
-- DUAS COISAS IMPORTANTES AQUI:
--
-- 1. Política PERMISSIVA repetida é OR. Cada tabela central tem DUAS políticas
--    de SELECT com conteúdo equivalente ("Ver X conforme papel" e "Gestor e
--    diretor veem todas as empresas"), herdadas de migrações diferentes. Como
--    o Postgres faz OR entre políticas permissivas do mesmo comando, alterar
--    só uma delas não mudaria nada: a outra continuaria decidindo. Por isso as
--    duas são alteradas, com o mesmo texto.
--
-- 2. O DELETE continua só do dono. O parceiro foi convidado para atender
--    junto, não para apagar o cliente de quem o convidou.
--
-- E um conserto que apareceu no caminho: o gestor da loja não conseguia ver as
-- conversas do WhatsApp da própria equipe — só o gestor mestre via. A política
-- "Gestor ve as conversas da loja" fecha isso, e é o que torna possível o
-- painel do gestor por loja → vendedor → conversa.

alter policy "Ver relacionamentos conforme papel" on public.relacionamentos
  using (
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or owner_id = (select auth.uid())
    or parceiro_id = (select auth.uid())
  );

alter policy "Gestor e diretor veem todas as empresas" on public.relacionamentos
  using (
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or owner_id = (select auth.uid())
    or parceiro_id = (select auth.uid())
  );

alter policy "Atualizar relacionamentos conforme papel" on public.relacionamentos
  using (
    owner_id = (select auth.uid())
    or parceiro_id = (select auth.uid())
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or pode_ver_todas_empresas()
  );

alter policy "Ver oportunidades conforme papel" on public.oportunidades
  using (
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or owner_id = (select auth.uid())
    or parceiro_id = (select auth.uid())
  );

alter policy "Gestor e diretor veem todas as empresas" on public.oportunidades
  using (
    pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or owner_id = (select auth.uid())
    or parceiro_id = (select auth.uid())
  );

alter policy "Atualizar oportunidades conforme papel" on public.oportunidades
  using (
    owner_id = (select auth.uid())
    or parceiro_id = (select auth.uid())
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or pode_ver_todas_empresas()
  );

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'whatsapp_ia_leads'
      and policyname = 'Parceiro ve a analise da conversa'
  ) then
    create policy "Parceiro ve a analise da conversa" on public.whatsapp_ia_leads
      for select to authenticated
      using (parceiro_id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'whatsapp_ia_leads'
      and policyname = 'Gestor ve as conversas da loja'
  ) then
    create policy "Gestor ve as conversas da loja" on public.whatsapp_ia_leads
      for select to authenticated
      using (vejo_a_loja_toda() and empresa = minha_empresa());
  end if;
end $$;
