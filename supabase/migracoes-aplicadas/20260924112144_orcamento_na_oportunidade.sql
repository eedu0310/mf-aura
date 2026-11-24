-- 20260924112144 orcamento_na_oportunidade

-- Permite anexar o orçamento também à oportunidade (antes só a venda tinha).
-- O botão existia na tela mas só mostrava "será anexado em breve".
ALTER TABLE public.oportunidades
  ADD COLUMN IF NOT EXISTS orcamento_path text,
  ADD COLUMN IF NOT EXISTS orcamento_nome text;
