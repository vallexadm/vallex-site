BEGIN;
ALTER TABLE public.organization_members ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS public.organization_member_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL, actor_id uuid NOT NULL,
  was_active boolean NOT NULL, is_active boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organization_member_access_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organization_member_access_logs FROM PUBLIC,anon,authenticated;

-- Impede que políticas que consultam vínculos via RLS encontrem um vínculo desativado.
DROP POLICY IF EXISTS organization_members_active_visibility ON public.organization_members;
CREATE POLICY organization_members_active_visibility ON public.organization_members
  AS RESTRICTIVE FOR SELECT TO authenticated USING (is_active);

CREATE OR REPLACE FUNCTION public.set_organization_member_access(
  p_organization_id uuid, p_actor_id uuid, p_user_id uuid, p_is_active boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid; v_member public.organization_members%ROWTYPE;
BEGIN
  SELECT owner_id INTO v_owner FROM public.organizations WHERE id=p_organization_id FOR UPDATE;
  IF v_owner IS NULL OR v_owner IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'OWNER_ONLY'; END IF;
  IF p_user_id=v_owner THEN RAISE EXCEPTION 'OWNER_PROTECTED'; END IF;
  IF p_is_active IS NULL THEN RAISE EXCEPTION 'INVALID_ACCESS_STATUS'; END IF;
  SELECT * INTO v_member FROM public.organization_members
    WHERE organization_id=p_organization_id AND user_id=p_user_id AND role='member' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;
  IF v_member.is_active=p_is_active THEN RETURN; END IF;
  UPDATE public.organization_members SET is_active=p_is_active WHERE id=v_member.id;
  INSERT INTO public.organization_member_access_logs(organization_id,user_id,actor_id,was_active,is_active)
    VALUES(p_organization_id,p_user_id,p_actor_id,v_member.is_active,p_is_active);
END;
$$;
REVOKE ALL ON FUNCTION public.set_organization_member_access(uuid,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_organization_member_access(uuid,uuid,uuid,boolean) TO service_role;
COMMIT;
