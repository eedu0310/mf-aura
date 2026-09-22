-- Restaura a visibilidade do conteúdo já existente da Academy.
-- Esta migração não apaga nem altera treinamentos, links do YouTube ou FAQs.
-- O conteúdo comercial é compartilhado entre vendedores autenticados.

drop policy if exists "Vendedor vê treinamentos da empresa" on public.treinamentos;
create policy "Usuário autenticado vê treinamentos comerciais"
  on public.treinamentos for select
  using (auth.uid() is not null);

drop policy if exists "Vendedor vê FAQ da empresa" on public.perguntas_frequentes;
create policy "Usuário autenticado vê FAQ comercial"
  on public.perguntas_frequentes for select
  using (auth.uid() is not null);

-- Garante que o progresso continua individual por vendedor.
drop policy if exists "Usuário vê seu progresso" on public.treinamento_progresso;
create policy "Usuário vê seu progresso"
  on public.treinamento_progresso for select
  using (owner_id = auth.uid());

drop policy if exists "Usuário atualiza seu progresso" on public.treinamento_progresso;
create policy "Usuário atualiza seu progresso"
  on public.treinamento_progresso for insert
  with check (owner_id = auth.uid());

drop policy if exists "Usuário edita seu progresso" on public.treinamento_progresso;
create policy "Usuário edita seu progresso"
  on public.treinamento_progresso for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
