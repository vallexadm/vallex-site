BEGIN;
CREATE TABLE IF NOT EXISTS public.quote_decision_links(
 token_hash text PRIMARY KEY CHECK(length(token_hash)=64), quote_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 quote_version timestamptz NOT NULL, expires_at timestamptz NOT NULL, decision text CHECK(decision IN('aprovado','recusado')), responded_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quote_decision_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_decision_links FROM anon,authenticated;
GRANT ALL ON public.quote_decision_links TO service_role;
CREATE OR REPLACE FUNCTION public.respond_quote_link(p_hash text,p_decision text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE l quote_decision_links%rowtype;q orcamentos%rowtype;provider text;
BEGIN
 SELECT * INTO l FROM quote_decision_links WHERE token_hash=p_hash FOR UPDATE;
 IF l.token_hash IS NULL OR l.expires_at<=now() THEN RAISE EXCEPTION 'LINK_UNAVAILABLE'; END IF;
 SELECT * INTO q FROM orcamentos WHERE id=l.quote_id AND organization_id=l.organization_id FOR UPDATE;
 IF q.id IS NULL OR q.updated_at<>l.quote_version THEN RAISE EXCEPTION 'PROPOSAL_CHANGED'; END IF;
 IF l.decision IS NULL AND (q.status NOT IN('rascunho','enviado') OR (q.validade_ate IS NOT NULL AND q.validade_ate<(now() at time zone 'America/Sao_Paulo')::date)) THEN RAISE EXCEPTION 'PROPOSAL_CLOSED'; END IF;
 IF p_decision IS NOT NULL THEN
  IF p_decision NOT IN('aprovado','recusado') OR l.decision IS NOT NULL THEN RAISE EXCEPTION 'DECISION_UNAVAILABLE'; END IF;
  UPDATE orcamentos SET status=p_decision,updated_at=clock_timestamp() WHERE id=q.id RETURNING * INTO q;
  UPDATE quote_decision_links SET decision=p_decision,responded_at=now(),quote_version=q.updated_at WHERE token_hash=p_hash RETURNING * INTO l;
 END IF;
 SELECT name INTO provider FROM organizations WHERE id=q.organization_id;
 RETURN jsonb_build_object('provider',provider,'title',q.titulo,'description',q.descricao,'amount',q.valor,'validUntil',q.validade_ate,'notes',q.observacoes,'status',q.status,'decision',l.decision,'respondedAt',l.responded_at);
END $$;
REVOKE ALL ON FUNCTION public.respond_quote_link(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.respond_quote_link(text,text) TO service_role;
COMMIT;
