


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."accept_organization_invitation"("p_token_hash" "text", "p_user_id" "uuid", "p_user_email" "text") RETURNS TABLE("organization_id" "uuid", "organization_name" "text", "membership_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_invitation public.organization_invitations%rowtype;
  v_organization public.organizations%rowtype;
  v_membership_id uuid;
  v_plan_max_users integer;
  v_occupied_slots integer;
begin
  if p_token_hash is null
     or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_TOKEN';
  end if;

  if p_user_id is null
     or p_user_email is null
     or length(trim(p_user_email)) = 0 then
    raise exception 'INVALID_USER';
  end if;

  -- Localiza o convite para identificar a organização.
  select *
    into v_invitation
  from public.organization_invitations oi
  where oi.token_hash = p_token_hash;

  if not found then
    raise exception 'INVITATION_NOT_FOUND';
  end if;

  -- Serializa aceitações e alterações de capacidade por organização.
  select *
    into v_organization
  from public.organizations o
  where o.id = v_invitation.organization_id
  for update;

  if not found then
    raise exception 'ORGANIZATION_NOT_FOUND';
  end if;

  -- Revalida o convite após obter o bloqueio da organização.
  select *
    into v_invitation
  from public.organization_invitations oi
  where oi.id = v_invitation.id
  for update;

  if v_invitation.status <> 'pending' then
    raise exception 'INVITATION_NOT_PENDING';
  end if;

  if v_invitation.expires_at <= now() then
    raise exception 'INVITATION_EXPIRED';
  end if;

  if lower(trim(v_invitation.email)) <> lower(trim(p_user_email)) then
    raise exception 'EMAIL_MISMATCH';
  end if;

  if v_organization.owner_id = p_user_id then
    raise exception 'USER_ALREADY_OWNER';
  end if;

  if exists (
    select 1
    from public.organization_members om
    where om.organization_id = v_organization.id
      and om.user_id = p_user_id
  ) then
    raise exception 'USER_ALREADY_MEMBER';
  end if;

  -- Recupera o limite do plano vigente; sem assinatura, aplica Free.
  select p.max_users
    into v_plan_max_users
  from public.organization_subscriptions os
  join public.plans p on p.id = os.plan_id
  where os.organization_id = v_organization.id
    and os.status in ('active', 'trialing', 'past_due')
  order by os.created_at desc
  limit 1;

  if v_plan_max_users is null then
    select p.max_users
      into v_plan_max_users
    from public.plans p
    where p.code = 'free'
      and p.is_active = true;
  end if;

  if v_plan_max_users is null then
    raise exception 'PLAN_CONFIGURATION_ERROR';
  end if;

  -- Ocupação inclui proprietário, membros e convites pendentes válidos.
  select
    1
    + (
      select count(distinct om.user_id)
      from public.organization_members om
      where om.organization_id = v_organization.id
        and om.user_id <> v_organization.owner_id
    )
    + (
      select count(*)
      from public.organization_invitations oi
      where oi.organization_id = v_organization.id
        and oi.status = 'pending'
        and oi.expires_at > now()
    )
  into v_occupied_slots;

  if v_occupied_slots > v_plan_max_users then
    raise exception 'PLAN_CAPACITY_EXCEEDED';
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    role
  )
  values (
    v_organization.id,
    p_user_id,
    'member'
  )
  returning id into v_membership_id;

  update public.organization_invitations oi
  set
    status = 'accepted',
    accepted_by = p_user_id,
    accepted_at = now()
  where oi.id = v_invitation.id
    and oi.status = 'pending';

  if not found then
    raise exception 'INVITATION_NOT_PENDING';
  end if;

  return query
  select
    v_organization.id,
    v_organization.name,
    v_membership_id;
end;
$_$;


