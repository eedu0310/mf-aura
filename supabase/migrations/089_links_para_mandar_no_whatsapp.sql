-- 089: os links úteis da loja ganham uma mensagem pronta para o WhatsApp.
--
-- O vendedor pede "manda o catálogo" dez vezes por dia. Com mensagem_whatsapp
-- preenchida, o link aparece no botão de links do WhatsApp dentro do AURA e
-- cai no campo de texto já com a frase ("Aqui está o nosso catálogo...") e o
-- endereço — ele só confere e envia. Link sem mensagem continua aparecendo
-- só na Área do Vendedor.

alter table public.links_uteis
  add column if not exists mensagem_whatsapp text,
  add column if not exists ordem integer not null default 0;

comment on column public.links_uteis.mensagem_whatsapp is
  'Frase que vai junto com o link no WhatsApp. Vazio = o link não aparece no botão de links do WhatsApp.';

-- Faltava a política de UPDATE: o gestor criava e apagava, mas não editava.
create policy "Gestor edita links da própria loja" on public.links_uteis
  for update
  using (empresa = minha_empresa() and vejo_a_loja_toda())
  with check (empresa = minha_empresa() and vejo_a_loja_toda());

-- O catálogo, que já existe nas 4 lojas, ganha a mensagem pedida.
update public.links_uteis
set mensagem_whatsapp = 'Aqui está o nosso catálogo para você conhecer os nossos produtos:'
where titulo = 'Catálogo dos Produtos' and mensagem_whatsapp is null;
