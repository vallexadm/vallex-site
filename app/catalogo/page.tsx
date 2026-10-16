import Header from "@/components/Header";
import Services, { type DirectoryFilters } from "@/components/Services";
import Footer from "@/components/Footer";
import { loadPublicProviders } from "@/lib/public-providers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Encontre prestadores em Goiânia | VALLEX ServiçoFácil",
  description: "Pesquise Vitrines públicas por serviço e região em Goiânia. Conheça profissionais e entre em contato diretamente.",
  alternates: { canonical: "/catalogo" },
};

type CatalogSearchParams = Promise<Record<string, string | string[] | undefined>>;

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

export default async function CatalogoPrestadores({ searchParams }: { searchParams: CatalogSearchParams }) {
  const providers = await loadPublicProviders();
  const filters = readDirectoryFilters(await searchParams);
  return (
    <>
      <Header />
      <main>
        <Services initialProviders={providers} initialFilters={filters} />
      </main>
      <Footer />
    </>
  );
}