ALTER FUNCTION "public"."accept_organization_invitation"("p_token_hash" "text", "p_user_id" "uuid", "p_user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_organization_invitation"("p_organization_id" "uuid", "p_actor_id" "uuid", "p_email" "text", "p_token_hash" "text") RETURNS TABLE("invitation_id" "uuid", "expires_at" timestamp with time zone, "plan_code" "text", "max_users" integer, "occupied_slots" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_owner_id uuid;
  v_email text;
  v_plan_code text;
  v_max_users integer;
  v_occupied_slots integer;
  v_invitation_id uuid;
  v_expires_at timestamptz;
BEGIN
  -- Normaliza o e-mail.
  v_email := lower(trim(p_email));

  IF v_email IS NULL OR length(v_email) < 3 OR length(v_email) > 320
     OR position('@' IN v_email) < 2 THEN
    RAISE EXCEPTION 'INVALID_EMAIL';
  END IF;

  -- O token deve chegar como hash SHA-256 hexadecimal.
  IF p_token_hash IS NULL
     OR p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'INVALID_TOKEN_HASH';
  END IF;

  -- Bloqueia a organização para serializar emissões concorrentes.
  SELECT o.owner_id
    INTO v_owner_id
  FROM public.organizations o
  WHERE o.id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORGANIZATION_NOT_FOUND';
  END IF;

  -- Somente o proprietário pode emitir convites.
  IF v_owner_id <> p_actor_id THEN
    RAISE EXCEPTION 'OWNER_ONLY';
  END IF;

  -- Não permite convidar o proprietário.
  IF EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = v_owner_id
      AND lower(u.email) = v_email
  ) THEN
    RAISE EXCEPTION 'EMAIL_ALREADY_IN_ORGANIZATION';
  END IF;

  -- Não permite convidar alguém que já seja membro.
  IF EXISTS (
    SELECT 1
    FROM public.organization_members m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.organization_id = p_organization_id
      AND lower(u.email) = v_email
  ) THEN
    RAISE EXCEPTION 'EMAIL_ALREADY_IN_ORGANIZATION';
  END IF;

  -- Não permite convites pendentes duplicados.
  IF EXISTS (
    SELECT 1
    FROM public.organization_invitations i
    WHERE i.organization_id = p_organization_id
      AND i.email = v_email
      AND i.status = 'pending'
      AND i.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'INVITATION_ALREADY_PENDING';
  END IF;

  -- Busca o plano da assinatura vigente.
  SELECT p.code, p.max_users
    INTO v_plan_code, v_max_users
  FROM public.organization_subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.organization_id = p_organization_id
    AND s.status IN ('active', 'trialing', 'past_due')
  LIMIT 1;

  -- Se não houver assinatura vigente, aplica o plano Free.
  IF NOT FOUND THEN
    SELECT p.code, p.max_users
      INTO v_plan_code, v_max_users
    FROM public.plans p
    WHERE p.code = 'free'
      AND p.is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'FREE_PLAN_NOT_CONFIGURED';
    END IF;
  END IF;

  -- Conta proprietário + membros distintos + convites pendentes válidos.
  SELECT
    1
    + (
      SELECT count(DISTINCT m.user_id)
      FROM public.organization_members m
      WHERE m.organization_id = p_organization_id
        AND m.user_id <> v_owner_id
    )
    + (
      SELECT count(*)
      FROM public.organization_invitations i
      WHERE i.organization_id = p_organization_id
        AND i.status = 'pending'
        AND i.expires_at > now()
    )
  INTO v_occupied_slots;

  IF v_occupied_slots >= v_max_users THEN
    RAISE EXCEPTION 'PLAN_USER_LIMIT_REACHED';
  END IF;

  v_expires_at := now() + interval '7 days';

  INSERT INTO public.organization_invitations (
    organization_id,
    email,
    role,
    token_hash,
    status,
    invited_by,
    expires_at
  )
  VALUES (
    p_organization_id,
    v_email,
    'member',
    p_token_hash,
    'pending',
    p_actor_id,
    v_expires_at
  )
  RETURNING id INTO v_invitation_id;

  RETURN QUERY
  SELECT
    v_invitation_id,
    v_expires_at,
    v_plan_code,
    v_max_users,
    v_occupied_slots + 1;
END;
$_$;


ALTER FUNCTION "public"."create_organization_invitation"("p_organization_id" "uuid", "p_actor_id" "uuid", "p_email" "text", "p_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."registrar_historico_status_contato"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if old.status is distinct from new.status then
    insert into public.contato_historico (
      contato_id,
      tipo,
      status_anterior,
      status_novo
    )
    values (
      new.id,
      'status_alterado',
      old.status,
      new.status
    );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."registrar_historico_status_contato"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."asaas_checkout_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "external_reference" "text" NOT NULL,
    "asaas_checkout_id" "text",
    "checkout_url" "text",
    "asaas_customer_id" "text",
    "asaas_subscription_id" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "asaas_checkout_sessions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'canceled'::"text", 'expired'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."asaas_checkout_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."asaas_checkout_sessions" IS 'Internal mapping between VALLEX organizations/plans and Asaas hosted checkouts.';



CREATE TABLE IF NOT EXISTS "public"."asaas_webhook_events" (
    "event_id" "text" NOT NULL,
    "event_name" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "process_error" "text"
);


ALTER TABLE "public"."asaas_webhook_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."asaas_webhook_events" IS 'Asaas webhook inbox used for idempotent subscription event processing.';



CREATE TABLE IF NOT EXISTS "public"."avaliacoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "empresa" "text",
    "servico" "text" NOT NULL,
    "nota" smallint NOT NULL,
    "depoimento" "text" NOT NULL,
    "video_url" "text",
    "consentimento" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pendente'::"text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    "atualizado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "avaliacoes_consentimento_check" CHECK (("consentimento" = true)),
    CONSTRAINT "avaliacoes_nota_check" CHECK ((("nota" >= 1) AND ("nota" <= 5))),
    CONSTRAINT "avaliacoes_status_check" CHECK (("status" = ANY (ARRAY['pendente'::"text", 'aprovada'::"text", 'rejeitada'::"text"])))
);


ALTER TABLE "public"."avaliacoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalog_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "item_type" "text" DEFAULT 'service'::"text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) DEFAULT 0 NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "catalog_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['service'::"text", 'product'::"text"]))),
    CONSTRAINT "catalog_items_price_check" CHECK (("price" >= (0)::numeric))
);


