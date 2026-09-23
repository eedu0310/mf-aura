-- ============================================================================
-- 020 — Isolamento por loja + pipeline automático da AURA
-- (aplicado no Supabase em 22/09/2026; arquivo mantido como histórico)
-- ============================================================================
-- 1) SEGURANÇA: as tabelas centrais estavam SEM row level security ligada e
--    com policies antigas que liberavam tudo para qualquer usuário logado.
alter table public.relacionamentos enable row level security;
alter table public.oportunidades  enable row level security;
alter table public.vendas         enable row level security;
alter table public.leads_recebidos enable row level security;

-- Policies removidas: "Select/Insert/Update <tabela>" (auth.role() = 'authenticated'
-- ou owner_id is null) em relacionamentos, oportunidades, atividades, vendas e
-- leads_recebidos; e as policies "true" das tabelas whatsapp_conversas/mensagens.
-- Regra nova: ver = (empresa = minha_empresa() or pode_ver_todas_empresas());
--             criar = (owner_id = auth.uid() and (empresa = minha_empresa()
--                      or pode_ver_todas_empresas())).

-- 2) Ranking passou a respeitar as regras de quem consulta
alter view public.aura_ranking_vendas set (security_invoker = on);

-- 3) Funções sensíveis não podem mais ser chamadas sem login
revoke execute on function public.distribuir_lead_novo(uuid) from anon, public;
revoke execute on function public.repassar_leads_expirados() from anon, public;
revoke execute on function public.aura_transferir_carteira(uuid, uuid, text, boolean) from anon, public;

-- 4) PIPELINE AUTOMÁTICO: funções aura_ordem_etapa / aura_prob_etapa /
--    aura_avancar_oportunidade e os gatilhos:
--    - trg_aura_atividade_move_pipeline (atividades)  → visita/reunião = Apresentação,
--      orçamento = Proposta, desconto/parcelamento = Negociação, venda = Fechados
--    - trg_aura_venda_fecha_pipeline (vendas)         → Fechados
--    Só avança etapa, nunca volta; nunca marca "Perdidos" sozinha; ignora os
--    registros do próprio sistema e avisa o vendedor por notificação.
