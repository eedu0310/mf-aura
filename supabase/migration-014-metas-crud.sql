-- AURA: garante o CRUD da meta mensal do usuário.
-- Execute esta migration no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS public.metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes text NOT NULL,
  valor_meta numeric NOT NULL CHECK (valor_meta > 0),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS valor_meta numeric;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS mes text;
ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS owner_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS metas_owner_mes_uidx ON public.metas(owner_id, mes);
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário vê própria meta" ON public.metas;
CREATE POLICY "Usuário vê própria meta" ON public.metas FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Usuário cria própria meta" ON public.metas;
CREATE POLICY "Usuário cria própria meta" ON public.metas FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Usuário atualiza própria meta" ON public.metas;
CREATE POLICY "Usuário atualiza própria meta" ON public.metas FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Usuário exclui própria meta" ON public.metas;
CREATE POLICY "Usuário exclui própria meta" ON public.metas FOR DELETE USING (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.atualizar_meta_atualizada_em()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS metas_atualizado_em ON public.metas;
CREATE TRIGGER metas_atualizado_em BEFORE UPDATE ON public.metas
FOR EACH ROW EXECUTE FUNCTION public.atualizar_meta_atualizada_em();
