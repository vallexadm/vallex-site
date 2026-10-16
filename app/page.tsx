import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Services, { type DirectoryFilters } from "@/components/Services";
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

type HomeSearchParams = Promise<Record<string, string | string[] | undefined>>;

function readDirectoryFilters(params: Record<string, string | string[] | undefined>): DirectoryFilters | undefined {
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";
  const hasFilters = ["buscar", "servico", "atendimento", "localidade"].some((key) => params[key] !== undefined);
  if (!hasFilters) return undefined;
  const location = first(params.localidade);
  return {
    search: first(params.buscar),
    service: first(params.servico),
    mode: first(params.atendimento),
    location: location === "todas" ? "" : location,
    allLocations: location === "todas",
  };
}

export default async function Home({ searchParams }: { searchParams: HomeSearchParams }) {
  const providers = await loadPublicProviders();
  const filters = readDirectoryFilters(await searchParams);

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
      <Header />

      <main>
        <Hero />
        <Services initialProviders={providers} isHome initialFilters={filters} />
      </main>

      <Footer />
    </>
  );
}
