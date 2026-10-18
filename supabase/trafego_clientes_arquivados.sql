-- Arquivamento reversível de clientes de tráfego pago.
-- Mantém campanhas, indicadores, documentos e atividade para consulta histórica.

ALTER TABLE public.traffic_leads
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS traffic_leads_archived_created_idx
  ON public.traffic_leads (archived_at, created_at DESC);
