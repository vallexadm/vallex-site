import type { NextConfig } from "next";

function getAllowedDevOrigins(): string[] {
  if (process.env.NODE_ENV !== "development") return [];

  const callbackBaseUrl = process.env.ASAAS_CALLBACK_BASE_URL?.trim();
  if (!callbackBaseUrl) return [];

  try {
    const url = new URL(callbackBaseUrl);
    return url.protocol === "https:" && url.hostname.endsWith(".trycloudflare.com")
      ? [url.hostname]
      : [];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  allowedDevOrigins: getAllowedDevOrigins(),
};

export default nextConfig;
