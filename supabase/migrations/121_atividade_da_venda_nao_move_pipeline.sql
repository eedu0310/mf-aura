-- 121 — A atividade que acompanha uma venda não mexe no pipeline
-- (27/11/2026, junto com o "Completar venda").
--
-- Registrar (ou completar) uma venda grava também uma atividade tipo "Venda",
-- com metadata.venda_id. O pipeline já foi resolvido pela própria venda
-- (aura_venda_fecha_pipeline). Mas o gatilho da atividade via "Venda" e
-- mandava fechar "o card aberto do cliente" — e 29 clientes têm mais de um
-- card aberto: o OUTRO card ia para Fechamento e o banco abria uma segunda
-- venda "aguardando detalhes" para ele.

create or replace function public.aura_atividade_move_pipeline()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  texto text;
  chave_alvo text;
  criar boolean := false;
begin
  if new.relacionamento_id is null then return new; end if;
  if coalesce(new.origem, '') = 'whatsapp_ia'
     or new.titulo ilike 'Oportunidade %' or new.titulo ilike 'IA moveu%' or new.titulo ilike 'Etapa alterada%' then
    return new;
  end if;
  -- Atividade de uma venda já gravada: a venda cuidou do pipeline.
  if coalesce(new.metadata ->> 'venda_id', '') <> '' then return new; end if;

  texto := lower(translate(coalesce(new.titulo,'') || ' ' || coalesce(new.contexto,'') || ' ' || coalesce(new.observacao,'') || ' ' ||
                           coalesce(new.resultado,'') || ' ' || coalesce(new.proximo_passo,'') || ' ' || coalesce(new.subtipo,''),
                           'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'));

  if new.tipo = 'Venda' or texto ~ '(venda fechada|negocio fechado|fechou|fechamos|pedido confirmado|contrato assinado|pagamento (confirmado|recebido))' then
    chave_alvo := 'fechamento';
  elsif texto ~ '(desconto|parcel|condicao de pagamento|negocia|contraproposta)' then
    chave_alvo := 'negociacao';
  elsif new.tipo = 'Orçamento' or texto ~ '(orcamento|proposta enviada|enviei (a )?proposta|cotacao)' then
    chave_alvo := 'followup'; criar := true;
  elsif new.tipo in ('Visita', 'Reunião') or texto ~ '(apresentacao|showroom|catalogo|visita tecnica|medicao)' then
    chave_alvo := 'apresentacao'; criar := true;
  else
    return new;
  end if;

  if coalesce(new.metadata ->> 'houve_oportunidade', '') = 'true' then
    criar := false;
  end if;

  perform public.aura_avancar_oportunidade(null, new.relacionamento_id, chave_alvo,
    'Atividade: ' || coalesce(new.tipo,'') || ' — ' || coalesce(new.titulo,''), criar);
  return new;
end;
$$;
