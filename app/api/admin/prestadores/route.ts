import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePlatformPermission } from "@/lib/server/platform-admin";

export const runtime = "nodejs";

function unauthorized(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function GET(request: Request) {
  const access = await requirePlatformPermission(request, "providers", "view");
  if (!access.ok) return access.response;
  const databaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!databaseUrl || !serviceKey) {
    const missing = [
      ["SUPABASE_URL", databaseUrl],
      ["SUPABASE_SECRET_KEY", serviceKey],
    ].filter(([, value]) => !value).map(([name]) => name);
    return unauthorized(`Configuração administrativa incompleta no servidor: ${missing.join(", ")}.`, 503);
  }

  const admin = createClient(databaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [organizationsResult, profilesResult, subscriptionsResult, plansResult] =
    await Promise.all([
      admin.from("organizations").select("id, name, business_type, created_at").order("created_at", { ascending: false }),
      admin.from("organization_public_profiles").select("organization_id, slug, display_name, is_published, service_area, updated_at"),
      admin.from("organization_subscriptions").select("organization_id, status, current_period_end, plan_id, updated_at").order("updated_at", { ascending: false }),
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
  const subscriptionsByOrganization = new Map();
  const sortedSubscriptions = [...(subscriptionsResult.data ?? [])].sort((a, b) => {
    const currentStatus = (status: string) => ["active", "trialing", "past_due"].includes(status) ? 1 : 0;
    return currentStatus(b.status) - currentStatus(a.status);
  });
  for (const subscription of sortedSubscriptions) {
    if (!subscriptionsByOrganization.has(subscription.organization_id)) {
      subscriptionsByOrganization.set(subscription.organization_id, subscription);
    }
  }
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
            planCode: plansById.get(subscription.plan_id)?.code ?? "unknown",
          }
        : null,
    };
  });

  return NextResponse.json(
    { ok: true, providers },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
