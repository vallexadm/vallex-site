
import type { Metadata } from "next";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ExperiencesContent from "@/components/ExperiencesContent";

export const metadata: Metadata = {
  title: "Experiências de Clientes | VALLEX",
  description:
    "Conheça experiências, avaliações e histórias de clientes que utilizam as soluções VALLEX.",
};

export default function ExperienciasPage() {
  return (
    <>
      <Header />

      <main>
        <ExperiencesContent />
      </main>

      <Footer />
    </>
  );
}
