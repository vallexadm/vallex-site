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

// URLs do Netlify são fornecidas no build, não necessariamente nas Functions.
// Somente o endereço público é incorporado; nenhuma chave é exposta aqui.
function getPublicSiteUrl(): string | undefined {
  if (["deploy-preview", "branch-deploy"].includes(process.env.CONTEXT ?? "")) {
    const preview = process.env.DEPLOY_PRIME_URL;
    if (!preview) throw new Error("O Netlify não informou a URL deste preview.");
    const url = new URL(preview);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".netlify.app")) throw new Error("URL de preview Netlify inválida.");
    return url.origin;
  }
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || undefined;
}

const publicSiteUrl = getPublicSiteUrl();
const nextConfig: NextConfig = {
  allowedDevOrigins: getAllowedDevOrigins(),
  env: publicSiteUrl ? { NEXT_PUBLIC_SITE_URL: publicSiteUrl } : {},
};

export default nextConfig;
