-- 20260928125124 lead_so_com_confianca_ou_confirmacao

-- A AURA criava relacionamento e oportunidade para qualquer conversa que ela
-- achasse comercial, sem olhar o quanto tinha certeza. E sem IA disponível
-- caía numa detecção por palavras-chave ainda mais solta. O resultado no
-- banco em produção foi pipeline poluído: conversa de tatuagem, suporte
-- técnico e papo de amigo viraram lead.
--
-- Agora a conversa em dúvida fica como SUGESTÃO até o vendedor confirmar.
alter table whatsapp_conversas
  add column if not exists lead_sugerido boolean not null default false,
  add column if not exists confianca_lead numeric,
  add column if not exists motivo_sugestao text;

comment on column whatsapp_conversas.lead_sugerido is
  'A AURA achou que pode ser lead mas não tem certeza: espera o vendedor confirmar.';
comment on column whatsapp_conversas.confianca_lead is
  'De 0 a 1, o quanto a IA confiou ao classificar como conversa comercial.';
