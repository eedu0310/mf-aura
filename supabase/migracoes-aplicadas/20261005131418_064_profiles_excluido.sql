-- 20261005131418 064_profiles_excluido

alter table public.profiles
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por uuid,
  add column if not exists excluido_motivo text;
