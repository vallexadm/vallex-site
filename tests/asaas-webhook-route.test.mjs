import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const localTestToken = "vallex-local-webhook-test-token-not-real-2026";
const localTestTokenHash =
  "e1c102b84aa06f92c6436bc74c3c71f437f8d4f968a737f2622150a19de2ba7e";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      const nextServerPath = path.resolve(
        process.cwd(),
        "node_modules/next/server.js"
      );
      return nextResolve(pathToFileURL(nextServerPath).href, context);
    }

    if (!specifier.startsWith("@/")) {
      return nextResolve(specifier, context);
    }

    const resolvedPath = path.resolve(process.cwd(), `${specifier.slice(2)}.ts`);
    return nextResolve(pathToFileURL(resolvedPath).href, context);
  },
});

const { POST } = await import("../app/api/asaas/webhook/route.ts");
const { asaasPeriodEndFromDueDate } = await import(
  "../lib/server/asaas-billing-dates.ts"
);

function makeRequest(payload, token = localTestToken) {
  const headers = new Headers({ "content-type": "application/json" });
  if (token !== null) headers.set("asaas-access-token", token);

  return new Request("http://localhost/api/asaas/webhook", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

async function responseBody(response) {
  return response.json();
}

async function withTestEnvironment(
  callback,
  fetchImplementation,
  overrides = {}
) {
  const variableNames = [
    "ASAAS_WEBHOOK_TOKEN_SHA256",
    "SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
  ];
  const values = {
    ASAAS_WEBHOOK_TOKEN_SHA256: localTestTokenHash,
    SUPABASE_URL: "https://supabase.test.invalid",
    SUPABASE_SECRET_KEY: "local-test-service-key-not-real",
    ...overrides,
  };
  const previousValues = new Map(
    variableNames.map((name) => [name, process.env[name]])
  );
  const originalFetch = globalThis.fetch;

  for (const name of variableNames) {
    const value = values[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  globalThis.fetch = fetchImplementation;

  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, previousValue] of previousValues) {
      if (previousValue === undefined) delete process.env[name];
      else process.env[name] = previousValue;
    }
  }
}

function makeSupabaseRestMock() {
  const state = {
    webhookEvents: [],
    checkoutSessions: [
      {
        id: "session-test-001",
        organization_id: "organization-test-001",
        plan_id: "plan-basic-test",
        status: "pending",
        asaas_customer_id: null,
        asaas_subscription_id: null,
        asaas_checkout_id: "checkout-test-001",
        external_reference: "external-reference-test-001",
      },
    ],
    organizationSubscriptions: [],
  };
  const calls = [];

  async function fetchMock(input, init = {}) {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const table = url.pathname.split("/").at(-1);
    const method = (init.method ?? "GET").toUpperCase();
    const filters = Object.fromEntries(url.searchParams.entries());
    const body = init.body ? JSON.parse(String(init.body)) : null;
    calls.push({ table, method, filters, body });

    if (method === "GET") {
      let rows = [];
      if (table === "asaas_webhook_events") {
        const eventId = filters.event_id?.replace(/^eq\./, "");
        rows = state.webhookEvents.filter((row) => row.event_id === eventId);
      } else if (table === "asaas_checkout_sessions") {
        const checkoutId = filters.asaas_checkout_id?.replace(/^eq\./, "");
        const externalReference = filters.external_reference?.replace(/^eq\./, "");
        rows = state.checkoutSessions.filter((row) =>
          checkoutId
            ? row.asaas_checkout_id === checkoutId
            : externalReference
              ? row.external_reference === externalReference
              : false
        );
      } else if (table === "organization_subscriptions") {
        const organizationId = filters.organization_id?.replace(/^eq\./, "");
        rows = state.organizationSubscriptions.filter(
          (row) => row.organization_id === organizationId
        );
      } else {
        return Response.json({ message: `Unexpected table: ${table}` }, { status: 404 });
      }

      return Response.json(rows, { status: 200 });
    }

    const targetRows =
      table === "asaas_webhook_events"
        ? state.webhookEvents
        : table === "asaas_checkout_sessions"
          ? state.checkoutSessions
          : table === "organization_subscriptions"
            ? state.organizationSubscriptions
            : null;

    if (!targetRows) {
      return Response.json({ message: `Unexpected table: ${table}` }, { status: 404 });
    }

    if (method === "POST") {
      targetRows.push(
        table === "organization_subscriptions"
          ? { id: "organization-subscription-test-001", ...body }
          : body
      );
      return new Response(null, { status: 201 });
    }

    if (method === "PATCH") {
      const [filterName, filterValue] = Object.entries(filters).find(
        ([, value]) => value.startsWith("eq.")
      ) ?? [];
      const expectedValue = filterValue?.slice(3);
      const matchingRows = targetRows.filter(
        (row) => row[filterName] === expectedValue
      );
      for (const row of matchingRows) Object.assign(row, body);
      return new Response(null, { status: 204 });
    }

    return Response.json({ message: `Unexpected method: ${method}` }, { status: 405 });
  }

  return { state, calls, fetchMock };
}

const paidCheckoutEvent = {
  id: "event-test-paid-001",
  event: "CHECKOUT_PAID",
  checkout: {
    id: "checkout-test-001",
    status: "PAID",
    externalReference: "external-reference-test-001",
    items: [{ name: "Plano Basic - ServiçoFácil" }],
    subscription: { nextDueDate: "2099-11-13" },
  },
};

test("rejects a request without the Asaas token before contacting Supabase", async () => {
  let fetchCalled = false;

  await withTestEnvironment(
    async () => {
      const response = await POST(makeRequest(paidCheckoutEvent, null));
      assert.equal(response.status, 401);
      assert.equal((await responseBody(response)).code, "ASAAS_WEBHOOK_TOKEN_HEADER_MISSING");
      assert.equal(fetchCalled, false);
    },
    async () => {
      fetchCalled = true;
      throw new Error("Supabase mock must not be called for an unauthorized request");
    }
  );
});

test("rejects an incorrect Asaas token before contacting Supabase", async () => {
  let fetchCalled = false;

  await withTestEnvironment(
    async () => {
      const response = await POST(makeRequest(paidCheckoutEvent, "wrong-local-token"));
      assert.equal(response.status, 401);
      assert.equal((await responseBody(response)).code, "ASAAS_WEBHOOK_TOKEN_MISMATCH");
      assert.equal(fetchCalled, false);
    },
    async () => {
      fetchCalled = true;
      throw new Error("Supabase mock must not be called for an unauthorized request");
    }
  );
});

test("reports missing webhook hash configuration as a server error", async () => {
  await withTestEnvironment(
    async () => {
      const response = await POST(makeRequest(paidCheckoutEvent));
      assert.equal(response.status, 503);
      assert.match((await responseBody(response)).message, /hash do token/i);
    },
    async () => {
      throw new Error(
        "Supabase must not be contacted when webhook auth is unconfigured"
      );
    },
    { ASAAS_WEBHOOK_TOKEN_SHA256: "" }
  );
});

test("reports missing Supabase server credentials before database access", async () => {
  await withTestEnvironment(
    async () => {
      const response = await POST(makeRequest(paidCheckoutEvent));
      assert.equal(response.status, 503);
      assert.deepEqual(await responseBody(response), {
        ok: false,
        message: "Configuração do servidor incompleta.",
      });
    },
    async () => {
      throw new Error(
        "Supabase must not be contacted when server credentials are missing"
      );
    },
    { SUPABASE_URL: "" }
  );
});

test("a valid paid checkout activates the plan once and safely handles redelivery", async () => {
  const supabase = makeSupabaseRestMock();

  await withTestEnvironment(async () => {
    const firstResponse = await POST(makeRequest(paidCheckoutEvent));
    assert.equal(firstResponse.status, 200);
    assert.deepEqual(await responseBody(firstResponse), { ok: true });

    assert.equal(supabase.state.checkoutSessions[0].status, "paid");
    assert.equal(supabase.state.organizationSubscriptions.length, 1);
    assert.equal(
      supabase.state.organizationSubscriptions[0].organization_id,
      "organization-test-001"
    );
    assert.equal(
      supabase.state.organizationSubscriptions[0].plan_id,
      "plan-basic-test"
    );
    assert.equal(supabase.state.organizationSubscriptions[0].status, "active");
    assert.equal(
      supabase.state.organizationSubscriptions[0].billing_provider,
      "asaas"
    );
    assert.ok(supabase.state.webhookEvents[0].processed_at);

    const secondResponse = await POST(makeRequest(paidCheckoutEvent));
    assert.equal(secondResponse.status, 200);
    assert.deepEqual(await responseBody(secondResponse), { ok: true, duplicate: true });
    assert.equal(supabase.state.organizationSubscriptions.length, 1);
    assert.equal(
      supabase.calls.filter(
        (call) => call.table === "organization_subscriptions" && call.method === "POST"
      ).length,
      1
    );
  }, supabase.fetchMock);
});

test("moves a due date on the activation day into the next month", () => {
  const paidAt = new Date("2026-10-13T14:19:01.820Z");

  assert.equal(
    asaasPeriodEndFromDueDate("2026-10-13", paidAt),
    "2026-11-13T03:00:00.000Z"
  );
});

test("a subscription-created event keeps a pending checkout inactive", async () => {
  const supabase = makeSupabaseRestMock();
  const subscriptionCreatedEvent = {
    id: "event-test-subscription-created-001",
    event: "SUBSCRIPTION_CREATED",
    subscription: {
      id: "subscription-test-001",
      customer: "customer-test-001",
      externalReference: "external-reference-test-001",
      nextDueDate: "2099-11-13",
    },
  };

  await withTestEnvironment(async () => {
    const response = await POST(makeRequest(subscriptionCreatedEvent));
    assert.equal(response.status, 200);
    assert.deepEqual(await responseBody(response), { ok: true });
    assert.equal(supabase.state.checkoutSessions[0].status, "pending");
    assert.equal(
      supabase.state.checkoutSessions[0].asaas_subscription_id,
      "subscription-test-001"
    );
    assert.equal(supabase.state.organizationSubscriptions.length, 0);
  }, supabase.fetchMock);
});

test("subscription update events synchronize cancellation and reactivation", async () => {
  const supabase = makeSupabaseRestMock();

  await withTestEnvironment(async () => {
    const paidResponse = await POST(makeRequest(paidCheckoutEvent));
    assert.equal(paidResponse.status, 200);

    const createdResponse = await POST(makeRequest({
      id: "event-test-subscription-created-002",
      event: "SUBSCRIPTION_CREATED",
      subscription: {
        id: "subscription-test-001",
        status: "ACTIVE",
        externalReference: "external-reference-test-001",
      },
    }));
    assert.equal(createdResponse.status, 200);
    assert.equal(
      supabase.state.organizationSubscriptions[0].external_subscription_id,
      "subscription-test-001"
    );

    const inactiveResponse = await POST(makeRequest({
      id: "event-test-subscription-updated-inactive-001",
      event: "SUBSCRIPTION_INACTIVATED",
      subscription: {
        id: "subscription-test-001",
        externalReference: "external-reference-test-001",
      },
    }));
    assert.equal(inactiveResponse.status, 200);
    assert.ok(supabase.state.organizationSubscriptions[0].canceled_at);

    const activeResponse = await POST(makeRequest({
      id: "event-test-subscription-updated-active-001",
      event: "SUBSCRIPTION_UPDATED",
      subscription: {
        id: "subscription-test-001",
        status: "ACTIVE",
        externalReference: "external-reference-test-001",
      },
    }));
    assert.equal(activeResponse.status, 200);
    assert.equal(supabase.state.organizationSubscriptions[0].canceled_at, null);
  }, supabase.fetchMock);
});

test("a valid token with a malformed event is rejected before contacting Supabase", async () => {
  let fetchCalled = false;

  await withTestEnvironment(
    async () => {
      const response = await POST(makeRequest({ event: "CHECKOUT_PAID" }));
      assert.equal(response.status, 400);
      assert.deepEqual(await responseBody(response), { ok: false, message: "Evento inválido." });
      assert.equal(fetchCalled, false);
    },
    async () => {
      fetchCalled = true;
      throw new Error("Supabase mock must not be called for an invalid event");
    }
  );
});
