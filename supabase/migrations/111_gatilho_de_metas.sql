-- 111 · Conserta o gatilho de metas (25/11/2026)
--
-- O gatilho metas_atualizado_em chama atualizar_meta_atualizada_em(), que
-- gravava NEW.atualizado_em — coluna que a tabela metas NÃO tem (ela tem
-- updated_at). Resultado: QUALQUER update em metas falhava com
-- 'record "new" has no field "atualizado_em"', inclusive na AURA que está no
-- ar. Achado no ensaio da migração 109. A função só é usada por esse gatilho.

create or replace function public.atualizar_meta_atualizada_em()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;
