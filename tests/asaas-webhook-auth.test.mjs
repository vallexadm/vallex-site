import { createHash, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import { matchesAsaasWebhookToken } from "../lib/server/asaas-webhook-auth.ts";

// Credencial efêmera exclusiva desta execução; nunca reutiliza configuração real.
const localTestToken = `vallex-test-${randomBytes(32).toString("hex")}`;
const localTestTokenHash = createHash("sha256").update(localTestToken).digest("hex");

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
