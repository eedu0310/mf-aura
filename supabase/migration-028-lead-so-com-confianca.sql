-- Migration 028 — Lead só com confiança, ou com confirmação (aplicada)
--
-- A AURA criava relacionamento e oportunidade para qualquer conversa que
-- achasse comercial, sem olhar o quanto tinha certeza; sem IA disponível,
-- caía numa detecção por palavras-chave ainda mais solta. O pipeline encheu
-- de conversa que não era venda — inclusive o próprio vendedor virou lead
-- de si mesmo a partir da conversa dele no WhatsApp.
--
-- Agora: cria sozinha só com confiança >= 0,75; na dúvida deixa como
-- sugestão e pergunta ao vendedor, que responde "Sim, é um lead" ou "Não é".
alter table whatsapp_conversas
  add column if not exists lead_sugerido boolean not null default false,
  add column if not exists confianca_lead numeric,
  add column if not exists motivo_sugestao text;
