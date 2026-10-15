import { NextResponse } from "next/server";

// Local development fallback. Netlify's edge function supplies the visitor's
// approximate city, timezone, and coordinates when the site is deployed there.
export function GET() {
  return NextResponse.json(
    {
      city: "Goiânia",
      timezone: "America/Sao_Paulo",
      latitude: -16.6869,
      longitude: -49.2648,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
