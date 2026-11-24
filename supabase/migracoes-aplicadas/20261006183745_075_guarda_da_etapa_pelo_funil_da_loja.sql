-- 20261006183745 075_guarda_da_etapa_pelo_funil_da_loja

-- 075 — A guarda da etapa passa a ser o funil da loja
--
-- Ver o arquivo supabase/migration-075-o-funil-editavel-destravado.sql para a
-- explicação inteira. Em resumo: a tabela oportunidades tem um CHECK com dez
-- nomes de etapa escritos à mão, o que trava o funil editável — renomear uma
-- etapa faria o banco recusar a gravação e os cards sumirem do quadro.
--
-- Esta migração cria a guarda nova, que confere contra o funil DAQUELA loja.
-- A remoção do CHECK antigo vai separada, porque o conector não aceita o
-- comando, e sem ela esta guarda apenas convive com a antiga.

create or replace function public.aura_etapa_existe_no_funil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tem_funil boolean;
begin
  if new.etapa is null or btrim(new.etapa) = '' then
    raise exception 'O negócio precisa de uma etapa.';
  end if;

  -- Nada mudou na etapa? Não custa nem uma consulta.
  if tg_op = 'UPDATE' and old.etapa is not distinct from new.etapa then
    return new;
  end if;

  select exists (select 1 from public.etapas_funil where empresa = new.empresa)
    into tem_funil;

  -- Loja que ainda não tem funil próprio usa o padrão do sistema, e o padrão
  -- não está no banco. Deixar passar é o que permite uma loja nova nascer.
  if not tem_funil then
    return new;
  end if;

  if not exists (
    select 1 from public.etapas_funil
     where empresa = new.empresa and nome = new.etapa
  ) then
    raise exception
      'A etapa "%" não existe no funil da loja %. Use uma das etapas configuradas em Painel do Gestor → Etapas do Funil.',
      new.etapa, new.empresa;
  end if;

  return new;
end;
$$;

create trigger trg_aura_etapa_existe_no_funil
  before insert or update of etapa on public.oportunidades
  for each row execute function public.aura_etapa_existe_no_funil();
