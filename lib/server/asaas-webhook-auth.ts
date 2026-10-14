import { createHash, timingSafeEqual } from "node:crypto";

export function matchesAsaasWebhookToken(
  receivedToken: string | null,
  expectedHash: string
) {
  const normalizedToken = receivedToken?.trim();
  if (!normalizedToken || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false;

  const receivedHash = createHash("sha256")
    .update(normalizedToken, "utf8")
    .digest();
  const expectedHashBytes = Buffer.from(expectedHash, "hex");

  return timingSafeEqual(receivedHash, expectedHashBytes);
}
