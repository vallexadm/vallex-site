import type { Metadata } from "next";
import Link from "next/link";
import MarketplaceHome from "@/components/MarketplaceHome";
import SystemBrand from "@/components/SystemBrand";
import { marketplaceFiltersFromParams } from "@/lib/marketplace";
import { loadPublicProviders } from "@/lib/public-providers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "App ServiçoFácil | VALLEX",
  robots: { index: false, follow: true },
  appleWebApp: { capable: true, title: "ServiçoFácil" },
  icons: { apple: "/servicofacil-192.png" },
};

export default async function AppHome({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [providers, params] = await Promise.all([loadPublicProviders(), searchParams]);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
  }

  return (
    <>
      <header className="bg-[#17002e] px-4 py-4 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <SystemBrand />
          <nav aria-label="Acessos do app" className="flex flex-wrap gap-2">
          <Link href="/app/cliente" className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-semibold">Área do cliente</Link>
          <Link href="/sistema" className="rounded-lg border border-purple-300 px-4 py-2 text-sm font-semibold">
            Área do prestador
          </Link>
          </nav>
        </div>
      </header>
      <MarketplaceHome compact providers={providers} initialFilters={marketplaceFiltersFromParams(query)} />
    </>
  );
}
