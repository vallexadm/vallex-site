BEGIN;
CREATE TABLE IF NOT EXISTS public.organization_member_departures (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id),
 user_id uuid NOT NULL, actor_id uuid NOT NULL, member_snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organization_member_departures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organization_member_departures FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.remove_organization_member(p_organization_id uuid,p_actor_id uuid,p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_owner uuid; v_member public.organization_members%ROWTYPE;
BEGIN
 SELECT owner_id INTO v_owner FROM public.organizations WHERE id=p_organization_id FOR UPDATE;
 IF v_owner IS NULL OR v_owner IS DISTINCT FROM p_actor_id THEN RAISE EXCEPTION 'OWNER_ONLY'; END IF;
 IF p_user_id=v_owner THEN RAISE EXCEPTION 'OWNER_PROTECTED'; END IF;
 SELECT * INTO v_member FROM public.organization_members
 WHERE organization_id=p_organization_id AND user_id=p_user_id AND role='member' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;
 INSERT INTO public.organization_member_departures(organization_id,user_id,actor_id,member_snapshot)
 VALUES(p_organization_id,p_user_id,p_actor_id,to_jsonb(v_member));
 DELETE FROM public.organization_members WHERE id=v_member.id;
 -- Conta Auth, convites aceitos, agenda, cobranças e pagamentos não são excluídos.
END;
$$;
REVOKE ALL ON FUNCTION public.remove_organization_member(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.remove_organization_member(uuid,uuid,uuid) TO service_role;
COMMIT;
