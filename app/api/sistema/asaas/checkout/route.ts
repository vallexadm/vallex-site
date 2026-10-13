import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  isAsaasPeriodExpired,
  nextMonthlyAsaasDueDate,
} from "@/lib/server/asaas-billing-dates";

export const runtime = "nodejs";

type CheckoutResponse = {
  id?: string;
  link?: string;
  errors?: Array<{ description?: string }>;
};

function responseError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(request: Request) {
  try {
    const apiUrl = process.env.ASAAS_API_URL?.trim().replace(/\/+$/, "");
    const apiKey = process.env.ASAAS_API_KEY?.trim();
    const environment = process.env.ASAAS_ENV?.trim();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;
    const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const authAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const expectedApiUrl =
      environment === "sandbox"
        ? "https://api-sandbox.asaas.com/v3"
        : environment === "production"
          ? "https://api.asaas.com/v3"
          : null;
    if (!expectedApiUrl || apiUrl !== expectedApiUrl) {
      return responseError(
        "Configure ASAAS_ENV e ASAAS_API_URL para o mesmo ambiente do Asaas.",
        503
      );
    }

    if (!apiUrl || !apiKey || !siteUrl) {
      return responseError(
        "Configure ASAAS_API_URL, ASAAS_API_KEY e NEXT_PUBLIC_SITE_URL no servidor.",
        503
      );
    }

    if (!supabaseUrl || !supabaseServiceKey || !authUrl || !authAnonKey) {
      return responseError("Configuração de autenticação incompleta.", 500);
    }

    const accessToken = request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim();

    if (!accessToken) {
      return responseError("Autenticação necessária.", 401);
    }

    const authClient = createClient(authUrl, authAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data: authData, error: authError } =
      await authClient.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return responseError("Sessão inválida ou expirada.", 401);
    }

    const body = await request.json().catch(() => null);
    const planCode =
      typeof body?.planCode === "string" ? body.planCode.trim() : "";

    if (!["basic", "professional"].includes(planCode)) {
      return responseError("Selecione um plano pago disponível.", 400);
    }

    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .select("id, name, owner_id")
      .eq("owner_id", authData.user.id)
      .maybeSingle();

    if (organizationError) {
      console.error("[ASAAS CHECKOUT] organization lookup failed", organizationError);
      return responseError("Não foi possível consultar sua organização.", 500);
    }
    if (!organization) {
      return responseError("Configure sua área antes de contratar um plano.", 409);
    }

    const { data: plan, error: planError } = await admin
      .from("plans")
      .select("id, code, name, monthly_price, is_active, is_public")
      .eq("code", planCode)
      .eq("is_active", true)
      .eq("is_public", true)
      .maybeSingle();

    if (planError) {
      console.error("[ASAAS CHECKOUT] plan lookup failed", planError);
      return responseError(
        "A tabela de planos ainda não está atualizada. Aplique a migração do Sandbox.",
        503
      );
    }
    if (!plan || Number(plan.monthly_price) <= 0) {
      return responseError("Esse plano não está disponível para contratação.", 404);
    }

    const { data: currentSubscription, error: subscriptionError } = await admin
      .from("organization_subscriptions")
      .select("id, plan_id, status, current_period_end")
      .eq("organization_id", organization.id)
      .maybeSingle();

    if (subscriptionError) {
      console.error("[ASAAS CHECKOUT] subscription lookup failed", subscriptionError);
      return responseError("Não foi possível consultar seu plano atual.", 500);
    }

    const currentSubscriptionIsActive =
      currentSubscription?.status === "active" &&
      (!currentSubscription.current_period_end ||
        !isAsaasPeriodExpired(currentSubscription.current_period_end));

    if (currentSubscriptionIsActive) {
      const { data: currentPlan } = await admin
        .from("plans")
        .select("code")
        .eq("id", currentSubscription.plan_id)
        .maybeSingle();
      if (currentPlan?.code === planCode) {
        return responseError("Este plano já está ativo na sua organização.", 409);
      }
      if (currentPlan?.code && currentPlan.code !== "free") {
        return responseError(
          "Sua organização já possui um plano pago. A troca de plano será liberada em uma próxima etapa.",
          409
        );
      }
    }

    const { data: pendingSession, error: pendingError } = await admin
      .from("asaas_checkout_sessions")
      .select("id, checkout_url")
      .eq("organization_id", organization.id)
      .eq("plan_id", plan.id)
      .eq("status", "pending")
      .not("checkout_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingError) {
      console.error("[ASAAS CHECKOUT] pending checkout lookup failed", pendingError);
      return responseError(
        "Aplique a migração de cobrança do Sandbox no Supabase e tente novamente.",
        503
      );
    }
    if (pendingSession?.checkout_url) {
      return NextResponse.json({
        ok: true,
        checkoutUrl: pendingSession.checkout_url,
        reused: true,
      });
    }

    const externalReference = randomUUID();
    const { data: session, error: sessionError } = await admin
      .from("asaas_checkout_sessions")
      .insert({
        organization_id: organization.id,
        plan_id: plan.id,
        created_by: authData.user.id,
        external_reference: externalReference,
        status: "pending",
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      console.error("[ASAAS CHECKOUT] session insert failed", sessionError);
      return responseError(
        "Não foi possível preparar a contratação. Verifique se a migração foi aplicada.",
        503
      );
    }

    const origin = siteUrl.replace(/\/+$/, "");
    const callbackBase = (process.env.ASAAS_CALLBACK_BASE_URL?.trim() || origin).replace(/\/+$/, "");
    if (!callbackBase.startsWith("https://")) {
      return responseError("Configure uma URL HTTPS pública para o retorno do checkout.", 503);
    }
    const callbackPath = siteUrl.startsWith("https://") ? "/sistema/planos?pagamento=" : "/?pagamento=";
    // Checkout collects the initial payment; this is the first recurring charge.
    // Schedule it one month later to avoid charging again the day after purchase.
    const nextDueDate = nextMonthlyAsaasDueDate();

    const asaasResponse = await fetch(
      apiUrl.replace(/\/+$/, "") + "/checkouts",
      {
        method: "POST",
        headers: {
          access_token: apiKey,
          "Content-Type": "application/json",
          "User-Agent": "VALLEX-ServicoFacil/1.0.0",
        },
        body: JSON.stringify({
          billingTypes: ["CREDIT_CARD"],
          chargeTypes: ["RECURRENT"],
          minutesToExpire: 1440,
          externalReference,
          callback: {
  successUrl: callbackBase + callbackPath + "retorno",
  cancelUrl: callbackBase + callbackPath + "cancelado",
  expiredUrl: callbackBase + callbackPath + "expirado",
},
          items: [
            {
              name: "Plano " + plan.name + " - ServiçoFácil",
              description: `Assinatura mensal do plano ${plan.name} - ServiçoFácil.`,
              quantity: 1,
              value: Number(plan.monthly_price),
            },
          ],
          subscription: {
            cycle: "MONTHLY",
            nextDueDate,
          },
        }),
        cache: "no-store",
      }
    );

    const checkout = (await asaasResponse.json().catch(() => null)) as
      | CheckoutResponse
      | null;

    if (!asaasResponse.ok || !checkout?.id || !checkout.link) {
      await admin
        .from("asaas_checkout_sessions")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", session.id);
      console.error("[ASAAS CHECKOUT] Asaas rejected checkout", {
        status: asaasResponse.status,
        errors: checkout?.errors,
      });
      const detail = checkout?.errors?.map((item) => item.description).filter(Boolean).join("; ");
const message = process.env.NODE_ENV === "development" && detail
  ? "Asaas Sandbox rejeitou o checkout: " + detail
  : "O Asaas não conseguiu criar o checkout. Confira a configuração do Sandbox e tente novamente.";
return responseError(message, 502);
    }

    const { error: updateError } = await admin
      .from("asaas_checkout_sessions")
      .update({
        asaas_checkout_id: checkout.id,
        checkout_url: checkout.link,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    if (updateError) {
      console.error("[ASAAS CHECKOUT] session update failed", updateError);
      return responseError(
        "O checkout foi criado, mas não foi possível registrá-lo. Contate o suporte antes de tentar novamente.",
        500
      );
    }

    return NextResponse.json({
      ok: true,
      checkoutUrl: checkout.link,
      reused: false,
    });
  } catch (error) {
    console.error("[ASAAS CHECKOUT] unexpected error", error);
    return responseError("Não foi possível iniciar o checkout.", 500);
  }
}







