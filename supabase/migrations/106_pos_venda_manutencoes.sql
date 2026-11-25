-- 106 · Manutenções do pós-venda: limpeza anual da chaminé e revisão (25/11/2026)
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
--   ver     → quem é da mesma loja, quem vê a loja toda (Diretor e Gestor
--             aprovado) e quem vê todas as lojas;
--   mexer   → Pós-venda ou Gestor daquela loja, ou quem vê a loja toda.
-- Só usa funções que já existem em produção: meu_cargo(), minha_empresa(),
-- vejo_a_loja_toda() e pode_ver_todas_empresas() (nada da migração 105).
--
-- Pode rodar mais de uma vez sem estragar nada.

begin;

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
    empresa = minha_empresa()
    or vejo_a_loja_toda()
    or pode_ver_todas_empresas()
  );

-- Na criação, a loja da manutenção tem de ser a do próprio pós-venda (e a
-- pessoa precisa enxergar esse pós-venda — a RLS de pos_vendas vale aqui dentro).
drop policy if exists "Criar manutenções conforme papel" on public.pos_venda_manutencoes;
create policy "Criar manutenções conforme papel" on public.pos_venda_manutencoes
  for insert to authenticated with check (
    (
      vejo_a_loja_toda()
      or (meu_cargo() = any (array['Pós-venda', 'Gestor']) and empresa = minha_empresa())
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
    vejo_a_loja_toda()
    or (meu_cargo() = any (array['Pós-venda', 'Gestor']) and empresa = minha_empresa())
  )
  with check (
    vejo_a_loja_toda()
    or (meu_cargo() = any (array['Pós-venda', 'Gestor']) and empresa = minha_empresa())
  );

drop policy if exists "Apagar manutenções conforme papel" on public.pos_venda_manutencoes;
create policy "Apagar manutenções conforme papel" on public.pos_venda_manutencoes
  for delete to authenticated using (
    vejo_a_loja_toda()
    or (meu_cargo() = any (array['Pós-venda', 'Gestor']) and empresa = minha_empresa())
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
