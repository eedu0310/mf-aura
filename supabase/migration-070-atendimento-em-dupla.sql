-- 070 — Atendimento em dupla
--
-- Já aplicada no banco (versão 20261006173312). O arquivo existe para que o
-- histórico do repositório conte a mesma história que o banco.
--
-- O caso: a vendedora interna atende, repassa o atendimento para uma colega e
-- as duas seguem falando com o mesmo cliente. Hoje o sistema só sabe de um
-- dono por cliente, então a colega que entrou junto ficava invisível — não via
-- a conversa e não aparecia na venda.
--
-- A escolha: o dono continua sendo um só (owner_id), e o parceiro é um segundo
-- campo. Isto é de propósito. Dois donos no mesmo registro quebrariam a
-- separação de carteira, que é a regra mais dura do sistema ("cada vendedor é
-- responsável pelo seu lead"); com um dono e um convidado, a carteira continua
-- tendo um responsável e a visibilidade abre apenas para quem foi convidado.
--
-- O dinheiro mora na venda, não no cliente: percentual_parceiro diz quanto da
-- venda é do parceiro, e o dono fica com o resto. A conta está em
-- src/lib/parceria.ts, com teste em src/lib/parceria.teste.ts.

alter table public.relacionamentos
  add column if not exists parceiro_id uuid references auth.users(id) on delete set null,
  add column if not exists parceria_em timestamptz,
  add column if not exists parceria_motivo text;

alter table public.oportunidades
  add column if not exists parceiro_id uuid references auth.users(id) on delete set null;

alter table public.whatsapp_ia_leads
  add column if not exists parceiro_id uuid references auth.users(id) on delete set null;

alter table public.vendas
  add column if not exists parceiro_id uuid references auth.users(id) on delete set null,
  add column if not exists percentual_parceiro numeric(5,2) not null default 0;

-- A trava do percentual fica no banco, e não só na tela: a venda é gravada por
-- três caminhos (tela, IA do WhatsApp e trigger) e um percentual fora da faixa
-- faria a fatia do dono virar negativa no relatório.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vendas_percentual_parceiro_faixa'
  ) then
    alter table public.vendas
      add constraint vendas_percentual_parceiro_faixa
      check (percentual_parceiro >= 0 and percentual_parceiro <= 100);
  end if;
end $$;

-- Índices parciais: a dupla é exceção, não regra. Indexar só as linhas com
-- parceiro mantém o índice pequeno e serve exatamente a consulta que a RLS
-- passou a fazer ("onde eu sou parceiro").
create index if not exists idx_relacionamentos_parceiro
  on public.relacionamentos (parceiro_id) where parceiro_id is not null;
create index if not exists idx_oportunidades_parceiro
  on public.oportunidades (parceiro_id) where parceiro_id is not null;
create index if not exists idx_whatsapp_ia_leads_parceiro
  on public.whatsapp_ia_leads (parceiro_id) where parceiro_id is not null;
create index if not exists idx_vendas_parceiro
  on public.vendas (parceiro_id) where parceiro_id is not null;
