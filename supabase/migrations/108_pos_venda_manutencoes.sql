-- 108 · Manutenções do pós-venda: limpeza anual da chaminé e revisão (25/11/2026)
--
-- Pedido do Elton: o pós-venda é um processo inteiro, e como a loja vende
-- lareira, cerca de um ano depois da instalação oferece a limpeza da chaminé.
-- É um acompanhamento mais adiante, que precisa de agenda própria.
--
-- Uma linha por manutenção. Concluir uma limpeza (pela tela) já cria a
-- próxima, prevista para 12 meses depois. Enquanto esta tabela não existir, a
-- tela de Manutenções mostra só a previsão calculada (instalação + 12 meses),
-- sem agendar nem registrar.
--
-- Permissões no mesmo espírito de pos_vendas:
--   ver     → quem é da mesma loja, o gestor aprovado DAQUELA loja e o
--             gestor mestre (todas as lojas);
--   mexer   → Pós-venda daquela loja, o gestor aprovado daquela loja ou o
--             gestor mestre.
--
-- PRECISA DA 105 (revisão de 25/11/2026): usa administro_a_loja(empresa),
-- criada lá. Antes usava vejo_a_loja_toda() sozinha, que não confere a loja
-- (o gestor de uma loja mexeria nas manutenções das outras), e aceitava o
-- cargo "Gestor" ainda sem aprovação. Ordem de aplicação: 105 → 108 → 109 → 110 (106 e 107 são do Instagram e do chat do site, já aplicadas).
--
-- Pode rodar mais de uma vez sem estragar nada.

begin;

do $$
begin
  if to_regprocedure('public.administro_a_loja(text)') is null then
    raise exception 'Aplique a migração 105 antes da 108 (falta administro_a_loja).';
  end if;
end $$;

create table if not exists public.pos_venda_manutencoes (
  id uuid primary key default gen_random_uuid(),
  pos_venda_id uuid not null references public.pos_vendas(id) on delete cascade,
  empresa text not null,
  tipo text not null default 'limpeza_chamine'
    check (tipo in ('limpeza_chamine', 'revisao', 'outro')),
  -- Quando deveria acontecer (instalação ou última limpeza + 12 meses).
  data_prevista date not null,
  -- Quando foi combinada com o cliente.
  data_agendada date,
  hora text,
  status text not null default 'prevista'
    check (status in ('prevista', 'agendada', 'realizada', 'cancelada')),
  realizada_em timestamptz,
  observacao text,
  responsavel_id uuid,
  criado_por uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pos_venda_manutencoes_pos_venda_idx
  on public.pos_venda_manutencoes (pos_venda_id);
create index if not exists pos_venda_manutencoes_empresa_status_data_idx
  on public.pos_venda_manutencoes (empresa, status, data_prevista);

-- No máximo uma manutenção EM ABERTO de cada tipo por cliente: concluir duas
-- vezes (ou em duas abas) não cria duas "próximas limpezas".
create unique index if not exists pos_venda_manutencoes_uma_aberta_por_tipo
  on public.pos_venda_manutencoes (pos_venda_id, tipo)
  where status in ('prevista', 'agendada');

-- updated_at em dia mesmo quando alguém esquece de mandar.
create or replace function public.tocar_updated_at_pos_venda_manutencao()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists trg_tocar_updated_at_pos_venda_manutencao on public.pos_venda_manutencoes;
create trigger trg_tocar_updated_at_pos_venda_manutencao
  before update on public.pos_venda_manutencoes
  for each row execute function public.tocar_updated_at_pos_venda_manutencao();

alter table public.pos_venda_manutencoes enable row level security;

-- Ninguém de fora do sistema (anon) lê ou escreve.
revoke all on public.pos_venda_manutencoes from anon;
grant select, insert, update, delete on public.pos_venda_manutencoes to authenticated;

drop policy if exists "Ver manutenções conforme papel" on public.pos_venda_manutencoes;
create policy "Ver manutenções conforme papel" on public.pos_venda_manutencoes
  for select to authenticated using (
    empresa = public.minha_empresa()
    or public.administro_a_loja(empresa)
  );

-- Na criação, a loja da manutenção tem de ser a do próprio pós-venda (e a
-- pessoa precisa enxergar esse pós-venda — a RLS de pos_vendas vale aqui dentro).
drop policy if exists "Criar manutenções conforme papel" on public.pos_venda_manutencoes;
create policy "Criar manutenções conforme papel" on public.pos_venda_manutencoes
  for insert to authenticated with check (
    (
      public.administro_a_loja(empresa)
      or (public.meu_cargo() = 'Pós-venda' and empresa = public.minha_empresa())
    )
    and exists (
      select 1 from public.pos_vendas pv
       where pv.id = pos_venda_manutencoes.pos_venda_id
         and pv.empresa = pos_venda_manutencoes.empresa
    )
  );

drop policy if exists "Atualizar manutenções conforme papel" on public.pos_venda_manutencoes;
create policy "Atualizar manutenções conforme papel" on public.pos_venda_manutencoes
  for update to authenticated
  using (
    public.administro_a_loja(empresa)
    or (public.meu_cargo() = 'Pós-venda' and empresa = public.minha_empresa())
  )
  with check (
    public.administro_a_loja(empresa)
    or (public.meu_cargo() = 'Pós-venda' and empresa = public.minha_empresa())
  );

drop policy if exists "Apagar manutenções conforme papel" on public.pos_venda_manutencoes;
create policy "Apagar manutenções conforme papel" on public.pos_venda_manutencoes
  for delete to authenticated using (
    public.administro_a_loja(empresa)
    or (public.meu_cargo() = 'Pós-venda' and empresa = public.minha_empresa())
  );

-- Sincronização ao vivo na tela (como pos_vendas), se a publicação existir.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'pos_venda_manutencoes'
     ) then
    alter publication supabase_realtime add table public.pos_venda_manutencoes;
  end if;
end;
$$;

commit;
