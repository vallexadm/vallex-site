-- Aplicar primeiro em homologacao, depois de backup e revisao de conflitos antigos.
-- Nao altera horarios, clientes ou situacoes de registros existentes.
BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

ALTER TABLE public.organization_appointments
  ADD COLUMN IF NOT EXISTS buffer_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS change_reason text CHECK(char_length(change_reason) <= 500),
  ADD COLUMN IF NOT EXISTS arrival_estimate_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.organization_appointments DROP CONSTRAINT IF EXISTS organization_appointments_status_check;
ALTER TABLE public.organization_appointments ADD CONSTRAINT organization_appointments_status_check
  CHECK (status IN ('scheduled','on_way','arrived','in_progress','completed','cancelled','no_show'));
ALTER TABLE public.organization_appointments DROP CONSTRAINT IF EXISTS appointments_buffer_valid;
ALTER TABLE public.organization_appointments ADD CONSTRAINT appointments_buffer_valid CHECK(buffer_minutes BETWEEN 0 AND 240);

-- Fim ausente em registros antigos ocupa 60 minutos. Intervalos sao [inicio,fim),
-- incluindo a margem posterior; horarios adjacentes sem margem sao permitidos.
-- A exclusao vale por profissional, inclusive em organizacoes diferentes.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM public.organization_appointments a JOIN public.organization_appointments b
    ON a.assigned_to=b.assigned_to AND a.id<b.id
    WHERE a.status IN ('scheduled','on_way','arrived','in_progress')
      AND b.status IN ('scheduled','on_way','arrived','in_progress')
      AND tsrange(a.starts_at AT TIME ZONE 'UTC', COALESCE(a.ends_at AT TIME ZONE 'UTC', (a.starts_at AT TIME ZONE 'UTC')+interval '1 hour')+a.buffer_minutes*interval '1 minute','[)')
       && tsrange(b.starts_at AT TIME ZONE 'UTC', COALESCE(b.ends_at AT TIME ZONE 'UTC', (b.starts_at AT TIME ZONE 'UTC')+interval '1 hour')+b.buffer_minutes*interval '1 minute','[)')
  ) THEN RAISE EXCEPTION 'AGENDA_EXISTING_CONFLICTS: revise sobreposicoes antes de aplicar; nenhum horario foi alterado'; END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.organization_appointments'::regclass AND conname='appointments_no_overlap') THEN
  ALTER TABLE public.organization_appointments ADD CONSTRAINT appointments_no_overlap EXCLUDE USING gist (
    assigned_to WITH =,
    tsrange(starts_at AT TIME ZONE 'UTC', COALESCE(ends_at AT TIME ZONE 'UTC', (starts_at AT TIME ZONE 'UTC')+interval '1 hour')+buffer_minutes*interval '1 minute','[)') WITH &&
  ) WHERE (status IN ('scheduled','on_way','arrived','in_progress'));
 END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.organization_appointment_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 appointment_id uuid NOT NULL REFERENCES public.organization_appointments(id),
 actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 before_data jsonb, after_data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appointment_history_lookup ON public.organization_appointment_history(appointment_id,created_at DESC);
ALTER TABLE public.organization_appointment_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organization_appointment_history FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.organization_appointment_history TO service_role;
CREATE OR REPLACE FUNCTION public.version_appointment_change() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.revision := OLD.revision+1; NEW.updated_at := clock_timestamp(); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.version_appointment_change() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS appointment_version ON public.organization_appointments;
CREATE TRIGGER appointment_version BEFORE UPDATE ON public.organization_appointments FOR EACH ROW EXECUTE FUNCTION public.version_appointment_change();
CREATE OR REPLACE FUNCTION public.audit_appointment_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO public.organization_appointment_history(organization_id,appointment_id,actor_id,before_data,after_data)
 VALUES(NEW.organization_id,NEW.id,COALESCE(NEW.updated_by,NEW.created_by),CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.audit_appointment_change() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS appointment_change_history ON public.organization_appointments;
CREATE TRIGGER appointment_change_history AFTER INSERT OR UPDATE ON public.organization_appointments FOR EACH ROW EXECUTE FUNCTION public.audit_appointment_change();

CREATE TABLE IF NOT EXISTS public.organization_appointment_tracking (
 appointment_id uuid PRIMARY KEY REFERENCES public.organization_appointments(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz NOT NULL, revoked_at timestamptz, created_by uuid NOT NULL REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organization_appointment_tracking ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organization_appointment_tracking FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.organization_appointment_tracking TO service_role;
COMMIT;
