import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TrafficPageClient from "./traffic-page-client";

export const metadata = {
  title: "Tráfego pago para negócios | VALLEX",
  description: "Conheça os modelos de gestão de tráfego pago da VALLEX e solicite uma proposta para o seu negócio.",
};

export default function TrafegoPagoPage() {
  return <><Header /><TrafficPageClient /><Footer /></>;
}
