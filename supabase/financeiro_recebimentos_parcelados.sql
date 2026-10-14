-- Execute depois de financeiro_prestador.sql no Supabase de teste.
-- Registra cada recebimento individualmente, incluindo parcelas e meio de pagamento.

ALTER TABLE public.organization_service_records
  ADD COLUMN IF NOT EXISTS installments_total integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_service_records_installments_total_check'
      AND conrelid = 'public.organization_service_records'::regclass
  ) THEN
    ALTER TABLE public.organization_service_records
      ADD CONSTRAINT organization_service_records_installments_total_check
      CHECK (installments_total BETWEEN 1 AND 24);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.organization_service_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_record_id uuid NOT NULL REFERENCES public.organization_service_records(id) ON DELETE CASCADE,
  installment_number integer NOT NULL CHECK (installment_number BETWEEN 1 AND 24),
  payment_method text NOT NULL
    CHECK (payment_method IN ('pix', 'transferencia', 'dinheiro', 'cartao_credito', 'cartao_debito', 'boleto', 'outro')),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_service_payments_service_idx
  ON public.organization_service_payments (service_record_id, installment_number, payment_date);
CREATE INDEX IF NOT EXISTS organization_service_payments_org_date_idx
  ON public.organization_service_payments (organization_id, payment_date DESC);

-- Preserve receipts entered before this migration so the history stays complete.
INSERT INTO public.organization_service_payments (
  organization_id, service_record_id, installment_number, payment_method,
  payment_date, amount, created_by
)
SELECT s.organization_id, s.id, 1, 'outro', s.service_date,
       s.amount_received, s.created_by
FROM public.organization_service_records s
WHERE s.amount_received > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_service_payments p
    WHERE p.service_record_id = s.id
  );

ALTER TABLE public.organization_service_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.organization_service_payments FROM anon, authenticated;
GRANT ALL ON TABLE public.organization_service_payments TO service_role;

CREATE OR REPLACE FUNCTION public.record_organization_service_payment(
  p_organization_id uuid,
  p_service_record_id uuid,
  p_installment_number integer,
  p_installments_total integer,
  p_payment_method text,
  p_payment_date date,
  p_amount numeric,
  p_created_by uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service public.organization_service_records%ROWTYPE;
  v_payment_id uuid;
BEGIN
  SELECT * INTO v_service
  FROM public.organization_service_records
  WHERE id = p_service_record_id
    AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND';
  END IF;
  IF p_installments_total < 1 OR p_installments_total > 24
     OR p_installment_number < 1
     OR p_installment_number > p_installments_total THEN
    RAISE EXCEPTION 'INVALID_INSTALLMENT';
  END IF;
  IF p_payment_method NOT IN ('pix', 'transferencia', 'dinheiro', 'cartao_credito', 'cartao_debito', 'boleto', 'outro') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD';
  END IF;
  IF p_amount <= 0 OR v_service.amount_received + p_amount > v_service.amount_charged THEN
    RAISE EXCEPTION 'PAYMENT_EXCEEDS_BALANCE';
  END IF;

  INSERT INTO public.organization_service_payments (
    organization_id, service_record_id, installment_number, payment_method,
    payment_date, amount, created_by
  ) VALUES (
    p_organization_id, p_service_record_id, p_installment_number, p_payment_method,
    p_payment_date, p_amount, p_created_by
  ) RETURNING id INTO v_payment_id;

  UPDATE public.organization_service_records
  SET amount_received = amount_received + p_amount,
      installments_total = p_installments_total,
      updated_at = now()
  WHERE id = p_service_record_id;

  RETURN v_payment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_organization_service_payment(uuid, uuid, integer, integer, text, date, numeric, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_organization_service_payment(uuid, uuid, integer, integer, text, date, numeric, uuid) TO service_role;
