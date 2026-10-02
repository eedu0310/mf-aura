-- Ultimas tabelas com o padrao das migrations 046 e 048.

-- 1) POS-VENDA. "Usuarios consultam pos-vendas da empresa" era so
--    "empresa = minha_empresa()": qualquer vendedor via os clientes fechados
--    dos colegas. As outras duas politicas da tabela ja estavam certas, mas
--    somadas com OU nao adiantava nada.
--    Quem ve: o vendedor da venda, o responsavel pelo atendimento, o pessoal de
--    Pos-venda da loja, o gestor da loja e o gestor mestre.
do $$
declare
  regra text := $r$
    vendedor_id = auth.uid()
    or responsavel_id = auth.uid()
    or exists (select 1 from public.vendas v where v.id = pos_vendas.venda_id and v.owner_id = auth.uid())
    or (meu_cargo() = 'Pós-venda' and empresa = minha_empresa())
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or pode_ver_todas_empresas()
  $r$;
  politica text;
begin
  foreach politica in array array[
    'Usuários consultam pós-vendas da empresa',
    'Ver pós-vendas conforme papel',
    'pos_vendas_select'
  ] loop
    execute format('alter policy %I on public.pos_vendas using (%s)', politica, regra);
  end loop;
end $$;

-- 2) INDICADORES. A politica "marketing_see_all" lia o cargo de
--    auth.users.raw_user_meta_data, que e o dado gravado no cadastro e nao
--    acompanha mudanca de cargo no perfil. Quem entrou como Gestor e depois
--    virou Vendedor continuava vendo os indicadores de todo mundo, e a promocao
--    ao contrario nunca chegava. A fonte do cargo e profiles, onde o gestor
--    edita.
alter policy "marketing_see_all" on public.planilha_leads_indicadores
  using (
    usuario_id = auth.uid()
    or pode_ver_todas_empresas()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.ativo is not false
        and p.cargo in ('Gestor', 'Diretor', 'Marketing')
        and exists (
          select 1 from public.profiles d
          where d.id = planilha_leads_indicadores.usuario_id and d.empresa = p.empresa
        )
    )
  );

-- 3) METAS. O ramo de gestor nao checava loja: o gestor de uma loja via e
--    editava a meta da equipe de outra.
alter policy "Ver metas conforme papel" on public.metas
  using (
    owner_id = auth.uid()
    or pode_ver_todas_empresas()
    or exists (
      select 1 from public.profiles g, public.profiles d
      where g.id = auth.uid() and g.cargo in ('Gestor', 'Diretor')
        and d.id = metas.owner_id and d.empresa = g.empresa
    )
  );

alter policy "Gestor gerencia metas de atividade" on public.metas_atividade
  using (
    pode_ver_todas_empresas()
    or exists (
      select 1 from public.profiles g, public.profiles d
      where g.id = auth.uid() and g.cargo in ('Gestor', 'Diretor')
        and d.id = metas_atividade.vendedor_id and d.empresa = g.empresa
    )
  );
alter policy "Ver metas de atividade conforme papel" on public.metas_atividade
  using (
    vendedor_id = auth.uid()
    or pode_ver_todas_empresas()
    or exists (
      select 1 from public.profiles g, public.profiles d
      where g.id = auth.uid() and g.cargo in ('Gestor', 'Diretor')
        and d.id = metas_atividade.vendedor_id and d.empresa = g.empresa
    )
  );