ALTER TABLE "public"."catalog_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contato_historico" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contato_id" "uuid" NOT NULL,
    "tipo" "text" NOT NULL,
    "status_anterior" "text",
    "status_novo" "text",
    "observacao" "text",
    "criado_por" "uuid",
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contato_historico_dados_validos" CHECK (((("tipo" = 'status_alterado'::"text") AND ("status_novo" IS NOT NULL) AND ("observacao" IS NULL)) OR (("tipo" = 'anotacao'::"text") AND ("observacao" IS NOT NULL) AND ("length"(TRIM(BOTH FROM "observacao")) > 0) AND ("status_anterior" IS NULL) AND ("status_novo" IS NULL)))),
    CONSTRAINT "contato_historico_tipo_check" CHECK (("tipo" = ANY (ARRAY['status_alterado'::"text", 'anotacao'::"text"])))
);


ALTER TABLE "public"."contato_historico" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contatos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "telefone" "text" NOT NULL,
    "email" "text",
    "servico" "text" NOT NULL,
    "descricao" "text" NOT NULL,
    "data_preferida" "date",
    "horario_preferido" "text",
    "sugestao_futura" "text",
    "status" "text" DEFAULT 'novo'::"text" NOT NULL,
    "criado_em" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."contatos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "address" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'ativo'::"text" NOT NULL,
    CONSTRAINT "customers_status_check" CHECK (("status" = ANY (ARRAY['ativo'::"text", 'inativo'::"text"])))
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orcamento_public_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orcamento_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "last_accessed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "orcamento_public_access_expiration_check" CHECK ((("expires_at" IS NULL) OR ("expires_at" > "created_at"))),
    CONSTRAINT "orcamento_public_access_token_hash_format" CHECK (("token_hash" ~ '^[a-f0-9]{64}$'::"text"))
);


ALTER TABLE "public"."orcamento_public_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orcamentos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "titulo" "text" NOT NULL,
    "descricao" "text",
    "valor" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'rascunho'::"text" NOT NULL,
    "validade_ate" "date",
    "observacoes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "orcamentos_status_check" CHECK (("status" = ANY (ARRAY['rascunho'::"text", 'enviado'::"text", 'aprovado'::"text", 'recusado'::"text", 'cancelado'::"text"])))
);


