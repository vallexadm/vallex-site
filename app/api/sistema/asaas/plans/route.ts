import { isProviderTrialExpired } from "@/lib/provider-trial";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAsaasPeriodExpired } from "@/lib/server/asaas-billing-dates";
export const runtime = "nodejs";
const fail = (message: string, status: number) => NextResponse.json({ ok: false, message }, { status });
export async function GET(request: Request) {
  const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseUrl = process.env.SUPABASE_URL, serviceKey = process.env.SUPABASE_SECRET_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return fail("Entre na sua conta para consultar os planos.", 401);
  if (!authUrl || !anonKey || !supabaseUrl || !serviceKey) return fail("Configuração do servidor incompleta.", 503);
  const auth = createClient(authUrl, anonKey, { auth: { persistSession: false } });
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  if (authError || !authData.user) return fail("Sessão inválida ou expirada.", 401);
  const { data: organization, error: orgError } = await admin.from("organizations").select("id").eq("owner_id", authData.user.id).maybeSingle();
  if (orgError) return fail("Não foi possível consultar sua organização.", 500);
  if (!organization) return fail("Configure sua área antes de consultar os planos.", 409);
  const [{ data: plans, error: plansError }, { data: subscription, error: subscriptionError }] = await Promise.all([
    admin.from("plans").select("id, code, name, monthly_price, max_users, sort_order").eq("is_active", true).eq("is_public", true).order("sort_order"),
    admin.from("organization_subscriptions").select("plan_id, status, billing_provider, current_period_end, canceled_at, external_subscription_id").eq("organization_id", organization.id).maybeSingle(),
  ]);
  if (plansError || subscriptionError) {
    console.error("[ASAAS PLANS] database query failed", { plansError, subscriptionError });
    const detail = plansError?.message ?? subscriptionError?.message ?? "Falha na consulta.";
    return fail(process.env.NODE_ENV === "development" ? "Falha ao consultar planos/assinatura: " + detail : "Não foi possível carregar os planos. Verifique se a migração foi aplicada.", 503);
  }
  let currentPlan: { id: string; code: string; name: string } | null = null;
  if (subscription?.plan_id) {
    const { data, error } = await admin.from("plans").select("id, code, name").eq("id", subscription.plan_id).maybeSingle();
    if (error) return fail("Não foi possível consultar seu plano atual.", 500);
    currentPlan = data;
  }
  const trialExpired =
    subscription?.status === "trialing" &&
    (!subscription.current_period_end ||
      isProviderTrialExpired(subscription.current_period_end));
  if (trialExpired) {
    const { data: freePlan, error: freePlanError } = await admin
      .from("plans")
      .select("id, code, name")
      .eq("code", "free")
      .eq("is_active", true)
      .maybeSingle();
    if (freePlanError) return fail("Não foi possível consultar o plano Free.", 500);
    currentPlan = freePlan;
  }
  const currentStatus = trialExpired
    ? "active"
    : subscription?.status === "active" &&
        subscription.current_period_end &&
        isAsaasPeriodExpired(subscription.current_period_end)
      ? "expired"
      : subscription?.status ?? "active";
  const currentPeriodIsValid =
    currentStatus === "active" &&
    (!subscription?.current_period_end ||
      !isAsaasPeriodExpired(subscription.current_period_end));
  const isPaidAsaasPlan =
    currentPlan?.code !== "free" && subscription?.billing_provider === "asaas";
  return NextResponse.json({ ok: true,
    plans: (plans ?? []).map((plan) => ({ id: plan.id, code: plan.code, name: plan.name, monthlyPrice: Number(plan.monthly_price), maxUsers: plan.max_users })),
    current: currentPlan ? {
      code: currentPlan.code,
      name: currentPlan.name,
      status: currentStatus,
      currentPeriodEnd: trialExpired ? null : subscription?.current_period_end ?? null,
      cancellationPending: Boolean(subscription?.canceled_at) && currentPeriodIsValid,
      canCancel: Boolean(
        isPaidAsaasPlan &&
        currentPeriodIsValid &&
        subscription?.external_subscription_id &&
        !subscription.canceled_at
      ),
      canReactivateRenewal: Boolean(
        isPaidAsaasPlan &&
        currentPeriodIsValid &&
        subscription?.external_subscription_id &&
        subscription.canceled_at
      ),
      subscriptionSyncPending: Boolean(
        isPaidAsaasPlan &&
        currentPeriodIsValid &&
        !subscription?.external_subscription_id
      ),
    } : null,
  });
}


