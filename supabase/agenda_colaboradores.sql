-- Execute no projeto Supabase de teste antes de usar /sistema/agenda.
-- A API usa a chave de serviço após validar o usuário e suas permissões.

CREATE TABLE IF NOT EXISTS public.organization_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  assigned_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  details text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_appointments_end_after_start
    CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS organization_appointments_org_start_idx
  ON public.organization_appointments (organization_id, starts_at);

CREATE INDEX IF NOT EXISTS organization_appointments_assignee_start_idx
  ON public.organization_appointments (assigned_to, starts_at);

ALTER TABLE public.organization_appointments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.organization_appointments FROM anon, authenticated;
GRANT ALL ON TABLE public.organization_appointments TO service_role;
