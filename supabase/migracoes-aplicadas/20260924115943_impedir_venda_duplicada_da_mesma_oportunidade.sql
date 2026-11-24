-- 20260924115943 impedir_venda_duplicada_da_mesma_oportunidade

-- Mover a oportunidade para "Fechados" cria a venda automaticamente. Se isso
-- acontecer duas vezes seguidas (ou em duas abas), a aplicação não percebia a
-- tempo e o mesmo negócio virava duas vendas, inflando o faturamento.
-- Aqui o próprio banco impede a segunda.
CREATE OR REPLACE FUNCTION public.aura_impedir_venda_duplicada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.oportunidade_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.vendas
    WHERE oportunidade_id = NEW.oportunidade_id
      AND (TG_OP = 'INSERT' OR id <> NEW.id)
  ) THEN
    RAISE EXCEPTION 'Esta oportunidade já tem uma venda registrada.'
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_aura_impedir_venda_duplicada
BEFORE INSERT OR UPDATE OF oportunidade_id ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.aura_impedir_venda_duplicada();
