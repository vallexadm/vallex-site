-- Execute depois de financeiro_prestador.sql e financeiro_recebimentos_parcelados.sql.
-- Guarda vencimentos futuros e detalha os custos diretos por serviço.

CREATE TABLE IF NOT EXISTS public.organization_service_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_record_id uuid NOT NULL REFERENCES public.organization_service_records(id) ON DELETE CASCADE,
  installment_number integer NOT NULL CHECK (installment_number BETWEEN 1 AND 24),
  due_date date NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_record_id, installment_number)
);

CREATE INDEX IF NOT EXISTS organization_service_installments_org_due_idx
  ON public.organization_service_installments (organization_id, due_date);

CREATE TABLE IF NOT EXISTS public.organization_service_cost_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_record_id uuid NOT NULL REFERENCES public.organization_service_records(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN (
    'materiais_insumos', 'taxas_cartorio', 'transporte', 'ferramentas_equipamentos',
    'terceirizados', 'alimentacao_hospedagem', 'outros'
  )),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 2 AND 200),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_service_cost_items_service_idx
  ON public.organization_service_cost_items (service_record_id);

-- Preserve the single direct-cost value entered before itemization was available.
INSERT INTO public.organization_service_cost_items (
  organization_id, service_record_id, category, description, amount
)
SELECT s.organization_id, s.id, 'outros', 'Custo direto registrado anteriormente', s.direct_cost
FROM public.organization_service_records s
WHERE s.direct_cost > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_service_cost_items c
    WHERE c.service_record_id = s.id
  );

ALTER TABLE public.organization_service_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_service_cost_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.organization_service_installments FROM anon, authenticated;
REVOKE ALL ON TABLE public.organization_service_cost_items FROM anon, authenticated;
GRANT ALL ON TABLE public.organization_service_installments TO service_role;
GRANT ALL ON TABLE public.organization_service_cost_items TO service_role;

-- Installment number 0 identifies an upfront payment; future installments remain 1–24.
ALTER TABLE public.organization_service_payments
  DROP CONSTRAINT IF EXISTS organization_service_payments_installment_number_check;
ALTER TABLE public.organization_service_payments
  ADD CONSTRAINT organization_service_payments_installment_number_check
  CHECK (installment_number BETWEEN 0 AND 24);

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
  v_scheduled_amount numeric(12,2);
  v_installment_received numeric(12,2);
BEGIN
  SELECT * INTO v_service
  FROM public.organization_service_records
  WHERE id = p_service_record_id
    AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'SERVICE_NOT_FOUND'; END IF;
  IF p_installments_total < 1 OR p_installments_total > 24
     OR p_installment_number < 0 OR p_installment_number > p_installments_total THEN
    RAISE EXCEPTION 'INVALID_INSTALLMENT';
  END IF;
  IF p_payment_method IS NULL OR p_payment_method NOT IN
     ('pix', 'transferencia', 'dinheiro', 'cartao_credito', 'cartao_debito', 'boleto', 'outro') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR v_service.amount_received + p_amount > v_service.amount_charged THEN
    RAISE EXCEPTION 'PAYMENT_EXCEEDS_BALANCE';
  END IF;
  IF p_installment_number > 0 THEN
    SELECT amount INTO v_scheduled_amount
    FROM public.organization_service_installments
    WHERE service_record_id = p_service_record_id
      AND installment_number = p_installment_number;
    IF FOUND THEN
      SELECT COALESCE(sum(amount), 0) INTO v_installment_received
      FROM public.organization_service_payments
      WHERE service_record_id = p_service_record_id
        AND installment_number = p_installment_number;
      IF v_installment_received + p_amount > v_scheduled_amount THEN
        RAISE EXCEPTION 'PAYMENT_EXCEEDS_INSTALLMENT';
      END IF;
    END IF;
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

CREATE OR REPLACE FUNCTION public.get_organization_finance_indicators(p_organization_id uuid)
RETURNS TABLE (
  total_charged numeric,
  total_received numeric,
  direct_costs numeric,
  total_expenses numeric,
  paid_expenses numeric,
  cash_balance numeric,
  estimated_profit numeric,
  profit_margin numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH service_totals AS (
    SELECT
      COALESCE(sum(amount_charged), 0) AS charged,
      COALESCE(sum(amount_received), 0) AS received,
      COALESCE(sum(direct_cost), 0) AS costs
    FROM public.organization_service_records
    WHERE organization_id = p_organization_id
  ), expense_totals AS (
    SELECT
      COALESCE(sum(amount), 0) AS expenses,
      COALESCE(sum(amount) FILTER (WHERE payment_status = 'pago'), 0) AS paid
    FROM public.organization_business_expenses
    WHERE organization_id = p_organization_id
  )
  SELECT
    s.charged,
    s.received,
    s.costs,
    e.expenses,
    e.paid,
    s.received - s.costs - e.paid,
    s.charged - s.costs - e.expenses,
    CASE WHEN s.charged > 0 THEN ((s.charged - s.costs - e.expenses) / s.charged) * 100 ELSE 0 END
  FROM service_totals s CROSS JOIN expense_totals e;
$$;

REVOKE ALL ON FUNCTION public.get_organization_finance_indicators(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_organization_finance_indicators(uuid) TO service_role;
