-- 20260924112520 agenda_completa_e_calendario_do_celular

-- Agenda mais completa: duração, local, observação e vínculo com o cliente.
ALTER TABLE public.compromissos
  ADD COLUMN IF NOT EXISTS duracao_minutos integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS local text,
  ADD COLUMN IF NOT EXISTS observacao text,
  ADD COLUMN IF NOT EXISTS relacionamento_id uuid REFERENCES public.relacionamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now();

-- Cada pessoa ganha um endereço secreto de calendário, para assinar no
-- Google Agenda ou no calendário do iPhone e ver os compromissos no celular.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agenda_token uuid;

UPDATE public.profiles SET agenda_token = gen_random_uuid() WHERE agenda_token IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN agenda_token SET DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS profiles_agenda_token_idx ON public.profiles (agenda_token);

CREATE INDEX IF NOT EXISTS compromissos_owner_data_idx ON public.compromissos (owner_id, data);
