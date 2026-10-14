import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") {
      const nextServerPath = path.resolve(process.cwd(), "node_modules/next/server.js");
      return nextResolve(pathToFileURL(nextServerPath).href, context);
    }
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const resolvedPath = path.resolve(process.cwd(), `${specifier.slice(2)}.ts`);
    return nextResolve(pathToFileURL(resolvedPath).href, context);
  },
});

const { POST: cancelSubscription } = await import(
  "../app/api/sistema/asaas/subscription/cancel/route.ts"
);
const { POST: reactivateSubscription } = await import(
  "../app/api/sistema/asaas/subscription/reactivate/route.ts"
);

const environmentNames = [
  "ASAAS_ENV",
  "ASAAS_API_URL",
  "ASAAS_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];

async function withEnvironment(callback, fetchImplementation, overrides = {}) {
  const values = {
    ASAAS_ENV: "sandbox",
    ASAAS_API_URL: "https://api-sandbox.asaas.com/v3",
    ASAAS_API_KEY: "local-sandbox-key-not-real",
    SUPABASE_URL: "https://supabase.test.invalid",
    SUPABASE_SECRET_KEY: "local-service-key-not-real",
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-anon-key-not-real",
    ...overrides,
  };
  const previousValues = new Map(
    environmentNames.map((name) => [name, process.env[name]])
  );
  const originalFetch = globalThis.fetch;
  for (const name of environmentNames) {
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

function request() {
  return new Request("http://localhost/api/sistema/asaas/subscription", {
    method: "POST",
    headers: { Authorization: "Bearer local-user-token" },
  });
}

function makeFetchMock(subscription) {
  const state = { subscription, asaasRequests: [], calls: [] };

  state.fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = (init.method ?? "GET").toUpperCase();
    state.calls.push({ url, method, body: init.body ? JSON.parse(String(init.body)) : null });

    if (url.pathname.endsWith("/auth/v1/user")) {
      return Response.json({
        id: "user-test-001",
        aud: "authenticated",
        role: "authenticated",
        email: "owner@test.invalid",
        app_metadata: {},
        user_metadata: {},
      });
    }
    if (url.pathname.endsWith("/rest/v1/organizations")) {
      return Response.json([{ id: "organization-test-001" }]);
    }
    if (url.pathname.endsWith("/rest/v1/organization_subscriptions")) {
      if (method === "GET") return Response.json([state.subscription]);
      if (method === "PATCH") {
        Object.assign(state.subscription, JSON.parse(String(init.body)));
        return new Response(null, { status: 204 });
      }
    }
    if (url.hostname === "api-sandbox.asaas.com") {
      state.asaasRequests.push({ method, body: JSON.parse(String(init.body)) });
      return Response.json({ id: "subscription-test-001", status: "OK" });
    }
    return Response.json({ message: `Unexpected request: ${method} ${url}` }, { status: 404 });
  };

  return state;
}

function activeSubscription(overrides = {}) {
  return {
    id: "subscription-row-test-001",
    status: "active",
    billing_provider: "asaas",
    current_period_end: "2099-11-13T03:00:00.000Z",
    canceled_at: null,
    external_subscription_id: "subscription-test-001",
    ...overrides,
  };
}

test("cancels only the recurring renewal and records cancellation locally", async () => {
  const mock = makeFetchMock(activeSubscription());

  await withEnvironment(async () => {
    const response = await cancelSubscription(request());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
    assert.deepEqual(mock.asaasRequests[0], {
      method: "PUT",
      body: { status: "INACTIVE" },
    });
    assert.ok(mock.subscription.canceled_at);
  }, mock.fetch);
});

test("reactivates renewal on the next period date", async () => {
  const mock = makeFetchMock(activeSubscription({ canceled_at: "2026-10-13T14:00:00.000Z" }));

  await withEnvironment(async () => {
    const response = await reactivateSubscription(request());
    assert.equal(response.status, 200);
    assert.deepEqual(mock.asaasRequests[0], {
      method: "PUT",
      body: { status: "ACTIVE", nextDueDate: "2099-11-13" },
    });
    assert.equal(mock.subscription.canceled_at, null);
  }, mock.fetch);
});

test("does not call Asaas when the subscription ID has not synchronized", async () => {
  const mock = makeFetchMock(activeSubscription({ external_subscription_id: null }));

  await withEnvironment(async () => {
    const response = await cancelSubscription(request());
    assert.equal(response.status, 409);
    assert.equal(mock.asaasRequests.length, 0);
    assert.match((await response.json()).message, /SUBSCRIPTION_CREATED/);
  }, mock.fetch);
});

test("keeps subscription actions locked to Sandbox during homologation", async () => {
  const mock = makeFetchMock(activeSubscription());

  await withEnvironment(async () => {
    const response = await cancelSubscription(request());
    assert.equal(response.status, 503);
    assert.equal(mock.calls.length, 0);
  }, mock.fetch, { ASAAS_ENV: "production" });
});
