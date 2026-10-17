-- Atribui um código permanente a cada cobrança (serviço), compartilhado por todas as parcelas.
-- Execute no Supabase SQL Editor depois das migrações de edição/histórico financeiro.
CREATE SEQUENCE IF NOT EXISTS public.organization_service_charge_code_seq;
GRANT USAGE, SELECT ON SEQUENCE public.organization_service_charge_code_seq TO service_role, authenticated;

ALTER TABLE public.organization_service_records
  ADD COLUMN IF NOT EXISTS charge_code text;

UPDATE public.organization_service_records
SET charge_code = 'VAL-COB-' || lpad(nextval('public.organization_service_charge_code_seq')::text, 8, '0')
WHERE charge_code IS NULL OR btrim(charge_code) = '';

ALTER TABLE public.organization_service_records
  ALTER COLUMN charge_code SET DEFAULT ('VAL-COB-' || lpad(nextval('public.organization_service_charge_code_seq')::text, 8, '0')),
  ALTER COLUMN charge_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organization_service_records_charge_code_uidx
  ON public.organization_service_records (charge_code);
