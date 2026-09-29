
import type { Metadata } from "next";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ReviewForm from "@/components/ReviewForm";

export const metadata: Metadata = {
  title: "Avalie sua experiência | VALLEX",
  description:
    "Compartilhe sua experiência com os serviços e soluções VALLEX.",
};

export default function AvaliarPage() {
  return (
    <>
      <Header />

      <main>
        <ReviewForm />
      </main>

      <Footer />
    </>
  );
}
