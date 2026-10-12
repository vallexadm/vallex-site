import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  asaasPeriodEndFromDueDate,
  isAsaasPeriodExpired,
  nextMonthlyDueDateAfter,
} from "@/lib/server/asaas-billing-dates";
import { matchesAsaasWebhookToken } from "@/lib/server/asaas-webhook-auth";

export const runtime = "nodejs";

type AsaasEvent = {
  id?: string;
  event?: string;
  checkout?: {
    id?: string;
    status?: string;
    customer?: string | null;
    externalReference?: string | null;
    items?: Array<{ name?: string }>;
    subscription?: {
      nextDueDate?: string | null;
    } | null;
  };
  subscription?: {
    id?: string;
    customer?: string | null;
    externalReference?: string | null;
    status?: string;
    nextDueDate?: string | null;
  };
  payment?: {
    id?: string;
    subscription?: string | null;
    customer?: string | null;
    externalReference?: string | null;
    dueDate?: string | null;
  };
};

type CheckoutSession = {
  id: string;
  organization_id: string;
  plan_id: string;
  status: string;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  asaas_checkout_id: string | null;
};

function periodEndFrom(nextDueDate?: string | null) {
  return asaasPeriodEndFromDueDate(nextDueDate);
}

async function findCheckoutSession(
  admin: SupabaseClient,
  checkout: NonNullable<AsaasEvent["checkout"]>
) {
  if (checkout.id) {
    const { data, error } = await admin
      .from("asaas_checkout_sessions")
      .select(
        "id, organization_id, plan_id, status, asaas_customer_id, asaas_subscription_id, asaas_checkout_id"
      )
      .eq("asaas_checkout_id", checkout.id)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as CheckoutSession;
  }

  if (checkout.externalReference) {
    const { data, error } = await admin
      .from("asaas_checkout_sessions")
      .select(
        "id, organization_id, plan_id, status, asaas_customer_id, asaas_subscription_id, asaas_checkout_id"
      )
      .eq("external_reference", checkout.externalReference)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as CheckoutSession;
  }

  return null;
}

