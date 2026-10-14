-- Adds organization-scoped contact details for each invited collaborator.
-- Apply this migration to the test Supabase project before creating invitations
-- through the updated application.

ALTER TABLE public.organization_invitations
  ADD COLUMN IF NOT EXISTS invitee_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_invitations_invitee_name_check'
      AND conrelid = 'public.organization_invitations'::regclass
  ) THEN
    ALTER TABLE public.organization_invitations
      ADD CONSTRAINT organization_invitations_invitee_name_check
      CHECK (invitee_name IS NULL OR char_length(btrim(invitee_name)) BETWEEN 2 AND 120);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_invitations_contact_phone_check'
      AND conrelid = 'public.organization_invitations'::regclass
  ) THEN
    ALTER TABLE public.organization_invitations
      ADD CONSTRAINT organization_invitations_contact_phone_check
      CHECK (contact_phone IS NULL OR char_length(btrim(contact_phone)) BETWEEN 8 AND 40);
  END IF;
END
$$;
