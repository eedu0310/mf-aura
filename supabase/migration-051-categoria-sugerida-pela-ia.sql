-- O palpite da IA sobre o que o contato e (Arquiteto, Construtora...) fica
-- GUARDADO aqui, separado da coluna "categoria", que e a decisao do vendedor.
--
-- Se a IA escrevesse direto em "categoria", a etiqueta erraria sozinha e
-- ninguem saberia se aquilo foi alguem que marcou ou a maquina que supos. Com
-- as duas colunas, o painel oferece a sugestao em tracejado e o vendedor apenas
-- confirma - e a sugestao e apagada no momento em que ele decide.
alter table public.whatsapp_ia_leads
  add column if not exists categoria_sugerida text;
