import { NextResponse } from "next/server";
import { getAsaasSubscriptionActionContext } from "@/lib/server/asaas-subscription-actions";
import { isAsaasPeriodExpired } from "@/lib/server/asaas-billing-dates";

export const runtime = "nodejs";

const fail = (message: string, status: number) =>
  NextResponse.json({ ok: false, message }, { status });

export async function POST(request: Request) {
  try {
    const result = await getAsaasSubscriptionActionContext(request);
    if (!result.ok) return fail(result.message, result.status);

    const { admin, apiKey, apiUrl, organizationId } = result.context;
    const { data: subscription, error: subscriptionError } = await admin
      .from("organization_subscriptions")
      .select(
        "id, status, billing_provider, current_period_end, canceled_at, external_subscription_id"
      )
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (subscriptionError) {
      console.error("[ASAAS SUBSCRIPTION] reactivation lookup failed", subscriptionError);
      return fail("Não foi possível consultar sua assinatura.", 500);
    }
    if (!subscription || subscription.status !== "active" || !subscription.canceled_at) {
      return fail("Não há uma renovação cancelada para reativar.", 409);
    }
    if (subscription.billing_provider !== "asaas") {
      return fail("Este plano não possui uma renovação do Asaas para reativar.", 409);
    }
    if (!subscription.external_subscription_id) {
      return fail("Não localizamos o ID da assinatura no Asaas.", 409);
    }
    if (
      !subscription.current_period_end ||
      isAsaasPeriodExpired(subscription.current_period_end)
    ) {
      return fail("O período pago já terminou. Contrate novamente para reativar o plano.", 409);
    }

    const nextDueDate = new Date(subscription.current_period_end)
      .toISOString()
      .slice(0, 10);
    const asaasResponse = await fetch(
      `${apiUrl}/subscriptions/${encodeURIComponent(subscription.external_subscription_id)}`,
      {
        method: "PUT",
        headers: {
          access_token: apiKey,
          "Content-Type": "application/json",
          "User-Agent": "VALLEX-ServicoFacil/1.0.0",
        },
        body: JSON.stringify({ status: "ACTIVE", nextDueDate }),
        cache: "no-store",
      }
    );
    const asaasBody = await asaasResponse.json().catch(() => null);
    if (!asaasResponse.ok) {
      console.error("[ASAAS SUBSCRIPTION] reactivation rejected", {
        status: asaasResponse.status,
        errors: asaasBody?.errors,
      });
      return fail("O Asaas não confirmou a reativação da renovação.", 502);
    }

    const { error: updateError } = await admin
      .from("organization_subscriptions")
      .update({ canceled_at: null, updated_at: new Date().toISOString() })
      .eq("id", subscription.id);

    if (updateError) {
      console.error("[ASAAS SUBSCRIPTION] local reactivation update failed", updateError);
      return fail(
        "O Asaas reativou a renovação, mas não foi possível atualizar a plataforma. Atualize a página ou tente novamente em instantes.",
        503
      );
    }

    return NextResponse.json({ ok: true, nextDueDate });
  } catch (error) {
    console.error("[ASAAS SUBSCRIPTION] reactivation failed", error);
    return fail("Não foi possível reativar a renovação do plano.", 500);
  }
}
