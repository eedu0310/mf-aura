-- 20260924114304 telefone_no_perfil

-- A tela de perfil mostrava um telefone fixo no código, igual para todo mundo.
-- Agora cada pessoa guarda o seu.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefone text;
