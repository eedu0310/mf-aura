-- 20261009144632 078_gestor_remove_meta_e_notifica

-- 078: o gestor precisa poder remover a meta de um vendedor da sua loja
-- e avisar esse vendedor. Sem estas duas policies as duas operacoes
-- voltam "ok" com zero linhas afetadas (falha silenciosa do PostgREST).

create policy "Gestor remove meta do vendedor da sua loja"
  on public.compromissos_mensais
  for delete
  using (
    vejo_a_loja_toda()
    and (
      pode_ver_todas_empresas()
      or exists (
        select 1 from public.profiles alvo
        where alvo.id = compromissos_mensais.vendedor_id
          and alvo.empresa = minha_empresa()
      )
    )
  );

create policy "Gestor notifica vendedor da sua loja"
  on public.notificacoes
  for insert
  with check (
    vendedor_id = (select auth.uid())
    or (
      vejo_a_loja_toda()
      and (
        pode_ver_todas_empresas()
        or exists (
          select 1 from public.profiles alvo
          where alvo.id = notificacoes.vendedor_id
            and alvo.empresa = minha_empresa()
        )
      )
    )
  );
