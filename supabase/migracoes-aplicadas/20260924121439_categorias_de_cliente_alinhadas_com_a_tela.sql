-- 20260924121439 categorias_de_cliente_alinhadas_com_a_tela

-- A tela oferecia "Distribuidor" e "Outro", mas o banco recusava: quem
-- escolhesse uma dessas tomava erro ao salvar. Agora a lista bate, e entram
-- "Consultor" e "Obra" para os rankings de prospecção.
ALTER TABLE public.relacionamentos DROP CONSTRAINT IF EXISTS relacionamentos_categoria_check;
ALTER TABLE public.relacionamentos ADD CONSTRAINT relacionamentos_categoria_check
  CHECK (categoria = ANY (ARRAY[
    'Cliente Final','Cliente','Arquiteto','Construtora','Obra','Consultor',
    'Revendedor','Engenheiro','Designer de Interiores','Distribuidor','Outro'
  ]));

ALTER TABLE public.metas_atividade DROP CONSTRAINT IF EXISTS metas_atividade_categoria_check;
ALTER TABLE public.metas_atividade ADD CONSTRAINT metas_atividade_categoria_check
  CHECK (categoria = ANY (ARRAY[
    'Cliente Final','Arquiteto','Construtora','Obra','Consultor',
    'Revendedor','Engenheiro','Designer de Interiores'
  ]));
