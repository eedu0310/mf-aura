-- 20260923165540 aura_corrente_do_lead_automatica

-- Liga a corrente do lead: entrou -> distribuído -> respondido -> pipeline.

-- 1) Todo lead novo é distribuído sozinho (antes dependia de a aplicação
--    lembrar de chamar distribuir_lead_novo).
CREATE OR REPLACE FUNCTION public.aura_distribuir_lead_ao_entrar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS NULL OR NEW.status = 'aguardando_sdr' THEN
    PERFORM public.distribuir_lead_novo(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_aura_distribuir_lead_ao_entrar
AFTER INSERT ON public.leads_recebidos
FOR EACH ROW EXECUTE FUNCTION public.aura_distribuir_lead_ao_entrar();

-- 2) Lead respondido vira cliente e negócio no pipeline.
CREATE OR REPLACE FUNCTION public.aura_lead_respondido_vira_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dono uuid;
  v_rel uuid;
  v_nome text;
BEGIN
  IF NEW.status <> 'respondido' OR COALESCE(OLD.status,'') = 'respondido' THEN
    RETURN NEW;
  END IF;

  v_dono := COALESCE(NEW.vendedor_id, NEW.respondido_por, NEW.sdr_id);
  IF v_dono IS NULL THEN RETURN NEW; END IF;

  v_nome := COALESCE(NULLIF(btrim(NEW.nome), ''), NEW.telefone, 'Cliente sem nome');
  v_rel  := NEW.relacionamento_id;

  -- Acha o cliente pelo telefone antes de criar outro.
  IF v_rel IS NULL AND NEW.telefone IS NOT NULL THEN
    SELECT id INTO v_rel
    FROM public.relacionamentos
    WHERE empresa = NEW.empresa
      AND telefone_normalizado = public.aura_normalizar_telefone(NEW.telefone)
    LIMIT 1;
  END IF;

  IF v_rel IS NULL THEN
    INSERT INTO public.relacionamentos (owner_id, empresa, nome, telefone, email, categoria, origem, observacao)
    VALUES (v_dono, NEW.empresa, v_nome, NEW.telefone, NEW.email, 'Cliente',
            COALESCE(NEW.origem, 'Lead'),
            NULLIF(NEW.mensagem_inicial, ''))
    RETURNING id INTO v_rel;
  END IF;

  UPDATE public.leads_recebidos SET relacionamento_id = v_rel WHERE id = NEW.id;

  -- Cria o negócio no pipeline se ainda não houver nenhum aberto.
  IF NOT EXISTS (
    SELECT 1 FROM public.oportunidades
    WHERE relacionamento_id = v_rel AND etapa NOT IN ('Fechados','Perdidos')
  ) THEN
    INSERT INTO public.oportunidades (owner_id, empresa, cliente, produto, valor, etapa, probabilidade, relacionamento_id, descricao)
    VALUES (v_dono, NEW.empresa, v_nome,
            COALESCE(NULLIF(NEW.resumo_ia,''), NULLIF(NEW.mensagem_inicial,''), 'Lead recebido'),
            0, 'Prospecção',
            CASE NEW.urgencia WHEN 'alta' THEN 'Alta' WHEN 'baixa' THEN 'Baixa' ELSE 'Média' END,
            v_rel,
            'Criado automaticamente a partir de um lead de ' || COALESCE(NEW.origem,'origem não informada') || '.');
  END IF;

  INSERT INTO public.notificacoes (vendedor_id, titulo, mensagem, tipo, acao_url)
  VALUES (v_dono, 'Lead virou negócio no pipeline',
          v_nome || ' entrou no pipeline em Prospecção. Registre o próximo passo.',
          'lead', '/pipeline');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_aura_lead_respondido_vira_pipeline
AFTER UPDATE OF status ON public.leads_recebidos
FOR EACH ROW EXECUTE FUNCTION public.aura_lead_respondido_vira_pipeline();

-- 3) Quem recebeu o lead é avisado na hora.
CREATE OR REPLACE FUNCTION public.aura_avisar_dono_do_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dono uuid;
  v_nome text;
BEGIN
  v_dono := COALESCE(NEW.vendedor_id, NEW.sdr_id);
  IF v_dono IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.vendedor_id, OLD.sdr_id) IS NOT DISTINCT FROM v_dono THEN
    RETURN NEW;
  END IF;

  v_nome := COALESCE(NULLIF(btrim(NEW.nome), ''), NEW.telefone, 'Novo lead');

  INSERT INTO public.notificacoes (vendedor_id, titulo, mensagem, tipo, acao_url)
  VALUES (v_dono, 'Lead novo para atender',
          v_nome || ' chegou por ' || COALESCE(NEW.origem,'origem não informada')
            || '. Responda antes do prazo.',
          'lead', '/leads');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_aura_avisar_dono_do_lead
AFTER INSERT OR UPDATE OF sdr_id, vendedor_id ON public.leads_recebidos
FOR EACH ROW EXECUTE FUNCTION public.aura_avisar_dono_do_lead();

