BEGIN;

CREATE OR REPLACE FUNCTION public.provider_rating_summaries(organization_ids uuid[])
RETURNS TABLE (organization_id uuid, average numeric, review_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT review.organization_id, avg(review.rating), count(*)
  FROM public.provider_reviews AS review
  WHERE review.organization_id = ANY (organization_ids)
  GROUP BY review.organization_id;
$$;

REVOKE ALL ON FUNCTION public.provider_rating_summaries(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provider_rating_summaries(uuid[]) TO service_role;

COMMIT;