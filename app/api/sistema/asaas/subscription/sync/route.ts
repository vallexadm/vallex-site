import { NextResponse } from "next/server";
import { getAsaasSubscriptionActionContext } from "@/lib/server/asaas-subscription-actions";

export const runtime = "nodejs";

const fail = (message: string, status: number) =>
  NextResponse.json({ ok: false, message }, { status });

type AsaasPayment = {
  subscription?: string | null;
  customer?: string | null;
};

type AsaasSubscription = {
  id?: string;
  customer?: string | null;
  value?: number | null;
  cycle?: string | null;
  billingType?: string | null;
  status?: string | null;
  nextDueDate?: string | null;
  description?: string | null;
};

type AsaasList<T> = {
  data?: T[];
};

async function asaasGet<T>(url: string, apiKey: string): Promise<T | null> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      access_token: apiKey,
      Accept: "application/json",
      "User-Agent": "VALLEX-ServicoFacil/1.0.0",
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("[ASAAS SUBSCRIPTION] reconciliation query failed", {
      status: response.status,
    });
    throw new Error("ASAAS_RECONCILIATION_QUERY_FAILED");
  }

  return body as T | null;
}

async function updateAsaasSubscriptionDescription(
  subscriptionId: string,
  planName: string,
  apiUrl: string,
  apiKey: string
) {
  const description = `Plano ${planName.trim()} - ServiçoFácil (assinatura mensal)`;
  const url = `${apiUrl}/subscriptions/${encodeURIComponent(subscriptionId)}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      access_token: apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "VALLEX-ServicoFacil/1.0.0",
    },
    body: JSON.stringify({ description, updatePendingPayments: true }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("[ASAAS SUBSCRIPTION] description update failed", {
      status: response.status,
    });
    throw new Error("ASAAS_DESCRIPTION_UPDATE_FAILED");
  }

  const verification = await asaasGet<AsaasSubscription>(url, apiKey);
  if (verification?.description !== description) {
    console.error("[ASAAS SUBSCRIPTION] description verification failed", {
      updateReturnedDescription:
        body && typeof body.description === "string" ? body.description : null,
      confirmed: Boolean(verification),
    });
    throw new Error("ASAAS_DESCRIPTION_NOT_CONFIRMED");
  }

  return description;
}

export async function POST(request: Request) {
  try {
    const result = await getAsaasSubscriptionActionContext(request);
    if (!result.ok) return fail(result.message, result.status);

    const { admin, apiKey, apiUrl, organizationId } = result.context;
    const { data: current, error: currentError } = await admin
      .from("organization_subscriptions")
      .select(
        "id, plan_id, status, billing_provider, external_subscription_id, current_period_end"
      )
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (currentError) {
      console.error("[ASAAS SUBSCRIPTION] reconciliation lookup failed", currentError);
      return fail("Não foi possível consultar sua assinatura.", 500);
    }
    if (!current || current.status !== "active" || current.billing_provider !== "asaas") {
      return fail("Não há um plano Asaas ativo para sincronizar.", 409);
    }

    const { data: plan, error: planError } = await admin
      .from("plans")
      .select("monthly_price, name")
      .eq("id", current.plan_id)
      .maybeSingle();
    if (planError || !plan) {
      console.error("[ASAAS SUBSCRIPTION] plan lookup failed", planError);
      return fail("Não foi possível consultar o plano atual.", 500);
    }

    if (current.external_subscription_id) {
      const description = await updateAsaasSubscriptionDescription(
        current.external_subscription_id,
        plan.name,
        apiUrl,
        apiKey
      );
      return NextResponse.json({
        ok: true,
        alreadySynced: true,
        descriptionUpdated: true,
        description,
      });
    }

    const { data: session, error: sessionError } = await admin
      .from("asaas_checkout_sessions")
      .select("id, external_reference, asaas_checkout_id, asaas_customer_id")
      .eq("organization_id", organizationId)
      .eq("plan_id", current.plan_id)
      .eq("status", "paid")
      .not("asaas_checkout_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionError) {
      console.error("[ASAAS SUBSCRIPTION] paid checkout lookup failed", sessionError);
      return fail("Não foi possível localizar o checkout pago.", 500);
    }
    if (!session?.asaas_checkout_id) {
      return fail("Não localizamos o checkout pago que originou este plano.", 409);
    }

    const paymentsUrl = new URL(`${apiUrl}/payments`);
    paymentsUrl.searchParams.set("checkoutSession", session.asaas_checkout_id);
    paymentsUrl.searchParams.set("limit", "100");
    paymentsUrl.searchParams.set("offset", "0");

    const payments = await asaasGet<AsaasList<AsaasPayment>>(
      paymentsUrl.toString(),
      apiKey
    );
    const paymentCustomerIds = [
      ...new Set(
        (payments?.data ?? [])
          .map((payment) => payment.customer)
          .filter((customer): customer is string => typeof customer === "string" && customer.length > 0)
      ),
    ];
    if (
      session.asaas_customer_id &&
      paymentCustomerIds.some((customer) => customer !== session.asaas_customer_id)
    ) {
      return fail(
        "O cliente informado pelo pagamento não corresponde ao checkout. A sincronização foi interrompida por segurança.",
        409
      );
    }
    if (paymentCustomerIds.length > 1) {
      return fail(
        "O Asaas retornou mais de um cliente para o checkout. A sincronização foi interrompida para evitar vincular a assinatura errada.",
        409
      );
    }
    const paymentCandidates = (payments?.data ?? []).filter(
      (payment): payment is AsaasPayment & { subscription: string } =>
        typeof payment.subscription === "string" && payment.subscription.length > 0
    );
    const paymentSubscriptionIds = [
      ...new Set(paymentCandidates.map((payment) => payment.subscription)),
    ];

    let subscriptionId: string | null = null;
    let customerId: string | null =
      session.asaas_customer_id ?? paymentCustomerIds[0] ?? null;

    if (paymentSubscriptionIds.length === 1) {
      subscriptionId = paymentSubscriptionIds[0];
      const matchingPayment = paymentCandidates.find(
        (payment) => payment.subscription === subscriptionId
      );
      customerId = matchingPayment?.customer ?? customerId;
    } else if (paymentSubscriptionIds.length > 1) {
      return fail(
        "O Asaas retornou mais de uma assinatura para o checkout. A sincronização foi interrompida para evitar vincular a assinatura errada.",
        409
      );
    }

    if (!subscriptionId && session.external_reference) {
      const subscriptionsUrl = new URL(`${apiUrl}/subscriptions`);
      subscriptionsUrl.searchParams.set("externalReference", session.external_reference);
      subscriptionsUrl.searchParams.set("limit", "100");
      subscriptionsUrl.searchParams.set("offset", "0");
      const subscriptions = await asaasGet<
        AsaasList<{ id?: string; customer?: string | null }>
      >(subscriptionsUrl.toString(), apiKey);
      const candidates = (subscriptions?.data ?? []).filter(
        (subscription): subscription is { id: string; customer?: string | null } =>
          typeof subscription.id === "string" && subscription.id.length > 0
      );

      if (candidates.length === 1) {
        subscriptionId = candidates[0].id;
        customerId = candidates[0].customer ?? customerId;
      } else if (candidates.length > 1) {
        return fail(
          "O Asaas retornou mais de uma assinatura para a referência do checkout. A sincronização foi interrompida para evitar vincular a assinatura errada.",
          409
        );
      }
    }

    if (!subscriptionId && customerId) {
      const customerSubscriptionsUrl = new URL(`${apiUrl}/subscriptions`);
      customerSubscriptionsUrl.searchParams.set("customer", customerId);
      customerSubscriptionsUrl.searchParams.set("limit", "100");
      customerSubscriptionsUrl.searchParams.set("offset", "0");
      const subscriptions = await asaasGet<AsaasList<AsaasSubscription>>(
        customerSubscriptionsUrl.toString(),
        apiKey
      );
      const planAmountInCents = Math.round(Number(plan.monthly_price) * 100);
      const candidates = (subscriptions?.data ?? []).filter(
        (subscription): subscription is AsaasSubscription & { id: string } =>
          typeof subscription.id === "string" &&
          subscription.id.length > 0 &&
          subscription.customer === customerId &&
          subscription.status === "ACTIVE" &&
          subscription.cycle === "MONTHLY" &&
          subscription.billingType === "CREDIT_CARD" &&
          typeof subscription.value === "number" &&
          Math.round(subscription.value * 100) === planAmountInCents
      );

      let matchingCandidates = candidates;
      if (candidates.length > 1 && current.current_period_end) {
        const currentPeriodEndDate = current.current_period_end.slice(0, 10);
        const matchingDueDate = candidates.filter(
          (subscription) => subscription.nextDueDate?.slice(0, 10) === currentPeriodEndDate
        );
        if (matchingDueDate.length === 1) matchingCandidates = matchingDueDate;
      }

      if (matchingCandidates.length === 1) {
        subscriptionId = matchingCandidates[0].id;
        customerId = matchingCandidates[0].customer ?? customerId;
      } else if (matchingCandidates.length > 1) {
        return fail(
          "O Asaas retornou mais de uma assinatura compatível para este cliente. A sincronização foi interrompida para evitar vincular a assinatura errada.",
          409
        );
      }
    }

    if (!subscriptionId) {
      return fail(
        "O Asaas ainda não retornou a assinatura vinculada a este checkout. Nenhuma nova cobrança foi criada; tente sincronizar novamente em instantes.",
        409
      );
    }
    if (
      session.asaas_customer_id &&
      customerId &&
      session.asaas_customer_id !== customerId
    ) {
      return fail(
        "O cliente informado pelo Asaas não corresponde ao checkout pago. A sincronização foi interrompida por segurança.",
        409
      );
    }

    const { error: sessionUpdateError } = await admin
      .from("asaas_checkout_sessions")
      .update({
        asaas_subscription_id: subscriptionId,
        asaas_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    if (sessionUpdateError) {
      console.error("[ASAAS SUBSCRIPTION] checkout link update failed", sessionUpdateError);
      return fail("Não foi possível salvar a assinatura localizada.", 500);
    }

    const { error: subscriptionUpdateError } = await admin
      .from("organization_subscriptions")
      .update({
        external_subscription_id: subscriptionId,
        external_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", current.id)
      .is("external_subscription_id", null);

    if (subscriptionUpdateError) {
      console.error(
        "[ASAAS SUBSCRIPTION] local subscription link update failed",
        subscriptionUpdateError
      );
      return fail("A assinatura foi localizada, mas não foi possível atualizar o plano.", 500);
    }

    const description = await updateAsaasSubscriptionDescription(
      subscriptionId,
      plan.name,
      apiUrl,
      apiKey
    );

    return NextResponse.json({
      ok: true,
      synchronized: true,
      descriptionUpdated: true,
      description,
    });
  } catch (error) {
    console.error("[ASAAS SUBSCRIPTION] reconciliation failed", error);
    if (error instanceof Error && error.message === "ASAAS_DESCRIPTION_UPDATE_FAILED") {
      return fail("O Asaas não aceitou a atualização da descrição. Tente novamente.", 502);
    }
    if (error instanceof Error && error.message === "ASAAS_DESCRIPTION_NOT_CONFIRMED") {
      return fail("O Asaas recebeu a atualização, mas ainda não confirmou a descrição. Tente novamente em instantes.", 502);
    }
    return fail("Não foi possível sincronizar a assinatura agora.", 502);
  }
}
