BEGIN;

ALTER TABLE public.organization_public_profiles
  ADD COLUMN IF NOT EXISTS admin_removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_removed_by uuid,
  ADD COLUMN IF NOT EXISTS admin_removal_reason text;

ALTER TABLE public.contatos
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'site',
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS solicitante_id uuid,
  ADD COLUMN IF NOT EXISTS ferramenta text,
  ADD COLUMN IF NOT EXISTS plano_codigo text,
  ADD COLUMN IF NOT EXISTS plano_nome text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_public_profiles_admin_removed_by_fkey' AND conrelid = 'public.organization_public_profiles'::regclass) THEN
    ALTER TABLE public.organization_public_profiles
      ADD CONSTRAINT organization_public_profiles_admin_removed_by_fkey
      FOREIGN KEY (admin_removed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contatos_origem_check' AND conrelid = 'public.contatos'::regclass) THEN
    ALTER TABLE public.contatos
      ADD CONSTRAINT contatos_origem_check
      CHECK (origem IN ('site', 'acesso_prestador'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contatos_plano_codigo_check' AND conrelid = 'public.contatos'::regclass) THEN
    ALTER TABLE public.contatos
      ADD CONSTRAINT contatos_plano_codigo_check
      CHECK (plano_codigo IS NULL OR plano_codigo IN ('free', 'basic', 'professional', 'enterprise'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contatos_organization_id_fkey' AND conrelid = 'public.contatos'::regclass) THEN
    ALTER TABLE public.contatos
      ADD CONSTRAINT contatos_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contatos_solicitante_id_fkey' AND conrelid = 'public.contatos'::regclass) THEN
    ALTER TABLE public.contatos
      ADD CONSTRAINT contatos_solicitante_id_fkey
      FOREIGN KEY (solicitante_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS contatos_support_grouping_idx
  ON public.contatos (origem, plano_codigo, ferramenta, criado_em DESC);

COMMIT;
