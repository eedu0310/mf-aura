-- Instagram, etapas 2 e 3.
--
-- Etapa 2 (responder como no Meta Business Suite): quem mandou cada mensagem
-- (vendedor ou agente de IA), reação de cada lado e mídia enviada pelo AURA.
-- Comentário ganha resposta privada (vira direct) e apagado.
--
-- Etapa 3 (agente de IA): a configuração por loja, no mesmo espírito do chat
-- do site: liga/desliga, quantas horas esperar o vendedor, horário da loja,
-- se responde na hora fora do horário e instruções extras do gestor.
--
-- Tudo aqui é lido e escrito só pelo servidor (chave de serviço). A RLS fica
-- ligada sem política: nenhum usuário logado lê direto pelo navegador.

alter table public.meta_mensagens
  add column if not exists por_ia boolean not null default false,
  add column if not exists autor_id uuid,
  add column if not exists reacao text,          -- reação da loja (❤️)
  add column if not exists reacao_cliente text;  -- reação do cliente

alter table public.meta_conversas
  add column if not exists ia_respondeu_em timestamptz,
  add column if not exists ia_pausada boolean not null default false;

alter table public.meta_comentarios
  add column if not exists resposta_privada boolean not null default false,
  add column if not exists apagado boolean not null default false,
  add column if not exists respondido_por_ia boolean not null default false;

create table if not exists public.meta_ia_config (
  empresa text primary key,
  ativa boolean not null default false,
  -- Depois de quantas horas sem o vendedor responder o agente entra.
  esperar_horas numeric not null default 2 check (esperar_horas >= 0.25 and esperar_horas <= 20),
  -- Fora do horário da loja responde na hora, sem esperar.
  fora_do_horario boolean not null default true,
  horario jsonb not null default '{}'::jsonb,
  -- Comentário sem resposta: o agente responde em público, curto, chamando para o direct.
  responder_comentarios boolean not null default false,
  instrucoes text not null default '',
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);

alter table public.meta_ia_config enable row level security;
revoke all on public.meta_ia_config from anon, authenticated;

create index if not exists meta_conversas_ia_idx
  on public.meta_conversas (empresa, responde_ate)
  where ignorado = false;

-- Fotos e áudios que o vendedor manda pelo AURA. A Meta busca o arquivo por
-- um endereço público, então o bucket é público (o nome do arquivo é um uuid).
insert into storage.buckets (id, name, public, file_size_limit)
values ('instagram', 'instagram', true, 26214400)
on conflict (id) do nothing;
