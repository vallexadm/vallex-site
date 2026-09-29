import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />

      <main>
        <Hero />
        <Services />
      </main>

      <Footer />
    </>
  );
}