-- Execute no Supabase SQL Editor para habilitar os custos privados nos orçamentos.
-- Os valores já cadastrados são preservados como valor do serviço.

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS valor_servico numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custos_internos jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.orcamentos
SET valor_servico = valor
WHERE valor_servico = 0 AND valor > 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orcamentos_custos_internos_array_check'
      AND conrelid = 'public.orcamentos'::regclass
  ) THEN
    ALTER TABLE public.orcamentos
      ADD CONSTRAINT orcamentos_custos_internos_array_check
      CHECK (jsonb_typeof(custos_internos) = 'array');
  END IF;
END $$;
