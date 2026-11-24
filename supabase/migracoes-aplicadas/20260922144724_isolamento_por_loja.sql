-- 20260922144724 isolamento_por_loja

-- Isolamento por loja: cada loja vê apenas os próprios dados;
-- Gestor e Diretor veem todas as lojas. Remove as regras antigas que liberavam
-- tudo para qualquer usuário logado (auth.role() = 'authenticated') ou para
-- registros sem dono (owner_id IS NULL).

-- ===== relacionamentos, oportunidades, atividades, vendas =====
drop policy if exists "Select relacionamentos" on public.relacionamentos;
drop policy if exists "Insert relacionamentos" on public.relacionamentos;
drop policy if exists "Update relacionamentos" on public.relacionamentos;
drop policy if exists "Criar relacionamento na própria loja" on public.relacionamentos;

drop policy if exists "Select oportunidades" on public.oportunidades;
drop policy if exists "Insert oportunidades" on public.oportunidades;
drop policy if exists "Update oportunidades" on public.oportunidades;
drop policy if exists "Criar oportunidade na própria loja" on public.oportunidades;

drop policy if exists "Select atividades" on public.atividades;
drop policy if exists "Insert atividades" on public.atividades;
drop policy if exists "Update atividades" on public.atividades;
drop policy if exists "Criar atividade na própria loja" on public.atividades;

drop policy if exists "Select vendas" on public.vendas;
drop policy if exists "Insert vendas" on public.vendas;
drop policy if exists "Update vendas" on public.vendas;
drop policy if exists "Criar venda na própria loja" on public.vendas;

-- Criar: sempre em nome próprio, na própria loja (gestor/diretor em qualquer loja)
create policy "Criar relacionamento na própria loja" on public.relacionamentos for insert to authenticated
  with check (owner_id = auth.uid() and (empresa = minha_empresa() or pode_ver_todas_empresas()));
create policy "Criar oportunidade na própria loja" on public.oportunidades for insert to authenticated
  with check (owner_id = auth.uid() and (empresa = minha_empresa() or pode_ver_todas_empresas()));
create policy "Criar atividade na própria loja" on public.atividades for insert to authenticated
  with check (owner_id = auth.uid() and (empresa = minha_empresa() or pode_ver_todas_empresas()));
create policy "Criar venda na própria loja" on public.vendas for insert to authenticated
  with check (owner_id = auth.uid() and (empresa = minha_empresa() or pode_ver_todas_empresas()));

-- Vendas: editar/excluir a própria venda; gestor/diretor qualquer uma
create policy "Atualizar vendas conforme papel" on public.vendas for update to authenticated
  using (owner_id = auth.uid() or pode_ver_todas_empresas())
  with check (owner_id = auth.uid() or pode_ver_todas_empresas());
create policy "Excluir vendas conforme papel" on public.vendas for delete to authenticated
  using (owner_id = auth.uid() or pode_ver_todas_empresas());

-- Excluir relacionamento: dono ou gestor (a regra "qualquer um da loja" saía do padrão)
drop policy if exists "Excluir relacionamentos da própria loja" on public.relacionamentos;

-- ===== leads_recebidos =====
drop policy if exists "Select leads" on public.leads_recebidos;
drop policy if exists "Insert leads" on public.leads_recebidos;
drop policy if exists "Update leads" on public.leads_recebidos;
create policy "Criar leads na própria loja" on public.leads_recebidos for insert to authenticated
  with check (empresa = minha_empresa() or pode_ver_todas_empresas());

-- ===== WhatsApp (central antiga): estava aberto até para quem não fez login =====
drop policy if exists "whatsapp_conversas_select" on public.whatsapp_conversas;
drop policy if exists "Usuário autenticado vê conversas WhatsApp" on public.whatsapp_conversas;
create policy "Ver conversas WhatsApp da própria loja" on public.whatsapp_conversas for select to authenticated
  using (empresa = minha_empresa() or pode_ver_todas_empresas());

drop policy if exists "whatsapp_mensagens_select" on public.whatsapp_mensagens;
drop policy if exists "whatsapp_mensagens_update" on public.whatsapp_mensagens;
drop policy if exists "Usuário autenticado vê mensagens WhatsApp" on public.whatsapp_mensagens;
drop policy if exists "Usuário autenticado atualiza mensagens WhatsApp" on public.whatsapp_mensagens;
create policy "Ver mensagens WhatsApp da própria loja" on public.whatsapp_mensagens for select to authenticated
  using (exists (select 1 from public.whatsapp_conversas c where c.id = whatsapp_mensagens.conversa_id
                 and (c.empresa = minha_empresa() or pode_ver_todas_empresas())));
create policy "Atualizar mensagens WhatsApp da própria loja" on public.whatsapp_mensagens for update to authenticated
  using (exists (select 1 from public.whatsapp_conversas c where c.id = whatsapp_mensagens.conversa_id
                 and (c.empresa = minha_empresa() or pode_ver_todas_empresas())))
  with check (exists (select 1 from public.whatsapp_conversas c where c.id = whatsapp_mensagens.conversa_id
                 and (c.empresa = minha_empresa() or pode_ver_todas_empresas())));

drop policy if exists "whatsapp_contactos_select" on public.whatsapp_contactos;
drop policy if exists "Usuário autenticado vê contatos WhatsApp" on public.whatsapp_contactos;
create policy "Usuário logado vê contatos WhatsApp" on public.whatsapp_contactos for select to authenticated using (true);
drop policy if exists "whatsapp_status_select" on public.whatsapp_status;
drop policy if exists "Usuário autenticado vê status WhatsApp" on public.whatsapp_status;
create policy "Usuário logado vê status WhatsApp" on public.whatsapp_status for select to authenticated using (true);

-- Leads da IA no WhatsApp: gestor/diretor (todas as lojas) — mantém coerência
drop policy if exists "Gestor e diretor veem leads de WhatsApp" on public.whatsapp_ia_leads;
create policy "Gestor e diretor veem leads de WhatsApp" on public.whatsapp_ia_leads for select to authenticated
  using (pode_ver_todas_empresas());