ALTER TABLE "public"."orcamentos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "token_hash" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invited_by" "uuid",
    "accepted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "organization_invitations_check" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "organization_invitations_check1" CHECK ((("status" <> 'accepted'::"text") OR (("accepted_by" IS NOT NULL) AND ("accepted_at" IS NOT NULL)))),
    CONSTRAINT "organization_invitations_check2" CHECK ((("status" <> 'revoked'::"text") OR ("revoked_at" IS NOT NULL))),
    CONSTRAINT "organization_invitations_email_check" CHECK (((("length"("email") >= 3) AND ("length"("email") <= 320)) AND ("email" = "lower"(TRIM(BOTH FROM "email"))))),
    CONSTRAINT "organization_invitations_role_check" CHECK (("role" = 'member'::"text")),
    CONSTRAINT "organization_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text", 'revoked'::"text"]))),
    CONSTRAINT "organization_invitations_token_hash_check" CHECK (("token_hash" ~ '^[a-f0-9]{64}$'::"text"))
);


ALTER TABLE "public"."organization_invitations" OWNER TO "postgres";


COMMENT ON TABLE "public"."organization_invitations" IS 'Convites de acesso às organizações do ServiçoFácil. Gerenciada exclusivamente pelo backend.';



CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'owner'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"])))
);


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_public_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text",
    "phone" "text",
    "whatsapp" "text",
    "email" "text",
    "address" "text",
    "service_area" "text",
    "service_modes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "logo_url" "text",
    "is_published" boolean DEFAULT false NOT NULL,
    "publication_authorized_at" timestamp with time zone,
    "publication_revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_public_profiles_description_length" CHECK ((("description" IS NULL) OR ("char_length"("description") <= 2000))),
    CONSTRAINT "organization_public_profiles_display_name_length" CHECK ((("char_length"(TRIM(BOTH FROM "display_name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "display_name")) <= 160))),
    CONSTRAINT "organization_public_profiles_service_area_length" CHECK (("service_area" IS NULL) OR ("char_length"("service_area") <= 300)),
    CONSTRAINT "organization_public_profiles_service_modes_allowed" CHECK (("service_modes" <@ ARRAY['presencial'::"text", 'domicilio'::"text", 'online'::"text"])),
    CONSTRAINT "organization_public_profiles_published_requires_authorization" CHECK ((("is_published" = false) OR ("publication_authorized_at" IS NOT NULL))),
    CONSTRAINT "organization_public_profiles_slug_format" CHECK (("slug" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::"text"))
);


ALTER TABLE "public"."organization_public_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_publication_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "actor_user_id" "uuid",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_publication_history_action_check" CHECK (("action" = ANY (ARRAY['authorized'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."organization_publication_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "billing_provider" "text" DEFAULT 'manual'::"text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "canceled_at" timestamp with time zone,
    "external_customer_id" "text",
    "external_subscription_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "organization_subscriptions_period_check" CHECK ((("current_period_end" IS NULL) OR ("current_period_start" IS NULL) OR ("current_period_end" > "current_period_start"))),
    CONSTRAINT "organization_subscriptions_provider_check" CHECK (("billing_provider" = ANY (ARRAY['manual'::"text", 'asaas'::"text"]))),
    CONSTRAINT "organization_subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'trialing'::"text", 'past_due'::"text", 'canceled'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."organization_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "business_type" "text",
    "owner_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "max_users" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "monthly_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    CONSTRAINT "plans_code_check" CHECK (("code" = ANY (ARRAY['free'::"text", 'basic'::"text", 'professional'::"text", 'enterprise'::"text"]))),
    CONSTRAINT "plans_max_users_check" CHECK (("max_users" >= 1))
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quote_file_links" (
    "token" "text" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "download_name" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "quote_file_links_token_check" CHECK (("token" ~ '^[A-Za-z0-9_-]{16}$'::"text"))
);


ALTER TABLE "public"."quote_file_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."solicitacoes_orcamento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "vitrine_service_id" "uuid",
    "customer_id" "uuid",
    "orcamento_id" "uuid",
    "nome" "text" NOT NULL,
    "telefone" "text" NOT NULL,
    "email" "text",
    "descricao" "text",
    "endereco" "text",
    "data_preferida" "date",
    "horario_preferido" "text",
    "observacoes" "text",
    "status" "text" DEFAULT 'nova'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "solicitacoes_orcamento_descricao_length" CHECK ((("descricao" IS NULL) OR ("char_length"("descricao") <= 5000))),
    CONSTRAINT "solicitacoes_orcamento_email_length" CHECK ((("email" IS NULL) OR ("char_length"(TRIM(BOTH FROM "email")) <= 320))),
    CONSTRAINT "solicitacoes_orcamento_nome_length" CHECK ((("char_length"(TRIM(BOTH FROM "nome")) >= 2) AND ("char_length"(TRIM(BOTH FROM "nome")) <= 160))),
    CONSTRAINT "solicitacoes_orcamento_observacoes_length" CHECK ((("observacoes" IS NULL) OR ("char_length"("observacoes") <= 3000))),
    CONSTRAINT "solicitacoes_orcamento_status_check" CHECK (("status" = ANY (ARRAY['nova'::"text", 'em_analise'::"text", 'cliente_cadastrado'::"text", 'orcamento_criado'::"text", 'concluida'::"text", 'cancelada'::"text"]))),
    CONSTRAINT "solicitacoes_orcamento_telefone_length" CHECK ((("char_length"(TRIM(BOTH FROM "telefone")) >= 8) AND ("char_length"(TRIM(BOTH FROM "telefone")) <= 40)))
);


ALTER TABLE "public"."solicitacoes_orcamento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vitrine_services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "catalog_item_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2),
    "is_published" boolean DEFAULT false NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "vitrine_services_description_length" CHECK ((("description" IS NULL) OR ("char_length"("description") <= 2000))),
    CONSTRAINT "vitrine_services_display_order_check" CHECK (("display_order" >= 0)),
    CONSTRAINT "vitrine_services_name_length" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 160))),
    CONSTRAINT "vitrine_services_price_check" CHECK ((("price" IS NULL) OR ("price" >= (0)::numeric)))
);


ALTER TABLE "public"."vitrine_services" OWNER TO "postgres";


ALTER TABLE ONLY "public"."asaas_checkout_sessions"
    ADD CONSTRAINT "asaas_checkout_sessions_asaas_checkout_id_key" UNIQUE ("asaas_checkout_id");



ALTER TABLE ONLY "public"."asaas_checkout_sessions"
    ADD CONSTRAINT "asaas_checkout_sessions_external_reference_key" UNIQUE ("external_reference");



ALTER TABLE ONLY "public"."asaas_checkout_sessions"
    ADD CONSTRAINT "asaas_checkout_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asaas_webhook_events"
    ADD CONSTRAINT "asaas_webhook_events_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."avaliacoes"
    ADD CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contato_historico"
    ADD CONSTRAINT "contato_historico_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contatos"
    ADD CONSTRAINT "contatos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orcamento_public_access"
    ADD CONSTRAINT "orcamento_public_access_orcamento_unique" UNIQUE ("orcamento_id");



ALTER TABLE ONLY "public"."orcamento_public_access"
    ADD CONSTRAINT "orcamento_public_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orcamento_public_access"
    ADD CONSTRAINT "orcamento_public_access_token_unique" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."orcamentos"
    ADD CONSTRAINT "orcamentos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_user_id_key" UNIQUE ("organization_id", "user_id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_public_profiles"
    ADD CONSTRAINT "organization_public_profiles_organization_unique" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."organization_public_profiles"
    ADD CONSTRAINT "organization_public_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_public_profiles"
    ADD CONSTRAINT "organization_public_profiles_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."organization_publication_history"
    ADD CONSTRAINT "organization_publication_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_subscriptions"
    ADD CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_owner_id_key" UNIQUE ("owner_id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quote_file_links"
    ADD CONSTRAINT "quote_file_links_pkey" PRIMARY KEY ("token");



ALTER TABLE ONLY "public"."solicitacoes_orcamento"
    ADD CONSTRAINT "solicitacoes_orcamento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vitrine_services"
    ADD CONSTRAINT "vitrine_services_pkey" PRIMARY KEY ("id");



CREATE INDEX "asaas_checkout_sessions_customer_idx" ON "public"."asaas_checkout_sessions" USING "btree" ("asaas_customer_id") WHERE ("asaas_customer_id" IS NOT NULL);



CREATE INDEX "asaas_checkout_sessions_org_status_idx" ON "public"."asaas_checkout_sessions" USING "btree" ("organization_id", "status", "created_at" DESC);



CREATE INDEX "customers_organization_status_idx" ON "public"."customers" USING "btree" ("organization_id", "status");



CREATE INDEX "idx_contato_historico_contato_data" ON "public"."contato_historico" USING "btree" ("contato_id", "criado_em" DESC);



CREATE INDEX "orcamento_public_access_token_idx" ON "public"."orcamento_public_access" USING "btree" ("token_hash");



CREATE INDEX "orcamentos_customer_id_idx" ON "public"."orcamentos" USING "btree" ("customer_id");



CREATE INDEX "orcamentos_organization_id_idx" ON "public"."orcamentos" USING "btree" ("organization_id");



CREATE INDEX "orcamentos_status_idx" ON "public"."orcamentos" USING "btree" ("status");



CREATE INDEX "organization_invitations_email_idx" ON "public"."organization_invitations" USING "btree" ("email");



CREATE UNIQUE INDEX "organization_invitations_one_pending_per_email" ON "public"."organization_invitations" USING "btree" ("organization_id", "email") WHERE ("status" = 'pending'::"text");



CREATE INDEX "organization_invitations_org_status_idx" ON "public"."organization_invitations" USING "btree" ("organization_id", "status");



CREATE INDEX "organization_public_profiles_published_idx" ON "public"."organization_public_profiles" USING "btree" ("is_published");



CREATE INDEX "organization_publication_history_organization_idx" ON "public"."organization_publication_history" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "organization_subscriptions_one_current_per_org" ON "public"."organization_subscriptions" USING "btree" ("organization_id") WHERE ("status" = ANY (ARRAY['active'::"text", 'trialing'::"text", 'past_due'::"text"]));



CREATE INDEX "organization_subscriptions_org_idx" ON "public"."organization_subscriptions" USING "btree" ("organization_id");



CREATE INDEX "quote_file_links_expires_at_idx" ON "public"."quote_file_links" USING "btree" ("expires_at");



CREATE INDEX "solicitacoes_orcamento_customer_idx" ON "public"."solicitacoes_orcamento" USING "btree" ("customer_id");



CREATE INDEX "solicitacoes_orcamento_orcamento_idx" ON "public"."solicitacoes_orcamento" USING "btree" ("orcamento_id");



CREATE INDEX "solicitacoes_orcamento_organization_idx" ON "public"."solicitacoes_orcamento" USING "btree" ("organization_id");



CREATE INDEX "solicitacoes_orcamento_service_idx" ON "public"."solicitacoes_orcamento" USING "btree" ("vitrine_service_id");



CREATE INDEX "solicitacoes_orcamento_status_idx" ON "public"."solicitacoes_orcamento" USING "btree" ("organization_id", "status");



CREATE INDEX "vitrine_services_catalog_item_idx" ON "public"."vitrine_services" USING "btree" ("catalog_item_id");



CREATE INDEX "vitrine_services_organization_idx" ON "public"."vitrine_services" USING "btree" ("organization_id");



CREATE INDEX "vitrine_services_publication_idx" ON "public"."vitrine_services" USING "btree" ("organization_id", "is_published", "display_order");



CREATE OR REPLACE TRIGGER "trg_registrar_historico_status_contato" AFTER UPDATE OF "status" ON "public"."contatos" FOR EACH ROW EXECUTE FUNCTION "public"."registrar_historico_status_contato"();



ALTER TABLE ONLY "public"."asaas_checkout_sessions"
    ADD CONSTRAINT "asaas_checkout_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asaas_checkout_sessions"
    ADD CONSTRAINT "asaas_checkout_sessions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id");



ALTER TABLE ONLY "public"."catalog_items"
    ADD CONSTRAINT "catalog_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contato_historico"
    ADD CONSTRAINT "contato_historico_contato_id_fkey" FOREIGN KEY ("contato_id") REFERENCES "public"."contatos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orcamento_public_access"
    ADD CONSTRAINT "orcamento_public_access_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "public"."orcamentos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orcamentos"
    ADD CONSTRAINT "orcamentos_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orcamentos"
    ADD CONSTRAINT "orcamentos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_public_profiles"
    ADD CONSTRAINT "organization_public_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_publication_history"
    ADD CONSTRAINT "organization_publication_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_publication_history"
    ADD CONSTRAINT "organization_publication_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_subscriptions"
    ADD CONSTRAINT "organization_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_subscriptions"
    ADD CONSTRAINT "organization_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."solicitacoes_orcamento"
    ADD CONSTRAINT "solicitacoes_orcamento_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."solicitacoes_orcamento"
    ADD CONSTRAINT "solicitacoes_orcamento_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "public"."orcamentos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."solicitacoes_orcamento"
    ADD CONSTRAINT "solicitacoes_orcamento_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."solicitacoes_orcamento"
    ADD CONSTRAINT "solicitacoes_orcamento_vitrine_service_id_fkey" FOREIGN KEY ("vitrine_service_id") REFERENCES "public"."vitrine_services"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vitrine_services"
    ADD CONSTRAINT "vitrine_services_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vitrine_services"
    ADD CONSTRAINT "vitrine_services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



CREATE POLICY "Permitir envio público de avaliações" ON "public"."avaliacoes" FOR INSERT TO "anon" WITH CHECK ((("consentimento" = true) AND ("status" = 'pendente'::"text")));



ALTER TABLE "public"."asaas_checkout_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."asaas_webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."avaliacoes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."catalog_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "catalog_items_delete_owner" ON "public"."catalog_items" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "catalog_items"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



CREATE POLICY "catalog_items_insert_owner" ON "public"."catalog_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "catalog_items"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



CREATE POLICY "catalog_items_select_owner" ON "public"."catalog_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "catalog_items"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



CREATE POLICY "catalog_items_update_owner" ON "public"."catalog_items" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "catalog_items"."organization_id") AND ("o"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "catalog_items"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."contato_historico" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contatos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customers_delete_owner" ON "public"."customers" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "customers"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



CREATE POLICY "customers_insert_owner" ON "public"."customers" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "customers"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



CREATE POLICY "customers_select_member" ON "public"."customers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "customers"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "customers_select_owner" ON "public"."customers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "customers"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



CREATE POLICY "customers_update_owner" ON "public"."customers" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "customers"."organization_id") AND ("o"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "customers"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."orcamento_public_access" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orcamento_public_access_delete_owner" ON "public"."orcamento_public_access" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."orcamentos" "o"
     JOIN "public"."organizations" "org" ON (("org"."id" = "o"."organization_id")))
  WHERE (("o"."id" = "orcamento_public_access"."orcamento_id") AND ("org"."owner_id" = "auth"."uid"())))));



