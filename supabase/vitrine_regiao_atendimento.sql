-- Localidade e modalidades de atendimento divulgadas na Vitrine do prestador.
ALTER TABLE public.organization_public_profiles
  ADD COLUMN IF NOT EXISTS service_area text,
  ADD COLUMN IF NOT EXISTS service_modes text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.organization_public_profiles
  DROP CONSTRAINT IF EXISTS organization_public_profiles_service_area_length,
  ADD CONSTRAINT organization_public_profiles_service_area_length
    CHECK (service_area IS NULL OR char_length(service_area) <= 300),
  DROP CONSTRAINT IF EXISTS organization_public_profiles_service_modes_allowed,
  ADD CONSTRAINT organization_public_profiles_service_modes_allowed
    CHECK (service_modes <@ ARRAY['presencial', 'domicilio', 'online']::text[]);

COMMENT ON COLUMN public.organization_public_profiles.service_area IS
  'Cidade, bairros ou região em que o prestador atende; texto público usado na busca.';
COMMENT ON COLUMN public.organization_public_profiles.service_modes IS
  'Modalidades públicas de atendimento: presencial, domicilio e/ou online.';
