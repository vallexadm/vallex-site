import type { MetadataRoute } from "next";
import { loadPublicProviders } from "@/lib/public-providers";
import { absoluteSiteUrl, isLegalServicesProfile } from "@/lib/seo";

export const dynamic = "force-dynamic";

const publicRoutes = [
  "/",
  "/sobre",
  "/servicos",
  "/solucoes",
  "/experiencias",
  "/contato",
  "/catalogo",
  "/trafego-pago",
  "/faq",
  "/termos",
  "/privacidade",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const providers = await loadPublicProviders();
  const publicProfiles = providers.filter(
    (provider) => provider.is_published && provider.slug && !isLegalServicesProfile(provider)
  );

  return [
    ...publicRoutes.map((path) => ({
      url: absoluteSiteUrl(path),
      changeFrequency: "monthly" as const,
    })),
    ...publicProfiles.map((provider) => ({
      url: absoluteSiteUrl(`/prestador/${encodeURIComponent(provider.slug)}`),
      changeFrequency: "weekly" as const,
    })),
  ];
}
