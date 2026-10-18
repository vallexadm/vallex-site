import { NextResponse } from "next/server";
import { requireTrafficAdmin } from "@/lib/server/traffic-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireTrafficAdmin(request);
  if (!auth.ok) return auth.response;
  const [leads, campaigns] = await Promise.all([
    auth.context.supabase.from("traffic_leads").select("id,status,archived_at"),
    auth.context.supabase.from("traffic_campaigns").select("lead_id,status,amount_spent"),
  ]);
  if (leads.error || campaigns.error) {
    return NextResponse.json({ ok: false, message: "Indicadores de tráfego ainda indisponíveis." }, { status: 503 });
  }
  const leadRows = (leads.data ?? []).filter((lead) => !lead.archived_at);
  const activeLeadIds = new Set(leadRows.map((lead) => lead.id));
  const campaignRows = (campaigns.data ?? []).filter((campaign) => activeLeadIds.has(campaign.lead_id));
  return NextResponse.json({
    ok: true,
    leads: leadRows.length,
    pendingLeads: leadRows.filter((lead) => !["fechado", "perdido"].includes(lead.status)).length,
    activeCampaigns: campaignRows.filter((campaign) => campaign.status === "ativa").length,
    spend: campaignRows.reduce((total, campaign) => total + Number(campaign.amount_spent ?? 0), 0),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
