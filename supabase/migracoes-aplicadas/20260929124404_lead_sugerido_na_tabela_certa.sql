-- 20260929124404 lead_sugerido_na_tabela_certa

-- Conserto da migration 028: as colunas foram para a tabela errada.
--
-- O "lead só com confiança" grava em whatsapp_ia_leads, que é a tabela do
-- supervisor que roda hoje (Baileys). Eu adicionei as colunas em
-- whatsapp_conversas, da integração antiga por API oficial.
--
-- Consequência: TODA gravação de análise falhava com "column does not
-- exist". A linha nunca recebia ultima_analise_em, então a tela pedia
-- análise de novo a cada consulta e mostrava "Analisando conversa..." para
-- sempre — e "Tratar como lead" não colava, porque morria no mesmo upsert.
alter table whatsapp_ia_leads
  add column if not exists lead_sugerido boolean not null default false,
  add column if not exists confianca_lead numeric,
  add column if not exists motivo_sugestao text;