CREATE POLICY "orcamento_public_access_insert_owner" ON "public"."orcamento_public_access" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."orcamentos" "o"
     JOIN "public"."organizations" "org" ON (("org"."id" = "o"."organization_id")))
  WHERE (("o"."id" = "orcamento_public_access"."orcamento_id") AND ("org"."owner_id" = "auth"."uid"())))));



CREATE POLICY "orcamento_public_access_select_owner" ON "public"."orcamento_public_access" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."orcamentos" "o"
     JOIN "public"."organizations" "org" ON (("org"."id" = "o"."organization_id")))
  WHERE (("o"."id" = "orcamento_public_access"."orcamento_id") AND ("org"."owner_id" = "auth"."uid"())))));



CREATE POLICY "orcamento_public_access_update_owner" ON "public"."orcamento_public_access" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."orcamentos" "o"
     JOIN "public"."organizations" "org" ON (("org"."id" = "o"."organization_id")))
  WHERE (("o"."id" = "orcamento_public_access"."orcamento_id") AND ("org"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."orcamentos" "o"
     JOIN "public"."organizations" "org" ON (("org"."id" = "o"."organization_id")))
  WHERE (("o"."id" = "orcamento_public_access"."orcamento_id") AND ("org"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."orcamentos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organization_members_delete_owner" ON "public"."organization_members" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "organization_members"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



CREATE POLICY "organization_members_insert_owner" ON "public"."organization_members" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "organization_members"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



CREATE POLICY "organization_members_select_self" ON "public"."organization_members" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."organization_public_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organization_public_profiles_delete_owner" ON "public"."organization_public_profiles" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "organization_public_profiles"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



CREATE POLICY "organization_public_profiles_insert_owner" ON "public"."organization_public_profiles" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "organization_public_profiles"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



CREATE POLICY "organization_public_profiles_select_owner" ON "public"."organization_public_profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "organization_public_profiles"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



CREATE POLICY "organization_public_profiles_update_owner" ON "public"."organization_public_profiles" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "organization_public_profiles"."organization_id") AND ("o"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "organization_public_profiles"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."organization_publication_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organization_publication_history_select_owner" ON "public"."organization_publication_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "organization_publication_history"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."organization_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "organizations_delete_owner" ON "public"."organizations" FOR DELETE TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "organizations_insert_owner" ON "public"."organizations" FOR INSERT TO "authenticated" WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "organizations_select_owner" ON "public"."organizations" FOR SELECT TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "organizations_update_owner" ON "public"."organizations" FOR UPDATE TO "authenticated" USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quote_file_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."solicitacoes_orcamento" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "solicitacoes_orcamento_select_owner" ON "public"."solicitacoes_orcamento" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "solicitacoes_orcamento"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



CREATE POLICY "solicitacoes_orcamento_update_owner" ON "public"."solicitacoes_orcamento" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "solicitacoes_orcamento"."organization_id") AND ("o"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "solicitacoes_orcamento"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



ALTER TABLE "public"."vitrine_services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vitrine_services_delete_owner" ON "public"."vitrine_services" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "vitrine_services"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



CREATE POLICY "vitrine_services_insert_owner" ON "public"."vitrine_services" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "vitrine_services"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



CREATE POLICY "vitrine_services_select_owner" ON "public"."vitrine_services" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "vitrine_services"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));



CREATE POLICY "vitrine_services_update_owner" ON "public"."vitrine_services" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "vitrine_services"."organization_id") AND ("o"."owner_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organizations" "o"
  WHERE (("o"."id" = "vitrine_services"."organization_id") AND ("o"."owner_id" = "auth"."uid"())))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."accept_organization_invitation"("p_token_hash" "text", "p_user_id" "uuid", "p_user_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_organization_invitation"("p_token_hash" "text", "p_user_id" "uuid", "p_user_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_organization_invitation"("p_organization_id" "uuid", "p_actor_id" "uuid", "p_email" "text", "p_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_organization_invitation"("p_organization_id" "uuid", "p_actor_id" "uuid", "p_email" "text", "p_token_hash" "text") TO "service_role";


















GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."asaas_checkout_sessions" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."asaas_checkout_sessions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."asaas_checkout_sessions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."asaas_webhook_events" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."asaas_webhook_events" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."asaas_webhook_events" TO "service_role";



GRANT INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."avaliacoes" TO "anon";
GRANT INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."avaliacoes" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."avaliacoes" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."catalog_items" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."catalog_items" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."catalog_items" TO "service_role";



GRANT ALL ON TABLE "public"."contato_historico" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."contatos" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."customers" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."orcamento_public_access" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."orcamento_public_access" TO "authenticated";
GRANT ALL ON TABLE "public"."orcamento_public_access" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."orcamentos" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."orcamentos" TO "authenticated";
GRANT ALL ON TABLE "public"."orcamentos" TO "service_role";



GRANT ALL ON TABLE "public"."organization_invitations" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."organization_members" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."organization_members" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."organization_members" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."organization_public_profiles" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."organization_public_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_public_profiles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."organization_publication_history" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."organization_publication_history" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_publication_history" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."organization_subscriptions" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."organization_subscriptions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."organization_subscriptions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."organizations" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."organizations" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."organizations" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."plans" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."plans" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."quote_file_links" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."solicitacoes_orcamento" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."solicitacoes_orcamento" TO "authenticated";
GRANT ALL ON TABLE "public"."solicitacoes_orcamento" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."vitrine_services" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."vitrine_services" TO "authenticated";
GRANT ALL ON TABLE "public"."vitrine_services" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";































