-- AURA: quinta semana/restante, total de indicadores e tarefas manuais.

DO $$
BEGIN
  IF to_regclass('public.planilha_leads_indicadores') IS NOT NULL THEN
    ALTER TABLE public.planilha_leads_indicadores ADD COLUMN IF NOT EXISTS semana5 numeric NOT NULL DEFAULT 0;
    ALTER TABLE public.planilha_leads_indicadores ADD COLUMN IF NOT EXISTS total numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  concluida boolean NOT NULL DEFAULT false,
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('alta', 'media', 'baixa')),
  criada_em timestamptz NOT NULL DEFAULT now(),
  atualizada_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuário vê próprias tarefas" ON public.tarefas;
CREATE POLICY "Usuário vê próprias tarefas" ON public.tarefas FOR SELECT USING (vendedor_id = auth.uid());
DROP POLICY IF EXISTS "Usuário cria próprias tarefas" ON public.tarefas;
CREATE POLICY "Usuário cria próprias tarefas" ON public.tarefas FOR INSERT WITH CHECK (vendedor_id = auth.uid());
DROP POLICY IF EXISTS "Usuário atualiza próprias tarefas" ON public.tarefas;
CREATE POLICY "Usuário atualiza próprias tarefas" ON public.tarefas FOR UPDATE USING (vendedor_id = auth.uid()) WITH CHECK (vendedor_id = auth.uid());
DROP POLICY IF EXISTS "Usuário exclui próprias tarefas" ON public.tarefas;
CREATE POLICY "Usuário exclui próprias tarefas" ON public.tarefas FOR DELETE USING (vendedor_id = auth.uid());
