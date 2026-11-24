-- 20261002132251 059_descartar_lead_que_nao_e_lead

-- Poder dizer que um lead nao e lead.
--
-- O QUE EU ENCONTREI: dos seis leads sem carteira, CINCO eram a propria
-- equipe entrando como lead do Charles - "Elton Eduardo", "Alexandre",
-- "Jeferson Sole - Bento Goncalves", "Alexsander Reis - Vendedor LF Lareiras".
-- O dono da empresa e o gestor geral figurando como lead a ser trabalhado.
--
-- E nao havia como arrumar: o campo status so aceita quatro valores e nenhum
-- significa "descartado"; a classificacao esta nula nos 71 registros. Entao
-- esses nomes contam como lead na meta, no funil e no relatorio do gestor, e a
-- unica forma de limpar seria apagar o registro - perdendo o historico.
--
-- Mesmo vocabulario do WhatsApp (migration 047), de proposito: um contato e a
-- mesma coisa venha ele da conversa ou da campanha, e duas palavras
-- diferentes para a mesma ideia viram duas regras divergentes com o tempo.
alter table public.leads_recebidos
  add column if not exists natureza text,
  add column if not exists motivo_natureza text,
  add column if not exists descartado_em timestamptz,
  add column if not exists descartado_por uuid references public.profiles(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_recebidos_natureza_valida') then
    alter table public.leads_recebidos
      add constraint leads_recebidos_natureza_valida
      check (natureza is null or natureza in ('lead', 'nao_lead', 'cliente'));
  end if;
end $$;

create index if not exists leads_recebidos_natureza_idx
  on public.leads_recebidos (empresa, natureza);

-- A equipe nao e lead da equipe. Marco apenas quem bate com um perfil ATIVO
-- do sistema pelo primeiro nome - criterio verificavel, nao o meu palpite
-- sobre quem e quem. Fica registrado o motivo, e um clique desfaz.
update public.leads_recebidos l
   set natureza = 'nao_lead',
       motivo_natureza = 'Colega de equipe',
       descartado_em = now()
 where l.natureza is null
   and exists (
     select 1 from public.profiles p
     where p.ativo is not false
       and length(split_part(p.nome, ' ', 1)) >= 5
       and l.nome ilike split_part(p.nome, ' ', 1) || '%'
   );
