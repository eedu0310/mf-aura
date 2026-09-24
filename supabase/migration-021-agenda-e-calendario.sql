-- 021 — Agenda mais completa e calendário assinável pelo celular
-- (aplicado no projeto em 24/09/2026)

ALTER TABLE public.compromissos
  ADD COLUMN IF NOT EXISTS duracao_minutos integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS local text,
  ADD COLUMN IF NOT EXISTS observacao text,
  ADD COLUMN IF NOT EXISTS relacionamento_id uuid REFERENCES public.relacionamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agenda_token uuid;
UPDATE public.profiles SET agenda_token = gen_random_uuid() WHERE agenda_token IS NULL;
ALTER TABLE public.profiles ALTER COLUMN agenda_token SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS profiles_agenda_token_idx ON public.profiles (agenda_token);
CREATE INDEX IF NOT EXISTS compromissos_owner_data_idx ON public.compromissos (owner_id, data);

-- Orçamento anexado à oportunidade
ALTER TABLE public.oportunidades
  ADD COLUMN IF NOT EXISTS orcamento_path text,
  ADD COLUMN IF NOT EXISTS orcamento_nome text;
