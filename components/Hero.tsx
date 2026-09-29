
import Link from "next/link";
import { siteConfig } from "@/config/site";

export default function Hero() {
  return (
    <section className="hero">
      <div className="container hero-content">

        <span className="eyebrow">
          Tecnologia + Soluções
        </span>

        <h1>
          {siteConfig.tagline}
        </h1>

        <p>
          Soluções práticas em informática, serviços elétricos
          e tecnologia para facilitar a rotina de pessoas e empresas.
        </p>

        <div className="hero-actions">
          <Link href="/contato" className="button button-primary">
            Solicitar orçamento
          </Link>

          <Link href="/servicos" className="button button-outline">
            Conhecer serviços
          </Link>
        </div>

      </div>
    </section>
  );
}
