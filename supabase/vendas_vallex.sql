-- Estrutura administrativa de vendas da VALLEX.
-- Execute no Supabase de teste antes de usar /admin/vendas.
-- Acesso às tabelas ocorre somente pela API administrativa com service role.

BEGIN;

CREATE TABLE IF NOT EXISTS public.vallex_sales_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name text NOT NULL,
  company_name text,
  email text,
  phone text,
  niche text,
  city text,
  state text,
  product text NOT NULL,
  product_scope text,
  stage text NOT NULL DEFAULT 'novo',
  contract_start_date date,
  contract_end_date date,
  source text NOT NULL DEFAULT 'prospeccao',
  responsible_name text,
  setup_value numeric(12,2),
  monthly_value numeric(12,2),
  notes text,
  created_by uuid,
  updated_by uuid,
  archived_at timestamptz,
  archived_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vallex_sales_clients_product_check CHECK (product IN ('trafego_pago', 'servicofacil', 'site_institucional', 'desenvolvimento_web', 'planilha_automatizada', 'consultoria', 'outro')),
  CONSTRAINT vallex_sales_clients_stage_check CHECK (stage IN ('novo', 'contato', 'qualificacao', 'proposta', 'aguardando_decisao', 'negociacao', 'ganho', 'perdido')),
  CONSTRAINT vallex_sales_clients_values_check CHECK ((setup_value IS NULL OR setup_value >= 0) AND (monthly_value IS NULL OR monthly_value >= 0)),
  CONSTRAINT vallex_sales_clients_contract_dates_check CHECK (contract_start_date IS NULL OR contract_end_date IS NULL OR contract_end_date >= contract_start_date)
);

CREATE TABLE IF NOT EXISTS public.vallex_sales_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.vallex_sales_clients(id) ON DELETE CASCADE,
  actor_user_id uuid,
  actor_name text NOT NULL DEFAULT 'Administração VALLEX',
  event_type text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vallex_sales_clients_stage_idx ON public.vallex_sales_clients (stage, updated_at DESC);
CREATE INDEX IF NOT EXISTS vallex_sales_clients_product_idx ON public.vallex_sales_clients (product, created_at DESC);
CREATE INDEX IF NOT EXISTS vallex_sales_clients_archived_idx ON public.vallex_sales_clients (archived_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS vallex_sales_activity_client_idx ON public.vallex_sales_activity (client_id, created_at DESC);

ALTER TABLE public.vallex_sales_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vallex_sales_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vallex_sales_clients, public.vallex_sales_activity FROM anon, authenticated;
GRANT ALL ON public.vallex_sales_clients, public.vallex_sales_activity TO service_role;

COMMIT;
