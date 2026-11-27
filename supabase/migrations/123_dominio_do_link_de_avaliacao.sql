-- 123 — O link de avaliação sai com o domínio da LOJA, não o do CRM
-- (27/11/2026: "precisamos mascarar o domínio crm.mflaser").
--
-- O cliente da A&G recebia crm.mflaser.com.br/av/... e via "mflaser" — o nome
-- da fábrica — no link da loja. Agora cada loja tem o seu endereço
-- (avaliar.aegaquecimento.com.br, avaliar.lflareiras.com.br, ...), apontado no
-- DNS da loja para a VPS do AURA, que só responde o /av/ nele.
--
-- O campo fica vazio até o endereço estar no ar com HTTPS. Vazio, o link que
-- vai na conversa é o do Google direto (sem nenhum domínio do CRM) — perde só
-- o "abriu", o envio e o "avaliei" continuam contando.

alter table public.config_avaliacao
  add column if not exists dominio_link text;

alter table public.config_avaliacao
  drop constraint if exists config_avaliacao_dominio_link_formato;
alter table public.config_avaliacao
  add constraint config_avaliacao_dominio_link_formato
  check (dominio_link is null or dominio_link ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$');
