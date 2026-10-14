-- Execute depois de financeiro_prestador.sql.
-- Adiciona vencimentos e recorrência mensal às despesas do negócio.

ALTER TABLE public.organization_business_expenses
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS expense_type text NOT NULL DEFAULT 'avulsa',
  ADD COLUMN IF NOT EXISTS recurrence_group_id uuid;

UPDATE public.organization_business_expenses
SET due_date = expense_date
WHERE due_date IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_business_expenses_type_check'
      AND conrelid = 'public.organization_business_expenses'::regclass
  ) THEN
    ALTER TABLE public.organization_business_expenses
      ADD CONSTRAINT organization_business_expenses_type_check
      CHECK (expense_type IN ('avulsa', 'fixa_mensal'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS organization_business_expenses_org_due_idx
  ON public.organization_business_expenses (organization_id, due_date DESC);

CREATE INDEX IF NOT EXISTS organization_business_expenses_recurrence_idx
  ON public.organization_business_expenses (recurrence_group_id, due_date)
  WHERE recurrence_group_id IS NOT NULL;

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
      COALESCE(sum(amount) FILTER (WHERE COALESCE(due_date, expense_date) <= CURRENT_DATE), 0) AS expenses,
      COALESCE(sum(amount) FILTER (WHERE payment_status = 'pago' AND expense_date <= CURRENT_DATE), 0) AS paid
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
