import type { SupabaseClient } from "@supabase/supabase-js";
import { isAsaasPeriodExpired } from "@/lib/server/asaas-billing-dates";
import { isProviderTrialExpired } from "@/lib/provider-trial";

export type PlanEntitlements = {
  code: "free" | "basic" | "professional" | "enterprise";
  name: string; canAccessPanel: boolean; canViewRequests: boolean;
  canManageRequests: boolean; canFilterRequests: boolean; canExportCsv: boolean;
  maxServices: number | null;
  canGenerateQuotePdf: boolean; canManageFiscalNotes: boolean;
  canPublishPortfolio: boolean; canCollectReviews: boolean;
};
export const PROVIDER_PLAN_SERVICE_LIMITS = { free: 5, basic: 5, professional: 10, enterprise: null } as const;
export function basicEntitlements(): PlanEntitlements {
  return { code: "basic", name: "Basic", canAccessPanel: true, canViewRequests: true,
    canManageRequests: true, canFilterRequests: true, canExportCsv: false, maxServices: 5,
    canGenerateQuotePdf: false, canManageFiscalNotes: false, canPublishPortfolio: false, canCollectReviews: false };
}
type EntitlementsResult = { entitlements: PlanEntitlements; error?: never } | { entitlements: null; error: string };
export async function getPlanEntitlements(admin: SupabaseClient, organizationId: string, now = new Date()): Promise<EntitlementsResult> {
  const { data: subscription, error } = await admin.from("organization_subscriptions")
    .select("plan_id,status,current_period_end").eq("organization_id", organizationId).maybeSingle();
  if (error) return { entitlements: null, error: "Não foi possível verificar o plano da organização." };
  if (!subscription) return { entitlements: basicEntitlements() };
  const { data: plan, error: planError } = await admin.from("plans").select("code,name")
    .eq("id", subscription.plan_id).eq("is_active", true).maybeSingle();
  if (planError) return { entitlements: null, error: "Não foi possível verificar os recursos do plano." };
  if (!plan || !["professional", "enterprise"].includes(plan.code)) return { entitlements: basicEntitlements() };
  const valid = ["active", "trialing"].includes(subscription.status)
    && !(subscription.status === "trialing" && isProviderTrialExpired(subscription.current_period_end, now))
    && !(subscription.current_period_end && isAsaasPeriodExpired(subscription.current_period_end, now));
  if (!valid) return { entitlements: basicEntitlements() };
  return { entitlements: { ...basicEntitlements(), code: plan.code, name: plan.name || plan.code,
    canExportCsv: true, maxServices: plan.code === "enterprise" ? null : 10,
    canGenerateQuotePdf: true, canManageFiscalNotes: true, canPublishPortfolio: true, canCollectReviews: true } };
}
