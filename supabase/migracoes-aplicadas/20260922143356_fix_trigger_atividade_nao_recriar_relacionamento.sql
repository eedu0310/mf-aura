-- 20260922143356 fix_trigger_atividade_nao_recriar_relacionamento

CREATE OR REPLACE FUNCTION public.aura_sync_atividade_relacionamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  relacionamento_encontrado uuid;
  telefone_limpo text;
  email_limpo text;
  data_atividade timestamptz;
BEGIN
  telefone_limpo := public.aura_normalizar_telefone(NEW.cliente_telefone);
  email_limpo := public.aura_normalizar_email(NEW.cliente_email);
  data_atividade := COALESCE(NEW.ocorrida_em, NEW.created_at, now());

  -- Só vincula/cria relacionamento automaticamente quando a atividade é criada
  -- (ou quando ela nunca teve vínculo). Se o vínculo foi REMOVIDO de propósito
  -- (ex.: o relacionamento foi excluído e o ON DELETE SET NULL limpou a coluna),
  -- não recria o relacionamento — antes disso o contato "ressuscitava".
  IF NEW.relacionamento_id IS NULL
     AND (TG_OP = 'INSERT' OR OLD.relacionamento_id IS NULL)
     AND NULLIF(btrim(COALESCE(NEW.cliente_nome, NEW.contexto, '')), '') IS NOT NULL THEN
    SELECT r.id
      INTO relacionamento_encontrado
    FROM public.relacionamentos r
    WHERE r.empresa = NEW.empresa
      AND r.owner_id = NEW.owner_id
      AND (
        (telefone_limpo IS NOT NULL AND r.telefone_normalizado = telefone_limpo)
        OR (email_limpo IS NOT NULL AND r.email_normalizado = email_limpo)
        OR (
          telefone_limpo IS NULL
          AND email_limpo IS NULL
          AND lower(btrim(r.nome)) = lower(btrim(COALESCE(NEW.cliente_nome, NEW.contexto)))
        )
      )
    ORDER BY r.updated_at DESC NULLS LAST, r.created_at DESC
    LIMIT 1;

    IF relacionamento_encontrado IS NULL THEN
      INSERT INTO public.relacionamentos (
        owner_id, empresa, nome, categoria, cidade, telefone, email, temperatura,
        ultimo_contato, ultimo_contato_em, proximo_contato, proximo_contato_em,
        obras_indicadas, valor_gerado, tags
      )
      VALUES (
        NEW.owner_id,
        NEW.empresa,
        COALESCE(NULLIF(btrim(NEW.cliente_nome), ''), NULLIF(btrim(NEW.contexto), ''), 'Cliente sem nome'),
        COALESCE(NULLIF(btrim(NEW.cliente_categoria), ''), 'Cliente Final'),
        NULL,
        NULLIF(btrim(NEW.cliente_telefone), ''),
        NULLIF(btrim(NEW.cliente_email), ''),
        'ativo',
        to_char(data_atividade AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
        data_atividade,
        CASE WHEN NEW.proximo_contato_em IS NULL THEN NULL
             ELSE to_char(NEW.proximo_contato_em AT TIME ZONE 'UTC', 'YYYY-MM-DD') END,
        NEW.proximo_contato_em,
        0,
        0,
        ARRAY[]::text[]
      )
      RETURNING id INTO relacionamento_encontrado;
    END IF;

    NEW.relacionamento_id := relacionamento_encontrado;
  END IF;

  IF NEW.relacionamento_id IS NOT NULL THEN
    UPDATE public.relacionamentos
    SET
      nome = COALESCE(NULLIF(btrim(NEW.cliente_nome), ''), nome),
      telefone = COALESCE(NULLIF(btrim(NEW.cliente_telefone), ''), telefone),
      email = COALESCE(NULLIF(btrim(NEW.cliente_email), ''), email),
      categoria = COALESCE(NULLIF(btrim(NEW.cliente_categoria), ''), categoria),
      ultimo_contato = to_char(data_atividade AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
      ultimo_contato_em = data_atividade,
      proximo_contato = CASE
        WHEN NEW.proximo_contato_em IS NULL THEN proximo_contato
        ELSE to_char(NEW.proximo_contato_em AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      END,
      proximo_contato_em = COALESCE(NEW.proximo_contato_em, proximo_contato_em),
      updated_at = now()
    WHERE id = NEW.relacionamento_id
      AND empresa = NEW.empresa;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;
