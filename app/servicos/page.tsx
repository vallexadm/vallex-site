import Header from "@/components/Header";
import Services from "@/components/Services";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Serviços | VALLEX SERVIÇOFÁCIL",
  description:
    "Conheça os serviços de informática, elétrica, redes e soluções digitais da VALLEX.",
};

export default function Servicos() {
  return (
    <>
      <Header />

      <main>
        <Services />
      </main>

      <Footer />
    </>
  );
}