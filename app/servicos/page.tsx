import Header from "@/components/Header";
import Services from "@/components/Services";
import Footer from "@/components/Footer";
import { loadPublicProviders } from "@/lib/public-providers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Serviços | VALLEX SERVIÇOFÁCIL",
  description:
    "Encontre prestadores e serviços publicados na plataforma ServiçoFácil da VALLEX.",
};

export default async function Servicos() {
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