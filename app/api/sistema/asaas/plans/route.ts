import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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
    admin.from("organization_subscriptions").select("plan_id, status, current_period_end").eq("organization_id", organization.id).maybeSingle(),
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
  return NextResponse.json({ ok: true,
    plans: (plans ?? []).map((plan) => ({ id: plan.id, code: plan.code, name: plan.name, monthlyPrice: Number(plan.monthly_price), maxUsers: plan.max_users })),
    current: currentPlan ? { code: currentPlan.code, name: currentPlan.name, status: subscription?.status ?? "active", currentPeriodEnd: subscription?.current_period_end ?? null } : null,
  });
}


