import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function unauthorized(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!token) return unauthorized("Entre na conta administrativa da VALLEX.", 401);

  const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminUserId = process.env.SUPABASE_ADMIN_USER_ID;
  const databaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!authUrl || !anonKey || !adminUserId || !databaseUrl || !serviceKey) {
    const missing = [
      ["NEXT_PUBLIC_SUPABASE_URL", authUrl],
      ["NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey],
      ["SUPABASE_ADMIN_USER_ID", adminUserId],
      ["SUPABASE_URL", databaseUrl],
      ["SUPABASE_SECRET_KEY", serviceKey],
    ].filter(([, value]) => !value).map(([name]) => name);
    return unauthorized(`Configuração administrativa incompleta no servidor: ${missing.join(", ")}.`, 503);
  }

  const authClient = createClient(authUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);

  if (authError || !authData.user) {
    return unauthorized("Sua sessão expirou. Entre novamente.", 401);
  }
  if (authData.user.id !== adminUserId) {
    return unauthorized("Esta área é exclusiva da administração VALLEX.", 403);
  }

  const admin = createClient(databaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [organizationsResult, profilesResult, subscriptionsResult, plansResult] =
    await Promise.all([
      admin.from("organizations").select("id, name, business_type, created_at").order("created_at", { ascending: false }),
      admin.from("organization_public_profiles").select("organization_id, slug, display_name, is_published, service_area, updated_at"),
      admin.from("organization_subscriptions").select("organization_id, status, current_period_end, plan_id"),
      admin.from("plans").select("id, name, code"),
    ]);

  const firstError = organizationsResult.error ?? profilesResult.error ?? subscriptionsResult.error ?? plansResult.error;
  if (firstError) {
    console.error("Erro ao carregar organizações na administração VALLEX:", firstError);
    return unauthorized("Não foi possível carregar os prestadores agora.", 500);
  }

  const profilesByOrganization = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.organization_id, profile])
  );
  const subscriptionsByOrganization = new Map(
    (subscriptionsResult.data ?? []).map((subscription) => [subscription.organization_id, subscription])
  );
  const plansById = new Map((plansResult.data ?? []).map((plan) => [plan.id, plan]));

  const providers = (organizationsResult.data ?? []).map((organization) => {
    const profile = profilesByOrganization.get(organization.id);
    const subscription = subscriptionsByOrganization.get(organization.id);
    return {
      id: organization.id,
      name: organization.name,
      businessType: organization.business_type,
      createdAt: organization.created_at,
      profile: profile
        ? {
            slug: profile.slug,
            displayName: profile.display_name,
            published: profile.is_published,
            serviceArea: profile.service_area,
            updatedAt: profile.updated_at,
          }
        : null,
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodEnd: subscription.current_period_end,
            plan: plansById.get(subscription.plan_id)?.name ?? "Plano não identificado",
          }
        : null,
    };
  });

  return NextResponse.json(
    { ok: true, providers },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
