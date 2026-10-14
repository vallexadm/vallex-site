"use client";

import { useEffect, useState } from "react";

type LocalClockProps = { variant?: "dark" | "light" };

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
  "America/Sao_Paulo": "São Paulo",
};

function getTimezoneCity(timezone: string) {
  const city = timezoneCities[timezone] ?? timezone.split("/").pop()?.replaceAll("_", " ");
  return city?.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("pt-BR")) ?? "horário local";
}

export default function LocalClock({ variant = "light" }: LocalClockProps) {
  const [now, setNow] = useState<Date | null>(null);
  const timezoneCity = now
    ? getTimezoneCity(Intl.DateTimeFormat().resolvedOptions().timeZone)
    : "horário local";

  useEffect(() => {
    const updateClock = () => setNow(new Date());
    updateClock();
    const intervalId = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const dark = variant === "dark";
  const time = now?.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }) ?? "--:--:--";
  const date = now?.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) ?? "Horário do dispositivo";

  return (
    <div
      className={`inline-flex items-center gap-3 rounded-xl border px-3 py-2 shadow-sm backdrop-blur-sm ${
        dark
          ? "border-white/15 bg-white/5 text-white"
          : "border-slate-200 bg-white text-slate-800"
      }`}
      aria-label="Relógio no fuso horário local do dispositivo"
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
          Fuso de {timezoneCity}
        </span>
        <time dateTime={now?.toISOString()} className="block whitespace-nowrap text-sm font-semibold tabular-nums leading-5">
          {time}
        </time>
        <span className={`block whitespace-nowrap text-[10px] capitalize leading-4 ${dark ? "text-white/65" : "text-slate-500"}`}>
          {date}
        </span>
      </span>
    </div>
  );
}
