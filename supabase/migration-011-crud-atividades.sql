-- AURA: CRUD seguro de atividades.
-- Permite ao proprietário editar/excluir seus próprios registros.
-- O isolamento por empresa continua sendo garantido pelo owner_id e RLS.

alter table public.atividades enable row level security;

drop policy if exists "Atualizar atividade do próprio usuário" on public.atividades;
create policy "Atualizar atividade do próprio usuário"
  on public.atividades for update
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and empresa = (select empresa from public.profiles where id = auth.uid())
  );

drop policy if exists "Excluir atividade do próprio usuário" on public.atividades;
create policy "Excluir atividade do próprio usuário"
  on public.atividades for delete
  using (owner_id = auth.uid());
