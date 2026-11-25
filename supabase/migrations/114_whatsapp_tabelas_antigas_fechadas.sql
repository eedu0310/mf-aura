-- 114 — Fecha as tabelas antigas do WhatsApp oficial (Meta) que qualquer
-- pessoa logada lia.
--
-- whatsapp_contactos (710 contatos com nome e telefone) e whatsapp_status
-- (número conectado e o último QR) tinham a regra "using (true)": qualquer
-- usuário, de qualquer loja, lia tudo. A Sentinela de Segurança e o Caçador
-- de Brechas apontaram. Nenhum código lê estas tabelas hoje (nem a versão no
-- ar, nem a nova: o WhatsApp atual guarda as conversas no disco da VPS), então
-- a leitura fica só para quem enxerga todas as lojas. Reversível: basta
-- recriar a política antiga.

drop policy if exists "Usuário logado vê contatos WhatsApp" on public.whatsapp_contactos;
drop policy if exists whatsapp_contactos_mestre on public.whatsapp_contactos;
create policy whatsapp_contactos_mestre on public.whatsapp_contactos
  for select to authenticated
  using (public.pode_ver_todas_empresas());

drop policy if exists "Usuário logado vê status WhatsApp" on public.whatsapp_status;
drop policy if exists whatsapp_status_mestre on public.whatsapp_status;
create policy whatsapp_status_mestre on public.whatsapp_status
  for select to authenticated
  using (public.pode_ver_todas_empresas());
