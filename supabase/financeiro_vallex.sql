-- Livro financeiro exclusivo da VALLEX. Não utiliza tabelas financeiras dos prestadores.
-- Aplicar no Supabase de teste antes de abrir /admin/financeiro.

BEGIN;

CREATE TABLE IF NOT EXISTS public.vallex_finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type text NOT NULL CHECK (entry_type IN ('income', 'expense')),
  category text NOT NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'canceled')),
  payment_method text NOT NULL DEFAULT 'outro',
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'asaas')),
  asaas_transaction_id text,
  source_description text,
  asaas_type text,
  sales_client_id uuid,
  notes text,
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vallex_finance_entries_date_idx ON public.vallex_finance_entries (entry_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS vallex_finance_entries_status_idx ON public.vallex_finance_entries (status, due_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS vallex_finance_entries_sales_idx ON public.vallex_finance_entries (sales_client_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS vallex_finance_entries_asaas_id_idx ON public.vallex_finance_entries (asaas_transaction_id);

ALTER TABLE public.vallex_finance_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vallex_finance_entries FROM anon, authenticated;
GRANT ALL ON public.vallex_finance_entries TO service_role;

COMMENT ON TABLE public.vallex_finance_entries IS 'Despesas e recebimentos registrados manualmente pela administração financeira da VALLEX. As movimentações Asaas são consultadas diretamente no extrato.';

COMMIT;
