-- Integridade do ranking, origem dos contatos e detalhamento das atividades.
alter table public.relacionamentos add column if not exists origem text;
alter table public.atividades add column if not exists origem text;

create index if not exists vendas_owner_data_oportunidade_idx
  on public.vendas (owner_id, data, oportunidade_id);
create index if not exists atividades_empresa_origem_idx
  on public.atividades (empresa, origem);
create index if not exists relacionamentos_empresa_origem_idx
  on public.relacionamentos (empresa, origem);

-- Registros de venda criados automaticamente pelo fechamento do pipeline devem
-- permanecer identificáveis para serem removidos quando o negócio sair de Fechados.
update public.vendas
set status = coalesce(status, 'fechada')
where oportunidade_id is not null and status is null;
