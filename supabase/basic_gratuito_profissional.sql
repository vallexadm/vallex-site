-- Test first. This migration does not cancel external paid subscriptions.
BEGIN;
UPDATE public.plans SET monthly_price=0,is_public=true,max_users=3 WHERE code='basic';
UPDATE public.plans SET is_public=false WHERE code='free';
UPDATE public.organization_subscriptions s SET plan_id=b.id,status='active',current_period_end=NULL
FROM public.plans b,public.plans old
WHERE b.code='basic' AND old.id=s.plan_id AND old.code IN ('basic','free')
AND s.billing_provider='manual' AND s.status IN ('active','trialing');
DO $m$
DECLARE f record; definition text;
BEGIN
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('accept_organization_invitation','create_organization_invitation') LOOP
  definition:=pg_get_functiondef(f.oid);
  definition:=regexp_replace(definition,'p[.]code[[:space:]]*=[[:space:]]*''free''','p.code = ''basic''','gi');
  IF position('VALLEX_EFFECTIVE_PLAN' in definition)=0 THEN
   definition:=replace(definition,' and (os.current_period_end is null or os.current_period_end > now())','');
   definition:=regexp_replace(definition,'os[.]status[[:space:]]+in[[:space:]]*[(][^)]*[)]','os.status in (''active'',''trialing'') /* VALLEX_EFFECTIVE_PLAN */ and ((os.status=''active'' and (os.current_period_end is null or (os.current_period_end at time zone ''America/Sao_Paulo'')::date >= (now() at time zone ''America/Sao_Paulo'')::date)) or (os.status=''trialing'' and os.current_period_end > now()))','gi');
  END IF;
  EXECUTE definition;
 END LOOP;
END $m$;
CREATE TABLE IF NOT EXISTS public.provider_fiscal_profiles (
 organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
 legal_name text NOT NULL DEFAULT '' CHECK(length(legal_name)<=160),
 tax_id text NOT NULL DEFAULT '' CHECK(length(tax_id)<=18),
 municipal_registration text NOT NULL DEFAULT '' CHECK(length(municipal_registration)<=40),
 city text NOT NULL DEFAULT '' CHECK(length(city)<=100),state text NOT NULL DEFAULT '' CHECK(length(state)<=2),
 address text NOT NULL DEFAULT '' CHECK(length(address)<=300),email text NOT NULL DEFAULT '' CHECK(length(email)<=150),
 phone text NOT NULL DEFAULT '' CHECK(length(phone)<=40),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.provider_fiscal_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 number text NOT NULL CHECK(length(number) BETWEEN 1 AND 60),issued_on date NOT NULL,
 service_description text NOT NULL CHECK(length(service_description) BETWEEN 3 AND 3000),
 amount numeric(12,2) NOT NULL CHECK(amount>=0),verification_key text NOT NULL DEFAULT '' CHECK(length(verification_key)<=100),
 file_path text NOT NULL,file_name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,number)
);
CREATE TABLE IF NOT EXISTS public.provider_portfolio (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 file_path text NOT NULL,caption text NOT NULL CHECK(length(caption) BETWEEN 3 AND 160),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.provider_review_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 appointment_id uuid NOT NULL UNIQUE REFERENCES public.organization_appointments(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE CHECK(length(token_hash)=64),expires_at timestamptz NOT NULL,used_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.provider_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 invitation_id uuid NOT NULL UNIQUE REFERENCES public.provider_review_invites(id) ON DELETE CASCADE,
 author_name text NOT NULL CHECK(length(author_name) BETWEEN 2 AND 80),rating smallint NOT NULL CHECK(rating BETWEEN 1 AND 5),
 comment text NOT NULL CHECK(length(comment) BETWEEN 10 AND 1500),consent_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_portfolio_org ON public.provider_portfolio(organization_id,created_at);
CREATE INDEX IF NOT EXISTS provider_reviews_org ON public.provider_reviews(organization_id,created_at);
DO $m$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['provider_fiscal_profiles','provider_fiscal_notes','provider_portfolio','provider_review_invites','provider_reviews'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon,authenticated',t);
 EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role',t);
 END LOOP;
END $m$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('vallex-pro','vallex-pro',false,10485760,ARRAY['application/pdf','image/webp','image/jpeg','image/png'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
CREATE OR REPLACE FUNCTION public.submit_provider_review(p_hash text,p_name text,p_rating integer,p_comment text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $f$
DECLARE i public.provider_review_invites%rowtype; review_id uuid;
BEGIN
 SELECT * INTO i FROM public.provider_review_invites WHERE token_hash=p_hash FOR UPDATE;
 IF i.id IS NULL OR i.used_at IS NOT NULL OR i.expires_at<=now() THEN RAISE EXCEPTION 'REVIEW_LINK_INVALID'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organization_appointments a WHERE a.id=i.appointment_id AND a.organization_id=i.organization_id AND a.status='completed') THEN RAISE EXCEPTION 'ATTENDANCE_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organization_subscriptions s JOIN public.plans p ON p.id=s.plan_id
 WHERE s.organization_id=i.organization_id AND p.is_active AND p.code IN ('professional','enterprise')
 AND ((s.status='active' AND (s.current_period_end IS NULL OR (s.current_period_end at time zone 'America/Sao_Paulo')::date >= (now() at time zone 'America/Sao_Paulo')::date)) OR (s.status='trialing' AND s.current_period_end>now()))) THEN RAISE EXCEPTION 'PRO_REQUIRED'; END IF;
 INSERT INTO public.provider_reviews(organization_id,invitation_id,author_name,rating,comment)
 VALUES(i.organization_id,i.id,p_name,p_rating,p_comment) RETURNING id INTO review_id;
 UPDATE public.provider_review_invites SET used_at=now() WHERE id=i.id;
 RETURN review_id;
END $f$;
REVOKE ALL ON FUNCTION public.submit_provider_review(text,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_provider_review(text,text,integer,text) TO service_role;
COMMIT;
