-- 20260924123212 controle_de_custo_da_ia

-- Controle de custo da IA: o gestor acompanha o consumo, registra os
-- depósitos e é avisado antes do saldo acabar.

CREATE TABLE IF NOT EXISTS public.ia_uso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa text,
  usuario_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  funcao text NOT NULL,                 -- coach, insights, relatorio, whatsapp...
  modelo text NOT NULL,
  tokens_entrada integer NOT NULL DEFAULT 0,
  tokens_saida integer NOT NULL DEFAULT 0,
  custo_usd numeric(12,6) NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ia_uso_criado_em_idx ON public.ia_uso (criado_em DESC);
CREATE INDEX IF NOT EXISTS ia_uso_funcao_idx ON public.ia_uso (funcao);

CREATE TABLE IF NOT EXISTS public.ia_creditos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  valor_usd numeric(12,2) NOT NULL,
  descricao text,
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Preços por milhão de tokens e limite de alerta. Editáveis pelo gestor,
-- porque cada contrato pode ter valores diferentes.
CREATE TABLE IF NOT EXISTS public.ia_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  preco_entrada_usd numeric(10,4) NOT NULL DEFAULT 2,
  preco_saida_usd numeric(10,4) NOT NULL DEFAULT 10,
  alerta_saldo_usd numeric(10,2) NOT NULL DEFAULT 10,
  bloquear_sem_saldo boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.ia_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ia_uso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_creditos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_config ENABLE ROW LEVEL SECURITY;

-- Só o gestor enxerga e mexe. Quem grava o consumo é o servidor, com a
-- chave de serviço, que passa por cima destas regras.
CREATE POLICY "Gestor vê o consumo da IA" ON public.ia_uso
  FOR SELECT TO authenticated USING (public.meu_cargo() = 'Gestor');

CREATE POLICY "Gestor gerencia os créditos da IA" ON public.ia_creditos
  FOR ALL TO authenticated
  USING (public.meu_cargo() = 'Gestor') WITH CHECK (public.meu_cargo() = 'Gestor');

CREATE POLICY "Gestor ajusta a configuração da IA" ON public.ia_config
  FOR ALL TO authenticated
  USING (public.meu_cargo() = 'Gestor') WITH CHECK (public.meu_cargo() = 'Gestor');
