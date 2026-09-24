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

-- Telefone no perfil (a tela mostrava um número fixo no código)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefone text;

-- Uma venda por oportunidade: sem isso, mover o negócio para "Fechados"
-- duas vezes criava duas vendas e inflava o faturamento.
CREATE OR REPLACE FUNCTION public.aura_impedir_venda_duplicada()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.oportunidade_id IS NULL THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.vendas
             WHERE oportunidade_id = NEW.oportunidade_id
               AND (TG_OP = 'INSERT' OR id <> NEW.id)) THEN
    RAISE EXCEPTION 'Esta oportunidade já tem uma venda registrada.' USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_aura_impedir_venda_duplicada ON public.vendas;
CREATE TRIGGER trg_aura_impedir_venda_duplicada
BEFORE INSERT OR UPDATE OF oportunidade_id ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.aura_impedir_venda_duplicada();
