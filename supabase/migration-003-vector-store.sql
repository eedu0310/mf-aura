-- ============================================================
-- ADIÇÃO: suporte a documentos indexados (File Search da OpenAI)
-- ============================================================
-- Execute apenas este arquivo no SQL Editor do Supabase.
-- ============================================================

alter table public.playbook
  add column if not exists vector_store_id text;
