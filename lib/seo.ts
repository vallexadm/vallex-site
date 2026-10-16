import type { PublicProvider } from "@/lib/public-providers";

const defaultSiteUrl = "https://vallex.netlify.app";

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || defaultSiteUrl;
  return new URL(configuredUrl).origin;
}

export function absoluteSiteUrl(path: string) {
  return new URL(path, getSiteUrl()).toString();
}

// Until the OAB-compliant public listing and referral model is confirmed,
// legal-service profiles remain shareable but are not indexed or listed in the sitemap.
export function isLegalServicesProfile(provider: Pick<PublicProvider, "display_name" | "description" | "services">) {
  const searchableText = [
    provider.display_name,
    provider.description ?? "",
    ...provider.services.flatMap((service) => [service.name, service.description ?? ""]),
  ].join(" ");

  return /advogad|advocac|jur[ií]dic/i.test(searchableText);
}
