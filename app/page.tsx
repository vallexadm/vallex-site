import Header from "@/components/Header";
import MarketplaceHome from "@/components/MarketplaceHome";
import { marketplaceFiltersFromParams } from "@/lib/marketplace";
import Footer from "@/components/Footer";
import { loadPublicProviders } from "@/lib/public-providers";
import { absoluteSiteUrl } from "@/lib/seo";
import { siteConfig } from "@/config/site";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prestadores de serviços em Goiânia | VALLEX ServiçoFácil",
  description:
    "Encontre profissionais de Goiânia e região: eletricistas, barbeiros, assistência técnica e outros prestadores. Veja as Vitrines e fale diretamente com cada profissional.",
  alternates: { canonical: "/" },
};

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [providers, params] = await Promise.all([loadPublicProviders(), searchParams]);
  const query = new URLSearchParams();
  for (const [key,value] of Object.entries(params)) if (typeof value === "string") query.set(key,value);
  const filters = marketplaceFiltersFromParams(query);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: siteConfig.name,
            alternateName: siteConfig.brand,
            url: absoluteSiteUrl("/"),
            logo: absoluteSiteUrl("/vallex-logo.png"),
            email: siteConfig.contact.email,
            telephone: siteConfig.contact.phone,
            sameAs: [siteConfig.social.facebook, siteConfig.social.instagram],
          }).replace(/</g, "\\u003c"),
        }}
      />
      <Header initialSearch={filters.search} initialLocation={filters.location} />

      <MarketplaceHome providers={providers} initialFilters={filters} />

      <Footer />
    </>
  );
}
