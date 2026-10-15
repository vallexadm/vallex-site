"use client";

import { useEffect, useState } from "react";

type LocalClockProps = {
  variant?: "dark" | "light";
  initialTime?: string;
  initialWeather?: CurrentWeather | null;
};

type VisitorLocation = {
  city?: string | null;
  timezone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type CurrentWeather = {
  temperature_2m?: number;
  weather_code?: number;
};

const goiania = { city: "Goiânia", timezone: "America/Sao_Paulo", latitude: -16.6869, longitude: -49.2648 };

const weatherLabels: Record<number, string> = {
  0: "Céu limpo",
  1: "Poucas nuvens",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Neblina",
  48: "Neblina",
  51: "Garoa leve",
  53: "Garoa",
  55: "Garoa forte",
  61: "Chuva leve",
  63: "Chuva",
  65: "Chuva forte",
  71: "Neve leve",
  73: "Neve",
  75: "Neve forte",
  80: "Pancadas leves",
  81: "Pancadas de chuva",
  82: "Pancadas fortes",
  95: "Trovoadas",
  96: "Trovoadas e granizo",
  99: "Trovoadas e granizo",
};

const timezoneCities: Record<string, string> = {
  "America/Araguaina": "Araguaína",
  "America/Bahia": "Salvador",
  "America/Belem": "Belém",
  "America/Boa_Vista": "Boa Vista",
  "America/Campo_Grande": "Campo Grande",
  "America/Cuiaba": "Cuiabá",
  "America/Fortaleza": "Fortaleza",
  "America/Maceio": "Maceió",
  "America/Manaus": "Manaus",
  "America/Noronha": "Fernando de Noronha",
  "America/Porto_Velho": "Porto Velho",
  "America/Recife": "Recife",
  "America/Rio_Branco": "Rio Branco",
  "America/Santarem": "Santarém",
  "America/Sao_Paulo": "Goiânia",
};

function getTimezoneCity(timezone: string) {
  const city = timezoneCities[timezone] ?? timezone.split("/").pop()?.replaceAll("_", " ");
  return city?.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("pt-BR")) ?? "horário local";
}

export default function LocalClock({ variant = "light", initialTime, initialWeather = null }: LocalClockProps) {
  const [now, setNow] = useState<Date | null>(() => initialTime ? new Date(initialTime) : null);
  const [timezone, setTimezone] = useState(goiania.timezone);
  const [city, setCity] = useState(goiania.city);
  const [weather, setWeather] = useState<CurrentWeather | null>(initialWeather);
  const [weatherMessage, setWeatherMessage] = useState(
    initialWeather ? weatherLabels[initialWeather.weather_code ?? -1] ?? "Condição atual" : "Carregando clima local…",
  );

  useEffect(() => {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || goiania.timezone;
    const locationTimer = window.setTimeout(() => {
      setTimezone(detectedTimezone);
      setCity(getTimezoneCity(detectedTimezone));
    }, 0);

    const updateClock = () => setNow(new Date());
    updateClock();
    const intervalId = window.setInterval(updateClock, 1000);

    let cancelled = false;

    const updateWeather = async () => {
      try {
        const locationResponse = await fetch("/api/visitor-location", { cache: "no-store" });
        if (!locationResponse.ok) throw new Error("Localização indisponível");
        const location = (await locationResponse.json()) as VisitorLocation;
        const latitude = typeof location.latitude === "number" ? location.latitude : goiania.latitude;
        const longitude = typeof location.longitude === "number" ? location.longitude : goiania.longitude;
        const nextCity = location.city?.trim() || getTimezoneCity(location.timezone || detectedTimezone);
        const nextTimezone = location.timezone || detectedTimezone;
        if (!cancelled) {
          setCity(nextCity);
          setTimezone(nextTimezone);
        }

        const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
        weatherUrl.search = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          current: "temperature_2m,weather_code",
          timezone: "auto",
        }).toString();
        const weatherResponse = await fetch(weatherUrl, { cache: "no-store" });
        if (!weatherResponse.ok) throw new Error("Clima indisponível");
        const data = (await weatherResponse.json()) as { current?: CurrentWeather };
        if (!cancelled && data.current) {
          setWeather(data.current);
          setWeatherMessage(weatherLabels[data.current.weather_code ?? -1] ?? "Condição atual");
        }
      } catch {
        if (!cancelled) setWeatherMessage("Clima indisponível no momento");
      }
    };

    void updateWeather();
    const weatherIntervalId = window.setInterval(() => void updateWeather(), 15 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearTimeout(locationTimer);
      window.clearInterval(intervalId);
      window.clearInterval(weatherIntervalId);
    };
  }, []);

  const dark = variant === "dark";
  const time = now?.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: timezone,
  }) ?? "--:--:--";
  const date = now?.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: timezone,
  }) ?? "Horário do dispositivo";

  return (
    <div
      className={`inline-flex items-center gap-3 rounded-xl border px-3 py-2 shadow-sm backdrop-blur-sm ${
        dark
          ? "border-white/15 bg-white/5 text-white"
          : "border-slate-200 bg-white text-slate-800"
      }`}
      aria-label={`Horário e clima local de ${city}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className={`h-5 w-5 flex-none ${dark ? "text-purple-200" : "text-violet-700"}`}
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 7v5l3.2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="min-w-0">
        <span className={`block text-[10px] font-medium uppercase tracking-[0.14em] ${dark ? "text-purple-200" : "text-slate-500"}`}>
          Horário de {city}
        </span>
        <time dateTime={now?.toISOString()} className="block whitespace-nowrap text-sm font-semibold tabular-nums leading-5">
          {time}
        </time>
        <span className={`block whitespace-nowrap text-[10px] capitalize leading-4 ${dark ? "text-white/65" : "text-slate-500"}`}>
          {date}
        </span>
        <span className={`mt-1 block whitespace-nowrap text-[10px] leading-4 ${dark ? "text-white/75" : "text-slate-600"}`} aria-live="polite">
          {weather?.temperature_2m != null ? `${Math.round(weather.temperature_2m)}°C · ${weatherMessage}` : weatherMessage}
        </span>
      </span>
    </div>
  );
}
