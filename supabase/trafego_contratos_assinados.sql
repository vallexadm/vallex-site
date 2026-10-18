-- Execute no projeto Supabase de TESTE depois de trafego_pago.sql.
-- Guarda somente o PDF assinado recebido; o arquivo preparado para envio
-- permanece no dispositivo do operador e nunca é enviado ao Storage.

BEGIN;

ALTER TABLE public.traffic_leads
  ADD COLUMN IF NOT EXISTS signed_contract_path text,
  ADD COLUMN IF NOT EXISTS signed_contract_name text,
  ADD COLUMN IF NOT EXISTS signed_contract_at timestamptz;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'traffic-signed-contracts',
  'traffic-signed-contracts',
  false,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;
