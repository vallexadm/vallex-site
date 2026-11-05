ALTER TABLE public.provider_review_invites
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.vitrine_services(id) ON DELETE SET NULL;
