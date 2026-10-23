import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  currentAsaasDueDate,
  isAsaasPeriodExpired,
  nextMonthlyAsaasDueDate,
} from "@/lib/server/asaas-billing-dates";

export const runtime = "nodejs";

type CheckoutResponse = {
  id?: string;
  link?: string;
  errors?: Array<{ description?: string }>;
};

type AsaasCustomer = {
  id?: string;
  errors?: Array<{ description?: string }>;
};

type AsaasSubscription = {
  id?: string;
  errors?: Array<{ description?: string }>;
};

type AsaasPaymentsResponse = {
  data?: Array<{ id?: string; invoiceUrl?: string; bankSlipUrl?: string }>;
  errors?: Array<{ description?: string }>;
};

type BillingType = "CREDIT_CARD" | "PIX" | "BOLETO";

function responseError(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

function isValidCpfCnpj(value: string) {
  if (!/^\d{11}$|^\d{14}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  if (value.length === 11) {
    const digit = (length: number) => {
      const sum = Array.from({ length }, (_, index) =>
        Number(value[index]) * (length + 1 - index)
      ).reduce((total, part) => total + part, 0);
      const remainder = (sum * 10) % 11;
      return remainder === 10 ? 0 : remainder;
    };
    return digit(9) === Number(value[9]) && digit(10) === Number(value[10]);
  }
  const calculateCnpjDigit = (length: number) => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(value[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculateCnpjDigit(12) === Number(value[12]) && calculateCnpjDigit(13) === Number(value[13]);
}

function asaasHeaders(apiKey: string) {
  return {
    access_token: apiKey,
    "Content-Type": "application/json",
    "User-Agent": "VALLEX-ServicoFacil/1.0.0",
  };
}

async function findOrCreateAsaasCustomer(args: {
  apiUrl: string;
  apiKey: string;
  organizationId: string;
  organizationName: string;
  email: string;
  document: string;
}) {
  const { apiUrl, apiKey, organizationId, organizationName, email, document } = args;
  const searchUrl = new URL(`${apiUrl}/customers`);
  searchUrl.searchParams.set("externalReference", organizationId);
  searchUrl.searchParams.set("limit", "100");

  const existingResponse = await fetch(searchUrl, {
    headers: asaasHeaders(apiKey),
    cache: "no-store",
  });
  const existing = (await existingResponse.json().catch(() => null)) as
    | { data?: Array<{ id?: string }> }
    | null;
  if (!existingResponse.ok) {
    throw new Error("Não foi possível localizar o cadastro de cobrança existente no Asaas.");
  }
  if (existingResponse.ok && existing?.data?.[0]?.id) {
    return existing.data[0].id;
  }

  const createResponse = await fetch(`${apiUrl}/customers`, {
    method: "POST",
    headers: asaasHeaders(apiKey),
    body: JSON.stringify({
      name: organizationName,
      email,
      cpfCnpj: document,
      externalReference: organizationId,
    }),
    cache: "no-store",
  });
  const customer = (await createResponse.json().catch(() => null)) as
    | AsaasCustomer
    | null;
  if (!createResponse.ok || !customer?.id) {
    const detail = customer?.errors?.map((item) => item.description).filter(Boolean).join("; ");
    throw new Error(detail || "Não foi possível cadastrar o pagador no Asaas.");
  }
  return customer.id;
}

async function getFirstSubscriptionPayment(args: {
  apiUrl: string;
  apiKey: string;
  subscriptionId: string;
}) {
  const { apiUrl, apiKey, subscriptionId } = args;
  const response = await fetch(
    `${apiUrl}/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=100&offset=0`,
    { headers: asaasHeaders(apiKey), cache: "no-store" }
  );
  const result = (await response.json().catch(() => null)) as
    | AsaasPaymentsResponse
    | null;
  if (!response.ok) {
    throw new Error(
      result?.errors?.map((item) => item.description).filter(Boolean).join("; ") ||
        "Não foi possível consultar a primeira cobrança no Asaas."
    );
  }
  return result?.data?.[0] ?? null;
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
    const billingType =
      typeof body?.billingType === "string" ? body.billingType.trim() : "CREDIT_CARD";
    const document =
      typeof body?.document === "string" ? body.document.replace(/\D/g, "") : "";

    if (!["basic", "professional"].includes(planCode)) {
      return responseError("Selecione um plano pago disponível.", 400);
    }
    if (!["CREDIT_CARD", "PIX", "BOLETO"].includes(billingType)) {
      return responseError("Selecione uma forma de pagamento disponível.", 400);
    }
    if (billingType !== "CREDIT_CARD" && !isValidCpfCnpj(document)) {
      return responseError("Informe um CPF ou CNPJ válido para gerar a cobrança.", 400);
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
      .select("id, plan_id, status, current_period_end, external_customer_id")
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
      .select("id, checkout_url, asaas_subscription_id, asaas_customer_id")
      .eq("organization_id", organization.id)
      .eq("plan_id", plan.id)
      .eq("billing_type", billingType)
      .eq("status", "pending")
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
    if (
      pendingSession?.asaas_subscription_id &&
      billingType !== "CREDIT_CARD"
    ) {
      try {
        const payment = await getFirstSubscriptionPayment({
          apiUrl,
          apiKey,
          subscriptionId: pendingSession.asaas_subscription_id,
        });
        const paymentUrl = payment?.invoiceUrl ?? payment?.bankSlipUrl;
        if (paymentUrl) {
          const { error: savePaymentError } = await admin
            .from("asaas_checkout_sessions")
            .update({ checkout_url: paymentUrl, updated_at: new Date().toISOString() })
            .eq("id", pendingSession.id);
          if (savePaymentError) throw savePaymentError;
          return NextResponse.json({ ok: true, checkoutUrl: paymentUrl, reused: true });
        }
      } catch (error) {
        console.error("[ASAAS CHECKOUT] pending payment lookup failed", error);
      }
      return responseError(
        "O Asaas ainda está preparando a primeira cobrança. Aguarde alguns instantes e tente novamente.",
        409
      );
    }
    if (pendingSession) {
      return responseError(
        "Já existe uma contratação em preparação para este plano. Aguarde alguns instantes antes de tentar novamente.",
        409
      );
    }

    const externalReference = randomUUID();
    const { data: session, error: sessionError } = await admin
      .from("asaas_checkout_sessions")
      .insert({
        organization_id: organization.id,
        plan_id: plan.id,
        created_by: authData.user.id,
        external_reference: externalReference,
        billing_type: billingType,
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

    if (billingType !== "CREDIT_CARD") {
      let customerId = currentSubscription?.external_customer_id ?? null;
      if (!customerId) {
        if (!authData.user.email) {
          await admin.from("asaas_checkout_sessions").update({ status: "failed" }).eq("id", session.id);
          return responseError("Sua conta não possui e-mail para o cadastro de cobrança.", 400);
        }
        try {
          customerId = await findOrCreateAsaasCustomer({
            apiUrl,
            apiKey,
            organizationId: organization.id,
            organizationName: organization.name,
            email: authData.user.email,
            document,
          });
        } catch (error) {
          await admin.from("asaas_checkout_sessions").update({ status: "failed" }).eq("id", session.id);
          const detail = error instanceof Error ? error.message : "Erro no cadastro do pagador.";
          console.error("[ASAAS CHECKOUT] customer creation failed", error);
          return responseError(detail, 502);
        }
      }

      const subscriptionResponse = await fetch(`${apiUrl}/subscriptions`, {
        method: "POST",
        headers: asaasHeaders(apiKey),
        body: JSON.stringify({
          customer: customerId,
          billingType,
          value: Number(plan.monthly_price),
          cycle: "MONTHLY",
          nextDueDate: currentAsaasDueDate(),
          description: `Plano ${plan.name} - ServiçoFácil (assinatura mensal)`,
          externalReference,
        }),
        cache: "no-store",
      });
      const subscription = (await subscriptionResponse.json().catch(() => null)) as
        | AsaasSubscription
        | null;

      if (!subscriptionResponse.ok || !subscription?.id) {
        await admin.from("asaas_checkout_sessions").update({ status: "failed" }).eq("id", session.id);
        const detail = subscription?.errors?.map((item) => item.description).filter(Boolean).join("; ");
        console.error("[ASAAS CHECKOUT] Asaas rejected manual-payment subscription", {
          status: subscriptionResponse.status,
          errors: subscription?.errors,
        });
        const message = process.env.NODE_ENV === "development" && detail
          ? "Asaas rejeitou a assinatura: " + detail
          : "O Asaas não conseguiu criar a assinatura. Confira a configuração e tente novamente.";
        return responseError(message, 502);
      }

      const { error: subscriptionSaveError } = await admin
        .from("asaas_checkout_sessions")
        .update({
          asaas_customer_id: customerId,
          asaas_subscription_id: subscription.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      if (subscriptionSaveError) {
        console.error("[ASAAS CHECKOUT] subscription mapping save failed", subscriptionSaveError);
        await fetch(`${apiUrl}/subscriptions/${encodeURIComponent(subscription.id)}`, {
          method: "DELETE",
          headers: asaasHeaders(apiKey),
          cache: "no-store",
        }).catch(() => undefined);
        return responseError(
          "Não foi possível registrar a assinatura com segurança. Ela foi cancelada no Asaas; tente novamente.",
          500
        );
      }

      let payment: Awaited<ReturnType<typeof getFirstSubscriptionPayment>> = null;
      try {
        payment = await getFirstSubscriptionPayment({
          apiUrl,
          apiKey,
          subscriptionId: subscription.id,
        });
      } catch (error) {
        console.error("[ASAAS CHECKOUT] first subscription payment lookup failed", error);
      }
      const paymentUrl = payment?.invoiceUrl ?? payment?.bankSlipUrl;
      if (!paymentUrl) {
        return responseError(
          "A assinatura foi criada e o Asaas está preparando a primeira cobrança. Aguarde alguns instantes e tente novamente.",
          409
        );
      }

      const { error: paymentUrlSaveError } = await admin
        .from("asaas_checkout_sessions")
        .update({ checkout_url: paymentUrl, updated_at: new Date().toISOString() })
        .eq("id", session.id);
      if (paymentUrlSaveError) {
        console.error("[ASAAS CHECKOUT] invoice URL save failed", paymentUrlSaveError);
        return responseError("A cobrança foi criada, mas não foi possível registrar o link. Tente novamente.", 500);
      }

      return NextResponse.json({ ok: true, checkoutUrl: paymentUrl, reused: false });
    }

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
          billingTypes: [billingType],
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







