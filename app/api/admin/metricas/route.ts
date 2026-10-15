import { NextResponse } from "next/server";
import { resolvePlatformAdmin } from "@/lib/server/platform-admin";

export const runtime = "nodejs";

type TimestampRow = { created_at?: string | null; criado_em?: string | null };

function timestamps(rows: TimestampRow[] | null, key: "created_at" | "criado_em") {
  return (rows ?? []).flatMap((row) => row[key] ? [row[key] as string] : []);
}

export async function GET(request: Request) {
  const access = await resolvePlatformAdmin(request);
  if (!access.ok) return access.response;

  const { context } = access;
  const can = (module: string) => context.isOwner || context.permissions[module]?.view === true;
  const [providers, requests, subscriptions, trafficLeads, campaigns] = await Promise.all([
    can("providers") ? context.supabase.from("organizations").select("created_at").order("created_at").range(0, 9999) : Promise.resolve({ data: [], error: null }),
    can("support") ? context.supabase.from("contatos").select("criado_em").order("criado_em").range(0, 9999) : Promise.resolve({ data: [], error: null }),
    can("providers") ? context.supabase.from("organization_subscriptions").select("created_at").order("created_at").range(0, 9999) : Promise.resolve({ data: [], error: null }),
    can("traffic") ? context.supabase.from("traffic_leads").select("created_at").order("created_at").range(0, 9999) : Promise.resolve({ data: [], error: null }),
    can("traffic") ? context.supabase.from("traffic_campaigns").select("created_at").order("created_at").range(0, 9999) : Promise.resolve({ data: [], error: null }),
  ]);

  const warnings = [
    providers.error && "cadastros de prestadores",
    requests.error && "solicitações",
    subscriptions.error && "assinaturas",
    trafficLeads.error && "leads de tráfego",
    campaigns.error && "campanhas",
  ].filter(Boolean);

  return NextResponse.json({
    ok: true,
    series: {
      providers: timestamps(providers.data as TimestampRow[] | null, "created_at"),
      requests: timestamps(requests.data as TimestampRow[] | null, "criado_em"),
      subscriptions: timestamps(subscriptions.data as TimestampRow[] | null, "created_at"),
      trafficLeads: timestamps(trafficLeads.data as TimestampRow[] | null, "created_at"),
      campaigns: timestamps(campaigns.data as TimestampRow[] | null, "created_at"),
    },
    visible: {
      providers: can("providers"),
      requests: can("support"),
      subscriptions: can("providers"),
      trafficLeads: can("traffic"),
      campaigns: can("traffic"),
    },
    warnings,
    updatedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
