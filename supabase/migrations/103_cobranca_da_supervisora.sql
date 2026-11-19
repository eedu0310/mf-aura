-- 103 · Cobrança diária da supervisora, com a justificativa do vendedor (19/11/2026)
--
-- Toda manhã (rota /api/cron/cobranca-supervisora), quem vende e está zerado
-- no mês em oportunidade criada, fechamento, atividade registrada ou
-- relacionamento cadastrado recebe a cobrança e responde por quê. O gestor
-- da loja lê as respostas no painel.
--
-- Escrita só pelo servidor (chave de serviço) e pela função de resposta
-- abaixo; o vendedor não edita a cobrança, só responde a dele.

begin;

create table if not exists public.aura_cobrancas (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references public.profiles(id) on delete cascade,
  empresa text,
  -- Dia da cobrança, em Brasília. Uma por pessoa por dia.
  dia date not null,
  -- [{ "chave": "sem_oportunidade", "texto": "Nenhuma oportunidade criada no Pipeline este mês." }, ...]
  itens jsonb not null default '[]'::jsonb,
  -- Frase de contexto, por exemplo quantas conversas de WhatsApp ele teve no mês.
  contexto text,
  -- { "sem_oportunidade": "porque...", ... }
  resposta jsonb,
  respondida_em timestamptz,
  criada_em timestamptz not null default now(),
  unique (vendedor_id, dia)
);

create index if not exists aura_cobrancas_empresa_dia on public.aura_cobrancas (empresa, dia desc);

alter table public.aura_cobrancas enable row level security;

drop policy if exists "Ver cobranças conforme papel" on public.aura_cobrancas;
create policy "Ver cobranças conforme papel" on public.aura_cobrancas
  for select using (
    vendedor_id = (select auth.uid())
    or pode_ver_todas_empresas()
    or (vejo_a_loja_toda() and empresa = minha_empresa())
  );

-- O vendedor responde a própria cobrança (e pode corrigir a resposta).
create or replace function public.aura_responder_cobranca(p_id uuid, p_resposta jsonb)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if p_resposta is null or jsonb_typeof(p_resposta) <> 'object' then
    raise exception 'Resposta inválida.';
  end if;
  update public.aura_cobrancas
     set resposta = p_resposta, respondida_em = now()
   where id = p_id
     and vendedor_id = auth.uid();
  return found;
end;
$function$;

revoke all on function public.aura_responder_cobranca(uuid, jsonb) from public;
-- O Supabase dá execução ao anon por padrão; aqui só quem está logado.
revoke execute on function public.aura_responder_cobranca(uuid, jsonb) from anon;
grant execute on function public.aura_responder_cobranca(uuid, jsonb) to authenticated;

commit;
