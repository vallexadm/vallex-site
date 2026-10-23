import { isProviderTrialExpired } from "@/lib/provider-trial";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAsaasPeriodExpired } from "@/lib/server/asaas-billing-dates";

export type PlanEntitlements = {
  code: "free" | "basic" | "professional" | "enterprise";
  name: string;
  canAccessPanel: boolean;
  canViewRequests: boolean;
  canManageRequests: boolean;
  canFilterRequests: boolean;
  canExportCsv: boolean;
  maxServices: number | null;
};

export const PROVIDER_PLAN_SERVICE_LIMITS = {
  free: 1,
  basic: 5,
  professional: 10,
  enterprise: null,
} as const;

type EntitlementsResult =
  | { entitlements: PlanEntitlements; error?: never }
  | { entitlements: null; error: string };

const FREE_ENTITLEMENTS: PlanEntitlements = {
  code: "free",
  name: "Free",
  canAccessPanel: false,
  canViewRequests: true,
  canManageRequests: false,
  canFilterRequests: false,
  canExportCsv: false,
  maxServices: PROVIDER_PLAN_SERVICE_LIMITS.free,
};

export async function getPlanEntitlements(
  admin: SupabaseClient,
  organizationId: string,
  now = new Date()
): Promise<EntitlementsResult> {
  const { data: subscription, error: subscriptionError } = await admin
    .from("organization_subscriptions")
    .select("plan_id,status,current_period_end")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (subscriptionError) {
    console.error("Erro ao consultar o plano da organização:", subscriptionError);
    return {
      entitlements: null,
      error: "Não foi possível verificar o plano da organização.",
    };
  }

  const isTrialing = subscription?.status === "trialing";
  if (
    !subscription ||
    (subscription.status !== "active" && !isTrialing)
  ) {
    return { entitlements: FREE_ENTITLEMENTS };
  }

  // Trial access is always time-limited. Missing or expired end dates fail closed to Free.
  if (
    isTrialing &&
    (!subscription.current_period_end ||
      isProviderTrialExpired(subscription.current_period_end, now))
  ) {
    return { entitlements: FREE_ENTITLEMENTS };
  }

  if (
    subscription.current_period_end &&
    isAsaasPeriodExpired(subscription.current_period_end, now)
  ) {
    return { entitlements: FREE_ENTITLEMENTS };
  }

  const { data: plan, error: planError } = await admin
    .from("plans")
    .select("code,name")
    .eq("id", subscription.plan_id)
    .eq("is_active", true)
    .maybeSingle();

  if (planError) {
    console.error("Erro ao consultar detalhes do plano:", planError);
    return {
      entitlements: null,
      error: "Não foi possível verificar os recursos do plano.",
    };
  }

  if (!plan) {
    return { entitlements: FREE_ENTITLEMENTS };
  }

  const code = plan.code;

  if (
    code !== "free" &&
    code !== "basic" &&
    code !== "professional" &&
    code !== "enterprise"
  ) {
    return { entitlements: FREE_ENTITLEMENTS };
  }

  const paid = code !== "free";

  return {
    entitlements: {
      code,
      name: plan.name || code,
      canAccessPanel: paid,
      canViewRequests: true,
      canManageRequests: paid,
      canFilterRequests: paid,
      canExportCsv: code === "professional" || code === "enterprise",
      maxServices: PROVIDER_PLAN_SERVICE_LIMITS[code as keyof typeof PROVIDER_PLAN_SERVICE_LIMITS],
    },
  };
}
