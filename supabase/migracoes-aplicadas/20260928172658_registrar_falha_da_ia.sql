-- 20260928172658 registrar_falha_da_ia

-- Onde a IA registra por que não respondeu.
--
-- Quando o coach falhava, o vendedor via "Não consegui responder com os dados
-- reais agora" e o motivo morria ali: a rota escrevia num arquivo de log
-- dentro do servidor, que ninguém abre. Sem o motivo, o conserto vira
-- adivinhação.
--
-- Agora a falha fica no banco, ao lado do consumo. Só gestor lê.
create table if not exists ia_falhas (
  id uuid primary key default gen_random_uuid(),
  funcao text not null,
  usuario_id uuid references auth.users(id) on delete set null,
  empresa text,
  mensagem text not null,
  detalhe jsonb,
  criado_em timestamptz not null default now()
);

alter table ia_falhas enable row level security;

create policy ia_falhas_gestor_le on ia_falhas
  for select
  using (meu_cargo() = any (array['Gestor', 'Diretor']));

create index if not exists idx_ia_falhas_recentes on ia_falhas (criado_em desc);
