-- Execute depois de financeiro_filtros_contas_pagar.sql.
-- Classificação gerencial das despesas e vínculo opcional ao tipo de imóvel.

ALTER TABLE public.organization_business_expenses
  ADD COLUMN IF NOT EXISTS classification text NOT NULL DEFAULT 'despesa_variavel',
  ADD COLUMN IF NOT EXISTS property_type text NOT NULL DEFAULT 'nao_aplica';

UPDATE public.organization_business_expenses
SET classification = 'despesa_fixa'
WHERE expense_type = 'fixa_mensal' AND classification = 'despesa_variavel';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_business_expenses_classification_check'
      AND conrelid = 'public.organization_business_expenses'::regclass
  ) THEN
    ALTER TABLE public.organization_business_expenses
      ADD CONSTRAINT organization_business_expenses_classification_check
      CHECK (classification IN (
        'despesa_fixa',
        'despesa_variavel',
        'operacional',
        'pessoal',
        'comercial_marketing',
        'nao_operacional',
        'financeira'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_business_expenses_property_type_check'
      AND conrelid = 'public.organization_business_expenses'::regclass
  ) THEN
    ALTER TABLE public.organization_business_expenses
      ADD CONSTRAINT organization_business_expenses_property_type_check
      CHECK (property_type IN ('alugado', 'proprio', 'nao_aplica'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS organization_business_expenses_org_classification_idx
  ON public.organization_business_expenses (organization_id, classification, expense_date DESC);
