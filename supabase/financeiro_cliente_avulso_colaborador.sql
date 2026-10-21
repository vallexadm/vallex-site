-- Aplicar primeiro no VALLEX-Teste. Nao altera cobrancas ou despesas existentes.
BEGIN;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_walk_in boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS customers_one_walk_in_per_org
  ON public.customers(organization_id) WHERE is_walk_in;

CREATE OR REPLACE FUNCTION public.get_or_create_walk_in_customer(p_organization_id uuid)
RETURNS SETOF public.customers LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  INSERT INTO public.customers(organization_id,name,status,is_walk_in,notes)
  VALUES(p_organization_id,'Cliente avulso','ativo',true,'Cadastro para cobrancas pontuais sem identificacao individual.')
  ON CONFLICT(organization_id) WHERE is_walk_in DO UPDATE SET status='ativo'
  RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.get_or_create_walk_in_customer(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_walk_in_customer(uuid) TO service_role;

ALTER TABLE public.organization_business_expenses
  ADD COLUMN IF NOT EXISTS collaborator_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS collaborator_name text;
CREATE INDEX IF NOT EXISTS organization_expenses_collaborator_idx
  ON public.organization_business_expenses(organization_id,collaborator_user_id)
  WHERE collaborator_user_id IS NOT NULL;
COMMIT;
