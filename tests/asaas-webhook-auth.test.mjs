import assert from "node:assert/strict";
import test from "node:test";
import { matchesAsaasWebhookToken } from "../lib/server/asaas-webhook-auth.ts";

const localTestToken = "vallex-local-webhook-test-token-not-real-2026";
const localTestTokenHash =
  "e1c102b84aa06f92c6436bc74c3c71f437f8d4f968a737f2622150a19de2ba7e";

test("accepts the local fixture when its SHA-256 hash matches", () => {
  assert.equal(
    matchesAsaasWebhookToken(localTestToken, localTestTokenHash),
    true
  );
});

test("rejects a different token", () => {
  assert.equal(
    matchesAsaasWebhookToken("different-local-test-token", localTestTokenHash),
    false
  );
});

test("rejects a missing or blank token", () => {
  assert.equal(matchesAsaasWebhookToken(null, localTestTokenHash), false);
  assert.equal(matchesAsaasWebhookToken("   ", localTestTokenHash), false);
});

test("rejects malformed SHA-256 hashes", () => {
  assert.equal(matchesAsaasWebhookToken(localTestToken, ""), false);
  assert.equal(matchesAsaasWebhookToken(localTestToken, "a".repeat(63)), false);
  assert.equal(matchesAsaasWebhookToken(localTestToken, "g".repeat(64)), false);
});
