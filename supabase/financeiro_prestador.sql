-- Execute no Supabase de teste antes de usar /sistema/financeiro.
-- As tabelas são acessadas pelo backend com service_role após validar o proprietário.

CREATE TABLE IF NOT EXISTS public.organization_service_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  service_name text NOT NULL CHECK (char_length(btrim(service_name)) BETWEEN 2 AND 200),
  service_date date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL DEFAULT 'outros'
    CHECK (source IN ('vallex', 'indicacao', 'redes_sociais', 'busca_web', 'recorrente', 'outros')),
  amount_charged numeric(12,2) NOT NULL CHECK (amount_charged > 0),
  amount_received numeric(12,2) NOT NULL DEFAULT 0
    CHECK (amount_received >= 0 AND amount_received <= amount_charged),
  direct_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (direct_cost >= 0),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_service_records_org_date_idx
  ON public.organization_service_records (organization_id, service_date DESC);
CREATE INDEX IF NOT EXISTS organization_service_records_customer_idx
  ON public.organization_service_records (customer_id);
CREATE INDEX IF NOT EXISTS organization_service_records_source_idx
  ON public.organization_service_records (organization_id, source);

CREATE TABLE IF NOT EXISTS public.organization_business_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 2 AND 200),
  category text NOT NULL CHECK (char_length(btrim(category)) BETWEEN 2 AND 80),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_status text NOT NULL DEFAULT 'pago' CHECK (payment_status IN ('pago', 'pendente')),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organization_business_expenses_org_date_idx
  ON public.organization_business_expenses (organization_id, expense_date DESC);

ALTER TABLE public.organization_service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_business_expenses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.organization_service_records FROM anon, authenticated;
REVOKE ALL ON TABLE public.organization_business_expenses FROM anon, authenticated;
GRANT ALL ON TABLE public.organization_service_records TO service_role;
GRANT ALL ON TABLE public.organization_business_expenses TO service_role;
