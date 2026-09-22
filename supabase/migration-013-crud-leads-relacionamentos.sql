-- AURA: exclusão explícita e verificável de leads e relacionamentos.
-- O filtro por empresa impede apagar registros de outra loja.

DO $$
BEGIN
  IF to_regclass('public.relacionamentos') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Excluir relacionamentos da própria loja" ON public.relacionamentos';
    EXECUTE 'CREATE POLICY "Excluir relacionamentos da própria loja" ON public.relacionamentos FOR DELETE USING (empresa = (SELECT empresa FROM public.profiles WHERE id = auth.uid()))';
  END IF;

  IF to_regclass('public.leads_recebidos') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Excluir leads da própria empresa" ON public.leads_recebidos';
    EXECUTE 'CREATE POLICY "Excluir leads da própria empresa" ON public.leads_recebidos FOR DELETE USING (empresa = (SELECT empresa FROM public.profiles WHERE id = auth.uid()) OR vendedor_id = auth.uid() OR sdr_id = auth.uid())';
  END IF;
END $$;
