import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import Footer from "@/components/Footer";
import { loadPublicProviders } from "@/lib/public-providers";

export const dynamic = "force-dynamic";

export default async function Home() {
  const providers = await loadPublicProviders();

  return (
    <>
      <Header />

      <main>
        <Hero />
        <Services initialProviders={providers} />
      </main>

      <Footer />
    </>
  );
}