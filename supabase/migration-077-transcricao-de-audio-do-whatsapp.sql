-- Cache das transcrições de áudio do WhatsApp.
--
-- A mesma conversa é reanalisada cerca de cinco vezes por semana. Sem cache,
-- o mesmo áudio seria mandado ao Whisper a cada análise e pagaríamos cinco
-- vezes pelo mesmo minuto. A chave é o id da mensagem do WhatsApp, que não
-- muda: transcreveu uma vez, vale para sempre.
create table if not exists public.whatsapp_transcricoes (
  msg_id text primary key,
  owner_id uuid references auth.users(id) on delete cascade,
  empresa text,
  chat_jid text,
  texto text not null,
  bytes integer,
  criado_em timestamptz not null default now()
);

create index if not exists whatsapp_transcricoes_owner_idx
  on public.whatsapp_transcricoes (owner_id, criado_em desc);

alter table public.whatsapp_transcricoes enable row level security;

-- Quem vê a transcrição é quem vê a conversa: o dono, o parceiro do
-- atendimento em dupla e o gestor aprovado da loja. Mesma régua do resto.
create policy "Transcricao: dono, parceiro e gestor da loja"
  on public.whatsapp_transcricoes for select
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1 from public.whatsapp_ia_leads l
      where l.chat_jid = whatsapp_transcricoes.chat_jid
        and l.owner_id = whatsapp_transcricoes.owner_id
        and l.parceiro_id = (select auth.uid())
    )
    or (vejo_a_loja_toda() and empresa = minha_empresa())
    or pode_ver_todas_empresas()
  );

comment on table public.whatsapp_transcricoes is
  'Texto dos áudios do WhatsApp, transcritos uma única vez por mensagem. Sem isto a AURA lê a conversa com buracos e culpa o vendedor por etapas que aconteceram dentro do áudio.';
