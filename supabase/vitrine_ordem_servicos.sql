BEGIN;
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY organization_id ORDER BY display_order, created_at, id)::integer AS position
  FROM public.vitrine_services
)
UPDATE public.vitrine_services s SET display_order = ranked.position
FROM ranked WHERE s.id = ranked.id AND s.display_order IS DISTINCT FROM ranked.position;

ALTER TABLE public.vitrine_services
  ADD CONSTRAINT vitrine_service_position_unique UNIQUE (organization_id, display_order) DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION public.normalize_vitrine_service_order() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  target_org uuid;
  target_id uuid;
  target_position integer;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;
  IF TG_OP = 'UPDATE' AND OLD.display_order = NEW.display_order THEN RETURN NULL; END IF;
  IF TG_OP = 'DELETE' THEN
    target_org := OLD.organization_id;
    IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = target_org) THEN RETURN NULL; END IF;
  ELSE
    target_org := NEW.organization_id;
    target_id := NEW.id;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(target_org::text, 71));
  IF target_id IS NOT NULL THEN
    SELECT greatest(1, least(NEW.display_order, count(*)::integer))
    INTO target_position FROM vitrine_services WHERE organization_id = target_org;
  END IF;

  WITH others AS (
    SELECT id, row_number() OVER (ORDER BY display_order, created_at, id)::integer AS position
    FROM vitrine_services WHERE organization_id = target_org AND id IS DISTINCT FROM target_id
  ), positions AS (
    SELECT id, position + CASE WHEN position >= target_position THEN 1 ELSE 0 END AS position FROM others
    UNION ALL SELECT target_id, target_position WHERE target_id IS NOT NULL
  )
  UPDATE vitrine_services s SET display_order = positions.position
  FROM positions WHERE s.id = positions.id AND s.display_order IS DISTINCT FROM positions.position;
  RETURN NULL;
END $$;

CREATE TRIGGER normalize_vitrine_service_order
AFTER INSERT OR UPDATE OF display_order OR DELETE ON public.vitrine_services
FOR EACH ROW EXECUTE FUNCTION public.normalize_vitrine_service_order();
COMMIT;
