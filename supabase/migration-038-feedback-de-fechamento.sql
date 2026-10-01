-- 038 — Feedback que a AURA escreve quando o vendedor marca Fechado ou Perdido.
-- Guardado, e não só mostrado na hora, por três motivos: o vendedor relê, o
-- gestor acompanha a jornada da pessoa ao longo do mês, e o relatório do
-- período é montado a partir daqui sem gastar IA de novo.
create table if not exists public.aura_feedback_fechamento (
  id                uuid primary key default gen_random_uuid(),
  empresa           text not null,
  vendedor_id       uuid not null references public.profiles(id) on delete cascade,
  oportunidade_id   uuid references public.oportunidades(id) on delete set null,
  relacionamento_id uuid references public.relacionamentos(id) on delete set null,
  cliente           text,
  resultado         text not null check (resultado in ('fechado', 'perdido')),
  valor             numeric,
  origem_lead       public.origem_lead,
  resumo            text not null,
  -- separados do resumo para o gestor conseguir somar padrões no mês
  acertos           text[] not null default '{}',
  erros             text[] not null default '{}',
  -- aderência ao funil: etapas que o negócio nunca visitou. É assim que se vê
  -- quem pula a apresentação e vai direto a preço.
  etapas_puladas    text[] not null default '{}',
  -- onde doeu, em uma palavra, para agrupar a falha recorrente da pessoa
  ponto_fraco       text,
  motivo_informado  text,
  criado_em         timestamptz not null default now()
);

create index if not exists feedback_fechamento_do_vendedor
  on public.aura_feedback_fechamento (vendedor_id, criado_em desc);
create index if not exists feedback_fechamento_da_loja
  on public.aura_feedback_fechamento (empresa, criado_em desc);

alter table public.aura_feedback_fechamento enable row level security;

drop policy if exists "Ver o proprio feedback de fechamento" on public.aura_feedback_fechamento;
create policy "Ver o proprio feedback de fechamento"
  on public.aura_feedback_fechamento for select to authenticated
  using (
    vendedor_id = auth.uid()
    or pode_ver_todas_empresas()
    or (meu_cargo() = 'Gestor' and empresa = minha_empresa())
  );

-- Quem escreve é o servidor (service role). Nenhum cliente insere feedback a
-- mão: isto é laudo da AURA, não campo editável.
drop policy if exists "Gestor administra o feedback da loja" on public.aura_feedback_fechamento;
create policy "Gestor administra o feedback da loja"
  on public.aura_feedback_fechamento for delete to authenticated
  using (pode_ver_todas_empresas() or (meu_cargo() = 'Gestor' and empresa = minha_empresa()));