async function findSubscriptionSession(
  admin: SupabaseClient,
  subscription: NonNullable<AsaasEvent["subscription"]>
) {
  if (subscription.externalReference) {
    const { data, error } = await admin
      .from("asaas_checkout_sessions")
      .select(
        "id, organization_id, plan_id, status, asaas_customer_id, asaas_subscription_id, asaas_checkout_id"
      )
      .eq("external_reference", subscription.externalReference)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as CheckoutSession;
  } else if (subscription.customer) {
    const { data, error } = await admin
      .from("asaas_checkout_sessions")
      .select(
        "id, organization_id, plan_id, status, asaas_customer_id, asaas_subscription_id, asaas_checkout_id"
      )
      .eq("asaas_customer_id", subscription.customer)
      .in("status", ["pending", "paid"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as CheckoutSession;
  }

  return null;
}

async function findPaymentSession(
  admin: SupabaseClient,
  payment: NonNullable<AsaasEvent["payment"]>
) {
  if (payment.subscription) {
    const { data, error } = await admin
      .from("asaas_checkout_sessions")
      .select(
        "id, organization_id, plan_id, status, asaas_customer_id, asaas_subscription_id, asaas_checkout_id"
      )
      .eq("asaas_subscription_id", payment.subscription)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as CheckoutSession;
  }

  if (payment.externalReference) {
    const { data, error } = await admin
      .from("asaas_checkout_sessions")
      .select(
        "id, organization_id, plan_id, status, asaas_customer_id, asaas_subscription_id, asaas_checkout_id"
      )
      .eq("external_reference", payment.externalReference)
      .maybeSingle();

    if (error) throw error;
    if (data) return data as CheckoutSession;
  }

  return null;
}

function isVallexPlanCheckout(checkout: NonNullable<AsaasEvent["checkout"]>) {
  return checkout.items?.some((item) =>
    item.name?.includes("ServiçoFácil")
  ) ?? false;
}

async function activatePaidPlan(
  admin: SupabaseClient,
  session: CheckoutSession,
  nextDueDate?: string | null
) {
  const now = new Date();
  const { data: existing, error: readError } = await admin
    .from("organization_subscriptions")
    .select(
      "id, plan_id, status, billing_provider, started_at, current_period_start, current_period_end, external_customer_id, external_subscription_id"
    )
    .eq("organization_id", session.organization_id)
    .maybeSingle();

  if (readError) throw readError;

  const existingPeriodEnd = existing?.current_period_end
    ? Date.parse(existing.current_period_end)
    : Number.NaN;
  const keepCurrentPeriod =
    existing?.plan_id === session.plan_id &&
    existing.status === "active" &&
    existing.billing_provider === "asaas" &&
    typeof existing.current_period_end === "string" &&
    Number.isFinite(existingPeriodEnd) &&
    !isAsaasPeriodExpired(existing.current_period_end, now);

  const values = {
    plan_id: session.plan_id,
    status: "active",
    billing_provider: "asaas",
    started_at: keepCurrentPeriod
      ? existing.started_at ?? now.toISOString()
      : now.toISOString(),
    current_period_start: keepCurrentPeriod
      ? existing.current_period_start ?? now.toISOString()
      : now.toISOString(),
    current_period_end: keepCurrentPeriod
      ? existing.current_period_end
      : periodEndFrom(nextDueDate),
    canceled_at: null,
    external_customer_id:
      session.asaas_customer_id ??
      (keepCurrentPeriod ? existing.external_customer_id : null),
    external_subscription_id:
      session.asaas_subscription_id ??
      (keepCurrentPeriod ? existing.external_subscription_id : null),
  };

  if (existing) {
    const { error } = await admin
      .from("organization_subscriptions")
      .update(values)
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await admin
      .from("organization_subscriptions")
      .insert({ organization_id: session.organization_id, ...values });
    if (error) throw error;
  }
}

async function linkAsaasSubscription(
  admin: SupabaseClient,
  session: CheckoutSession,
  subscription: NonNullable<AsaasEvent["subscription"]>
) {
  if (
    session.asaas_subscription_id &&
    session.asaas_subscription_id !== subscription.id
  ) {
    throw new Error("ASAAS_SUBSCRIPTION_ID_DOES_NOT_MATCH_EXTERNAL_REFERENCE");
  }

  const customerId = subscription.customer ?? session.asaas_customer_id;
  const { error } = await admin
    .from("asaas_checkout_sessions")
    .update({
      asaas_subscription_id: subscription.id,
      asaas_customer_id: customerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  if (error) throw error;

  const linkedSession: CheckoutSession = {
    ...session,
    asaas_subscription_id: subscription.id ?? session.asaas_subscription_id,
    asaas_customer_id: customerId,
  };

  // The subscription may be created before the checkout-paid event arrives.
  // Save its identifiers now; only the paid checkout is allowed to activate access.
  if (session.status === "paid") {
    const { data: current, error: readError } = await admin
      .from("organization_subscriptions")
      .select("id, plan_id")
      .eq("organization_id", session.organization_id)
      .maybeSingle();

    if (readError) throw readError;

    if (!current) {
      await activatePaidPlan(admin, linkedSession, subscription.nextDueDate);
    } else if (current.plan_id === session.plan_id) {
      const { error: linkError } = await admin
        .from("organization_subscriptions")
        .update({
          external_customer_id: customerId,
          external_subscription_id: subscription.id,
        })
        .eq("id", current.id);

      if (linkError) throw linkError;
    }
  }
}

async function extendPaidSubscriptionPeriod(
  admin: SupabaseClient,
  payment: NonNullable<AsaasEvent["payment"]>
) {
  if (!payment.subscription || !payment.dueDate) return;

  const session = await findPaymentSession(admin, payment);
  if (!session || session.status !== "paid") return;
  if (
    session.asaas_subscription_id &&
    session.asaas_subscription_id !== payment.subscription
  ) {
    throw new Error("PAYMENT_SUBSCRIPTION_ID_DOES_NOT_MATCH_CHECKOUT");
  }

  const nextDueDate = nextMonthlyDueDateAfter(payment.dueDate);
  if (!nextDueDate) {
    console.warn("[ASAAS WEBHOOK] payment has an invalid due date", {
      paymentIdPresent: Boolean(payment.id),
    });
    return;
  }

  const customerId = payment.customer ?? session.asaas_customer_id;
  if (!session.asaas_subscription_id) {
    const { error } = await admin
      .from("asaas_checkout_sessions")
      .update({
        asaas_subscription_id: payment.subscription,
        asaas_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.id);

    if (error) throw error;
  }

  const { data: current, error: readError } = await admin
    .from("organization_subscriptions")
    .select("id, plan_id, status, current_period_end, external_subscription_id")
    .eq("organization_id", session.organization_id)
    .maybeSingle();

  if (readError) throw readError;
  if (!current) {
    await activatePaidPlan(
      admin,
      {
        ...session,
        asaas_subscription_id: payment.subscription,
        asaas_customer_id: customerId,
      },
      nextDueDate
    );
    return;
  }

  if (
    current.plan_id !== session.plan_id ||
    current.status !== "active" ||
    (current.external_subscription_id &&
      current.external_subscription_id !== payment.subscription)
  ) {
    return;
  }

  const nextPeriodEnd = asaasPeriodEndFromDueDate(nextDueDate);
  const currentPeriodEnd = current.current_period_end
    ? Date.parse(current.current_period_end)
    : Number.NaN;
  if (
    Number.isFinite(currentPeriodEnd) &&
    Date.parse(nextPeriodEnd) <= currentPeriodEnd
  ) {
    return;
  }

  const { error: updateError } = await admin
    .from("organization_subscriptions")
    .update({
      current_period_end: nextPeriodEnd,
      external_customer_id: customerId,
      external_subscription_id: payment.subscription,
    })
    .eq("id", current.id);

  if (updateError) throw updateError;
}

export async function POST(request: Request) {
  const expectedTokenHash = process.env.ASAAS_WEBHOOK_TOKEN_SHA256?.trim();
  const receivedToken = request.headers.get("asaas-access-token");

  if (!expectedTokenHash || !/^[a-f0-9]{64}$/i.test(expectedTokenHash)) {
    return NextResponse.json(
      { ok: false, message: "Hash do token do webhook ASAAS não configurado corretamente." },
      { status: 503 }
    );
  }
  const tokenMatches = matchesAsaasWebhookToken(receivedToken, expectedTokenHash);
  if (!tokenMatches) {
    const failureCode = receivedToken
      ? "ASAAS_WEBHOOK_TOKEN_MISMATCH"
      : "ASAAS_WEBHOOK_TOKEN_HEADER_MISSING";
    console.warn("[ASAAS WEBHOOK] authentication rejected", {
      tokenHeaderPresent: Boolean(receivedToken),
      tokenHashMatches: tokenMatches,
      failureCode,
    });
    return NextResponse.json(
      {
        ok: false,
        code: failureCode,
        message: receivedToken
          ? "O token recebido pelo webhook não corresponde ao hash configurado."
          : "O cabeçalho de autenticação do Asaas não foi recebido.",
      },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { ok: false, message: "Configuração do servidor incompleta." },
      { status: 503 }
    );
  }

  const event = (await request.json().catch(() => null)) as AsaasEvent | null;
  if (!event?.id || !event.event) {
    return NextResponse.json(
      { ok: false, message: "Evento inválido." },
      { status: 400 }
    );
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const eventPayload = event as unknown as Record<string, unknown>;
  const { data: previousEvent, error: previousError } = await admin
    .from("asaas_webhook_events")
    .select("event_id, processed_at")
    .eq("event_id", event.id)
    .maybeSingle();

  if (previousError) {
    console.error("[ASAAS WEBHOOK] event lookup failed", previousError);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  if (previousEvent?.processed_at) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (previousEvent) {
    const { error } = await admin
      .from("asaas_webhook_events")
      .update({
        event_name: event.event,
        payload: eventPayload,
        process_error: null,
      })
      .eq("event_id", event.id);
    if (error) {
      console.error("[ASAAS WEBHOOK] event retry update failed", error);
      return NextResponse.json({ ok: false }, { status: 503 });
    }
  } else {
    const { error } = await admin.from("asaas_webhook_events").insert({
      event_id: event.id,
      event_name: event.event,
      payload: eventPayload,
    });
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      console.error("[ASAAS WEBHOOK] event insert failed", error);
      return NextResponse.json({ ok: false }, { status: 503 });
    }
  }

  try {
    if (event.event.startsWith("CHECKOUT_") && event.checkout) {
      const session = await findCheckoutSession(admin, event.checkout);
      if (
        !session &&
        event.event === "CHECKOUT_PAID" &&
        isVallexPlanCheckout(event.checkout)
      ) {
        throw new Error("VALLEX_PAID_CHECKOUT_SESSION_NOT_FOUND");
      }

      if (session) {
        if (
          event.checkout.id &&
          session.asaas_checkout_id &&
          session.asaas_checkout_id !== event.checkout.id
        ) {
          throw new Error("CHECKOUT_ID_DOES_NOT_MATCH_EXTERNAL_REFERENCE");
        }

        const customerId =
          event.checkout.customer ?? session.asaas_customer_id ?? null;

        if (event.event === "CHECKOUT_CREATED") {
          const { error: updateError } = await admin
            .from("asaas_checkout_sessions")
            .update({
              asaas_checkout_id: event.checkout.id ?? session.asaas_checkout_id,
              asaas_customer_id: customerId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", session.id);
          if (updateError) throw updateError;
        } else if (event.event === "CHECKOUT_PAID") {
          const { error: updateError } = await admin
            .from("asaas_checkout_sessions")
            .update({
              status: "paid",
              asaas_checkout_id: event.checkout.id ?? session.asaas_checkout_id,
              asaas_customer_id: customerId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", session.id);
          if (updateError) throw updateError;

          await activatePaidPlan(admin, {
            ...session,
            status: "paid",
            asaas_checkout_id: event.checkout.id ?? session.asaas_checkout_id,
            asaas_customer_id: customerId,
          }, event.checkout.subscription?.nextDueDate);
        } else if (
          event.event === "CHECKOUT_CANCELED" ||
          event.event === "CHECKOUT_EXPIRED"
        ) {
          const { error: updateError } = await admin
            .from("asaas_checkout_sessions")
            .update({
              status:
                event.event === "CHECKOUT_CANCELED" ? "canceled" : "expired",
              updated_at: new Date().toISOString(),
            })
            .eq("id", session.id)
            .eq("status", "pending");
          if (updateError) throw updateError;
        }
      }
    }

    if (event.event === "SUBSCRIPTION_CREATED" && event.subscription?.id) {
      const session = await findSubscriptionSession(admin, event.subscription);
      if (session) {
        await linkAsaasSubscription(admin, session, event.subscription);
      }
    }

    if (
      (event.event === "PAYMENT_CONFIRMED" ||
        event.event === "PAYMENT_RECEIVED") &&
      event.payment
    ) {
      await extendPaidSubscriptionPeriod(admin, event.payment);
    }

    const { error: markProcessedError } = await admin
      .from("asaas_webhook_events")
      .update({
        processed_at: new Date().toISOString(),
        process_error: null,
      })
      .eq("event_id", event.id);
    if (markProcessedError) throw markProcessedError;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ASAAS WEBHOOK] processing failed", {
      eventId: event.id,
      eventName: event.event,
      error,
    });
    await admin
      .from("asaas_webhook_events")
      .update({
        process_error: "PROCESSING_FAILED",
      })
      .eq("event_id", event.id);

    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
