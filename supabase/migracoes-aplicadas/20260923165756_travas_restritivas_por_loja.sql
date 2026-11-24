-- 20260923165756 travas_restritivas_por_loja

-- Trava de loja como política RESTRITIVA: ela se soma (E lógico) a todas as
-- políticas já existentes, sem precisar mexer em nenhuma delas.
-- Fecha os casos em que qualquer usuário logado enxergava o conteúdo de
-- todas as lojas. Gestor e Diretor continuam vendo tudo.

CREATE POLICY "Trava de loja no FAQ"
  ON public.perguntas_frequentes AS RESTRICTIVE FOR SELECT TO authenticated
  USING (empresa = public.minha_empresa() OR public.meu_cargo() IN ('Gestor','Diretor'));

CREATE POLICY "Trava de loja nos treinamentos"
  ON public.treinamentos AS RESTRICTIVE FOR SELECT TO authenticated
  USING (empresa = public.minha_empresa() OR public.meu_cargo() IN ('Gestor','Diretor'));

CREATE POLICY "Trava de loja nas perguntas de qualificação"
  ON public.perguntas_qualificacao AS RESTRICTIVE FOR SELECT TO authenticated
  USING (empresa = public.minha_empresa() OR public.meu_cargo() IN ('Gestor','Diretor'));

CREATE POLICY "Trava de loja na planilha de indicadores"
  ON public.planilha_leads_indicadores AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.meu_cargo() IN ('Gestor','Diretor')
    OR (public.meu_cargo() = 'Marketing'
        AND EXISTS (SELECT 1 FROM public.profiles p
                    WHERE p.id = planilha_leads_indicadores.usuario_id
                      AND p.empresa = public.minha_empresa()))
  );

CREATE POLICY "Trava de loja nos indicadores semanais"
  ON public.indicadores_semanais AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    vendedor_id = auth.uid()
    OR public.meu_cargo() IN ('Gestor','Diretor')
    OR (public.meu_cargo() = 'Marketing'
        AND EXISTS (SELECT 1 FROM public.profiles p
                    WHERE p.id = indicadores_semanais.vendedor_id
                      AND p.empresa = public.minha_empresa()))
  );

CREATE POLICY "Trava de loja nos leads"
  ON public.leads_recebidos AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    empresa = public.minha_empresa()
    OR public.meu_cargo() IN ('Gestor','Diretor')
    OR vendedor_id = auth.uid()
    OR sdr_id = auth.uid()
  );

