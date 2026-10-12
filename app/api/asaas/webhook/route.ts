import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type AsaasEvent = {
  id?: string;
  event?: string;
  checkout?: {
    id?: string;
    status?: string;
    customer?: string | null;
  };
  subscription?: {
    id?: string;
    customer?: string | null;
    externalReference?: string | null;
    status?: string;
  };
};

function validToken(received: string | null, expectedHash: string) {
  if (!received || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false;

  const receivedHash = createHash("sha256").update(received, "utf8").digest();
  const expectedHashBytes = Buffer.from(expectedHash, "hex");
  return timingSafeEqual(receivedHash, expectedHashBytes);
}

async function activatePaidPlan(
  admin: SupabaseClient<any>,
  session: {
    organization_id: string;
    plan_id: string;
    asaas_customer_id: string | null;
    asaas_subscription_id: string | null;
  }
) {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const values = {
    plan_id: session.plan_id,
    status: "active",
    billing_provider: "asaas",
    started_at: now.toISOString(),
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    canceled_at: null,
    external_customer_id: session.asaas_customer_id,
    external_subscription_id: session.asaas_subscription_id,
  };

  const { data: existing, error: readError } = await admin
    .from("organization_subscriptions")
    .select("id")
    .eq("organization_id", session.organization_id)
    .maybeSingle();

  if (readError) throw readError;

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

export async function POST(request: Request) {
  const expectedTokenHash = process.env.ASAAS_WEBHOOK_TOKEN_SHA256?.trim();
  const receivedToken = request.headers.get("asaas-access-token");

  if (!expectedTokenHash || !/^[a-f0-9]{64}$/i.test(expectedTokenHash)) {
    return NextResponse.json(
      { ok: false, message: "Hash do token do webhook ASAAS não configurado corretamente." },
      { status: 503 }
    );
  }
  const tokenMatches = validToken(receivedToken, expectedTokenHash);
  if (!tokenMatches) {
    console.warn("[ASAAS WEBHOOK] authentication rejected", {
      tokenHeaderPresent: Boolean(receivedToken),
      tokenHashMatches: tokenMatches,
    });
    return NextResponse.json({ ok: false }, { status: 401 });
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
    if (event.event.startsWith("CHECKOUT_") && event.checkout?.id) {
      const { data: session, error } = await admin
        .from("asaas_checkout_sessions")
        .select(
          "id, organization_id, plan_id, status, asaas_customer_id, asaas_subscription_id"
        )
        .eq("asaas_checkout_id", event.checkout.id)
        .maybeSingle();

      if (error) throw error;

      if (session) {
        const customerId =
          event.checkout.customer ?? session.asaas_customer_id ?? null;

        if (event.event === "CHECKOUT_CREATED") {
          const { error: updateError } = await admin
            .from("asaas_checkout_sessions")
            .update({
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
              asaas_customer_id: customerId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", session.id);
          if (updateError) throw updateError;

          await activatePaidPlan(admin, {
            organization_id: session.organization_id,
            plan_id: session.plan_id,
            asaas_customer_id: customerId,
            asaas_subscription_id: session.asaas_subscription_id,
          });
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
      let query = admin
        .from("asaas_checkout_sessions")
        .select("id")
        .eq("status", "paid");

      if (event.subscription.externalReference) {
        query = query.eq(
          "external_reference",
          event.subscription.externalReference
        );
      } else if (event.subscription.customer) {
        query = query
          .eq("asaas_customer_id", event.subscription.customer)
          .order("created_at", { ascending: false })
          .limit(1);
      }

      const { data: session, error } = await query.maybeSingle();
      if (error) throw error;

      if (session) {
        const { error: updateError } = await admin
          .from("asaas_checkout_sessions")
          .update({
            asaas_subscription_id: event.subscription.id,
            asaas_customer_id: event.subscription.customer ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", session.id);
        if (updateError) throw updateError;

        const { data: linkedSession, error: linkedError } = await admin
          .from("asaas_checkout_sessions")
          .select("organization_id, plan_id, asaas_customer_id, asaas_subscription_id")
          .eq("id", session.id)
          .single();
        if (linkedError) throw linkedError;
        await activatePaidPlan(admin, linkedSession);
      }
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