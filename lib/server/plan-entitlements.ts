import type { SupabaseClient } from "@supabase/supabase-js";

export type PlanEntitlements = {
  code: "free" | "basic" | "professional" | "enterprise";
  name: string;
  canManageRequests: boolean;
  canFilterRequests: boolean;
  canExportCsv: boolean;
};

type EntitlementsResult =
  | { entitlements: PlanEntitlements; error?: never }
  | { entitlements: null; error: string };

const FREE_ENTITLEMENTS: PlanEntitlements = {
  code: "free",
  name: "Free",
  canManageRequests: false,
  canFilterRequests: false,
  canExportCsv: false,
};

export async function getPlanEntitlements(
  admin: SupabaseClient,
  organizationId: string
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

  if (!subscription || subscription.status !== "active") {
    return { entitlements: FREE_ENTITLEMENTS };
  }

  if (subscription.current_period_end) {
    const periodEnd = Date.parse(subscription.current_period_end);

    if (!Number.isFinite(periodEnd) || periodEnd <= Date.now()) {
      return { entitlements: FREE_ENTITLEMENTS };
    }
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
      canManageRequests: paid,
      canFilterRequests: paid,
      canExportCsv: code === "professional" || code === "enterprise",
    },
  };
}
