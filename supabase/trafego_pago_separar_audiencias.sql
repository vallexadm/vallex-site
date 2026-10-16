-- Allow traffic leads to identify visitors and existing customers separately.
ALTER TABLE public.traffic_leads
  DROP CONSTRAINT IF EXISTS traffic_leads_audience_check;

ALTER TABLE public.traffic_leads
  ADD CONSTRAINT traffic_leads_audience_check
  CHECK (audience IN ('visitante', 'cliente', 'prestador'));
