import Link from "next/link";
import LocalClock from "@/components/LocalClock";

export default function Hero() {
  return (
    <section className="hero hero-home">
      <div className="container hero-content">
        <div className="hero-home-topline">
          <span className="eyebrow">VALLEX SERVIÇOFÁCIL · GOIÂNIA, GO</span>
          <LocalClock variant="dark" />
        </div>

        <div className="hero-home-copy">
          <h1>Encontre prestadores e serviços em Goiânia</h1>
          <p>
            Descubra profissionais, compare serviços e entre em contato. Começamos
            por Goiânia, com espaço para chegar a novas cidades.
          </p>

          <div className="hero-actions">
            <Link href="#prestadores" className="button button-primary">
              Buscar prestador
            </Link>
            <Link href="/solucoes#para-prestadores" className="button button-outline">
              Sou prestador
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
