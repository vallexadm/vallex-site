import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getPlanEntitlements } from "@/lib/server/plan-entitlements";

export async function requireProviderPanelAccess(admin: SupabaseClient, organizationId: string) {
  const result = await getPlanEntitlements(admin, organizationId);
  if (!result.entitlements) return NextResponse.json({ ok: false, message: result.error }, { status: 503 });
  if (!result.entitlements.canAccessPanel) return NextResponse.json({
    ok: false, code: "PLAN_UPGRADE_REQUIRED",
    message: "Não foi possível liberar os módulos de gestão desta conta. Seus registros foram preservados.",
  }, { status: 402 });
  return null;
}
