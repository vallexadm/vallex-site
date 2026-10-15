import Link from "next/link";
import LocalClock from "@/components/LocalClock";

export default async function Hero() {
  const initialTime = new Date().toISOString();
  let initialWeather: { temperature_2m?: number; weather_code?: number } | null = null;

  try {
    const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
    weatherUrl.search = new URLSearchParams({
      latitude: "-16.6869",
      longitude: "-49.2648",
      current: "temperature_2m,weather_code",
      timezone: "America/Sao_Paulo",
    }).toString();
    const response = await fetch(weatherUrl, { next: { revalidate: 900 } });
    if (response.ok) {
      const data = (await response.json()) as { current?: { temperature_2m?: number; weather_code?: number } };
      initialWeather = data.current ?? null;
    }
  } catch {
    // Keep the page available with the clock even if the weather provider is unreachable.
  }

  return (
    <section className="hero hero-home">
      <div className="container hero-content">
        <div className="hero-home-topline">
          <span className="eyebrow">VALLEX SERVIÇOFÁCIL · GOIÂNIA, GO</span>
          <LocalClock variant="dark" initialTime={initialTime} initialWeather={initialWeather} />
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
