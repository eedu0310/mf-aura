-- 20261006173312 070_atendimento_em_dupla

-- Atendimento em dupla: o interno levanta, o externo fecha, os dois dividem.
--
-- O CASO REAL: a vendedora interna atende, qualifica e passa o cliente para o
-- colega que vai fechar. Hoje o sistema so entende UM dono: quem recebe o
-- contato perde o cliente de vista, e quem fecha leva a venda inteira. O
-- resultado e que ninguem registra a passagem -- ela acontece no corredor, e
-- some do sistema.
--
-- POR QUE ISTO NAO E UM FURO NA SEPARACAO DE CARTEIRA. A regra continua a
-- mesma: ninguem ve o cliente de ninguem. A diferenca e que agora existe uma
-- forma EXPLICITA de convidar alguem para dentro de um atendimento, gravada,
-- com nome e data. Lead nao vaza por acidente; ele e compartilhado por
-- decisao de quem e dono dele.
alter table public.relacionamentos
  add column if not exists parceiro_id uuid references auth.users(id) on delete set null,
  add column if not exists parceria_em timestamptz,
  add column if not exists parceria_motivo text;

alter table public.oportunidades
  add column if not exists parceiro_id uuid references auth.users(id) on delete set null;

alter table public.whatsapp_ia_leads
  add column if not exists parceiro_id uuid references auth.users(id) on delete set null;

comment on column public.relacionamentos.parceiro_id is
  'Segundo vendedor no atendimento. Ve e trabalha este cliente junto com o dono, e divide a venda.';

-- O rateio fica na venda, nao no cadastro das pessoas: a divisao e daquela
-- venda. Na venda seguinte do mesmo cliente a dupla pode ser outra, ou nenhuma.
alter table public.vendas
  add column if not exists parceiro_id uuid references auth.users(id) on delete set null,
  add column if not exists percentual_parceiro numeric(5,2) not null default 0;

comment on column public.vendas.percentual_parceiro is
  'Quanto desta venda e do parceiro, de 0 a 100. O dono fica com o resto. Zero = venda inteira do dono.';

alter table public.vendas
  add constraint vendas_percentual_parceiro_check
  check (percentual_parceiro >= 0 and percentual_parceiro <= 100);

create index if not exists idx_relacionamentos_parceiro on public.relacionamentos (parceiro_id) where parceiro_id is not null;
create index if not exists idx_oportunidades_parceiro on public.oportunidades (parceiro_id) where parceiro_id is not null;
create index if not exists idx_whatsapp_ia_leads_parceiro on public.whatsapp_ia_leads (parceiro_id) where parceiro_id is not null;
create index if not exists idx_vendas_parceiro on public.vendas (parceiro_id) where parceiro_id is not null;
