import Header from "@/components/Header";
import Services from "@/components/Services";
import Footer from "@/components/Footer";
import { loadPublicProviders } from "@/lib/public-providers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Encontre prestadores em Goiânia | VALLEX ServiçoFácil",
  description: "Pesquise Vitrines públicas por serviço e região em Goiânia. Conheça profissionais e entre em contato diretamente.",
  alternates: { canonical: "/catalogo" },
};

export default async function CatalogoPrestadores() {
  const providers = await loadPublicProviders();
  return (
    <>
      <Header />
      <main>
        <Services initialProviders={providers} />
      </main>
      <Footer />
    </>
  );
}
