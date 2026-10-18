import { NextResponse } from "next/server";
import { parseCurrencyInput } from "@/lib/currency";
import { requireTrafficAdmin } from "@/lib/server/traffic-admin";

export const runtime = "nodejs";

const statuses = ["novo", "contato", "proposta", "negociacao", "fechado", "perdido"] as const;
const campaignStatuses = ["planejada", "ativa", "pausada", "concluida"] as const;
const planCodes = ["local", "crescimento", "estrategico"] as const;
const str = (value: unknown, max = 2000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const numberOrNull = (value: unknown) => value === "" || value === null || value === undefined ? null : parseCurrencyInput(value as string | number);
const nonNegative = (value: unknown) => {
  const parsed = numberOrNull(value);
  return parsed === null || (Number.isFinite(parsed) && parsed >= 0) ? parsed : NaN;
};

export async function GET(request: Request) {
  const auth = await requireTrafficAdmin(request);
  if (!auth.ok) return auth.response;
  const { supabase } = auth.context;
  const [plans, leads, campaigns, activity, snapshots] = await Promise.all([
    supabase.from("traffic_service_plans").select("id,code,name,tagline,price_label,description,features,published,sort_order,updated_at").order("sort_order"),
    supabase.from("traffic_leads").select("id,name,phone,email,audience,organization_name,plan_code,need_description,status,service_value,media_budget,responsible_name,source,utm_source,utm_medium,utm_campaign,utm_content,utm_term,referrer,landing_path,facebook_url,instagram_url,signed_contract_path,signed_contract_name,signed_contract_at,created_at,updated_at").order("created_at", { ascending: false }),
    supabase.from("traffic_campaigns").select("id,lead_id,name,channel,status,start_date,end_date,media_budget,amount_spent,impressions,clicks,leads_generated,conversions,notes,created_at").order("created_at", { ascending: false }),
    supabase.from("traffic_lead_activity").select("id,lead_id,event_type,description,created_at,actor_user_id").order("created_at", { ascending: false }).limit(500),
    supabase.from("traffic_campaign_snapshots").select("id,campaign_id,recorded_at,amount_spent,impressions,clicks,leads_generated,conversions,status").order("recorded_at", { ascending: true }).limit(10000),
  ]);
  const error = plans.error ?? leads.error ?? campaigns.error ?? activity.error ?? snapshots.error;
  if (error) {
    console.error("Falha ao carregar operação de tráfego:", error);
    return NextResponse.json({ ok: false, code: "TRAFFIC_SCHEMA_REQUIRED", message: "Confira se as migrações supabase/trafego_pago.sql e supabase/trafego_contratos_assinados.sql foram aplicadas no Supabase de teste." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, plans: plans.data ?? [], leads: leads.data ?? [], campaigns: campaigns.data ?? [], activity: activity.data ?? [], snapshots: snapshots.data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const bodyForPermission = await request.clone().json().catch(() => ({})) as Record<string, unknown>;
  const requestedKind = str(bodyForPermission.kind, 30);
  const auth = await requireTrafficAdmin(request, requestedKind === "contract_dispatch" ? "manage_leads" : "manage_campaigns");
  if (!auth.ok) return auth.response;
  const { supabase, userId } = auth.context;
  try {
    const body = await request.json() as Record<string, unknown>;
    const kind = str(body.kind, 30);
    if (kind === "contract_dispatch") {
      const leadId = str(body.leadId, 50);
      const channel = str(body.channel, 20);
      const fileName = str(body.fileName, 180).replace(/[\x00-\x1f\\/]/g, "_");
      if (!/^[0-9a-f-]{36}$/i.test(leadId) || !fileName || !["whatsapp", "email"].includes(channel)) {
        return NextResponse.json({ ok: false, message: "Informe um atendimento, arquivo e canal de envio válidos." }, { status: 400 });
      }
      const { data: lead, error: leadError } = await supabase.from("traffic_leads").select("id").eq("id", leadId).maybeSingle();
      if (leadError) throw leadError;
      if (!lead) return NextResponse.json({ ok: false, message: "O atendimento não foi encontrado." }, { status: 404 });
      const channelLabel = channel === "whatsapp" ? "WhatsApp" : "e-mail";
      const { error } = await supabase.from("traffic_lead_activity").insert({ lead_id: leadId, actor_user_id: userId, event_type: "contrato_enviado", description: `Contrato compartilhado para assinatura via ${channelLabel}: ${fileName}.` });
      if (error) throw error;
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    const leadId = str(body.leadId, 50);
    const name = str(body.name, 160);
    const channel = str(body.channel, 80);
    if (!leadId || !name || !channel || !/^[0-9a-f-]{36}$/i.test(leadId)) {
      return NextResponse.json({ ok: false, message: "Informe cliente, nome da campanha e canal." }, { status: 400 });
    }
    const budget = nonNegative(body.mediaBudget) ?? 0;
    if (!Number.isFinite(budget)) return NextResponse.json({ ok: false, message: "O orçamento de mídia precisa ser zero ou maior." }, { status: 400 });
    const { data, error } = await supabase.from("traffic_campaigns").insert({
      lead_id: leadId,
      name,
      channel,
      status: "planejada",
      start_date: str(body.startDate, 10) || null,
      end_date: str(body.endDate, 10) || null,
      media_budget: budget ?? 0,
      notes: str(body.notes, 2000) || null,
    }).select("id").single();
    if (error) throw error;
    const { error: snapshotError } = await supabase.from("traffic_campaign_snapshots").insert({ campaign_id: data.id, amount_spent: 0, impressions: 0, clicks: 0, leads_generated: 0, conversions: 0, status: "planejada" });
    if (snapshotError) throw snapshotError;
    await supabase.from("traffic_lead_activity").insert({ lead_id: leadId, actor_user_id: userId, event_type: "campanha", description: `Campanha planejada: ${name} (${channel}).` });
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (error) {
    console.error("Falha ao registrar campanha:", error);
    return NextResponse.json({ ok: false, message: "Não foi possível registrar a campanha." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const bodyForPermission = await request.clone().json().catch(() => ({})) as Record<string, unknown>;
  const kindForPermission = str(bodyForPermission.kind, 20);
  const auth = await requireTrafficAdmin(request, kindForPermission === "plan" ? "manage_plans" : kindForPermission === "campaign" ? "manage_campaigns" : "manage_leads");
  if (!auth.ok) return auth.response;
  const { supabase, userId } = auth.context;
  try {
    const body = await request.json() as Record<string, unknown>;
    const kind = str(body.kind, 20);
    const id = str(body.id, 50);
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, message: "Identificador inválido." }, { status: 400 });

    if (kind === "plan") {
      const code = str(body.code, 40);
      if (!planCodes.includes(code as (typeof planCodes)[number])) return NextResponse.json({ ok: false, message: "Plano inválido." }, { status: 400 });
      if (str(body.name, 100).length < 2) return NextResponse.json({ ok: false, message: "Informe um nome de pelo menos 2 caracteres." }, { status: 400 });
      const features = Array.isArray(body.features) ? body.features.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 180)).filter(Boolean).slice(0, 10) : [];
      const { error } = await supabase.from("traffic_service_plans").update({
        name: str(body.name, 100), tagline: str(body.tagline, 240), price_label: str(body.priceLabel, 100) || "Sob proposta",
        description: str(body.description, 1000), features, published: body.published === true, sort_order: Math.max(1, Math.min(3, Number(body.sortOrder) || 1)), updated_at: new Date().toISOString(),
      }).eq("id", id).eq("code", code);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (kind === "lead") {
      const status = str(body.status, 30);
      if (!statuses.includes(status as (typeof statuses)[number])) return NextResponse.json({ ok: false, message: "Etapa da negociação inválida." }, { status: 400 });
      const serviceValue = nonNegative(body.serviceValue);
      const mediaBudget = nonNegative(body.mediaBudget);
      if ((serviceValue !== null && !Number.isFinite(serviceValue)) || (mediaBudget !== null && !Number.isFinite(mediaBudget))) return NextResponse.json({ ok: false, message: "Valores comerciais não podem ser negativos." }, { status: 400 });
      const facebookUrl = str(body.facebookUrl, 500);
      const instagramUrl = str(body.instagramUrl, 500);
      const isValidSocialUrl = (value: string) => { if (!value) return true; try { const url = new URL(value); return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname); } catch { return false; } };
      if (!isValidSocialUrl(facebookUrl) || !isValidSocialUrl(instagramUrl)) return NextResponse.json({ ok: false, message: "Informe links válidos começando com http:// ou https://." }, { status: 400 });
      const { data: previous, error: lookupError } = await supabase.from("traffic_leads").select("status,service_value,media_budget").eq("id", id).maybeSingle();
      if (lookupError) throw lookupError;
      if (!previous) return NextResponse.json({ ok: false, message: "O contato não foi encontrado." }, { status: 404 });
      const { error } = await supabase.from("traffic_leads").update({ status, service_value: serviceValue, media_budget: mediaBudget, responsible_name: str(body.responsibleName, 160) || null, facebook_url: facebookUrl || null, instagram_url: instagramUrl || null, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      const event = str(body.event, 2000);
      const entries = [
        previous.status !== status ? `Etapa alterada: ${pipelineLabel(previous.status)} → ${pipelineLabel(status)}.` : "",
        Number(previous.service_value ?? 0) !== Number(serviceValue ?? 0) ? `Valor da gestão atualizado${serviceValue === null ? " (não definido)" : ` para R$ ${Number(serviceValue).toFixed(2).replace(".", ",")}`}.` : "",
        Number(previous.media_budget ?? 0) !== Number(mediaBudget ?? 0) ? `Orçamento de mídia atualizado${mediaBudget === null ? " (não definido)" : ` para R$ ${Number(mediaBudget).toFixed(2).replace(".", ",")}`}.` : "",
        event,
      ].filter(Boolean);
      if (entries.length) {
        const { error: activityError } = await supabase.from("traffic_lead_activity").insert(entries.map((description) => ({ lead_id: id, actor_user_id: userId, event_type: "negociacao", description })));
        if (activityError) throw activityError;
      }
      return NextResponse.json({ ok: true });
    }

    if (kind === "campaign") {
      const status = str(body.status, 30);
      if (!campaignStatuses.includes(status as (typeof campaignStatuses)[number])) return NextResponse.json({ ok: false, message: "Etapa da campanha inválida." }, { status: 400 });
      const amountSpent = nonNegative(body.amountSpent);
      const impressions = nonNegative(body.impressions);
      const clicks = nonNegative(body.clicks);
      const leadsGenerated = nonNegative(body.leadsGenerated);
      const conversions = nonNegative(body.conversions);
      if ([amountSpent, impressions, clicks, leadsGenerated, conversions].some((value) => !Number.isFinite(value))) return NextResponse.json({ ok: false, message: "Os indicadores da campanha devem ser iguais ou maiores que zero." }, { status: 400 });
      const { data: campaign, error: lookupError } = await supabase.from("traffic_campaigns").select("lead_id").eq("id", id).maybeSingle();
      if (lookupError) throw lookupError;
      if (!campaign) return NextResponse.json({ ok: false, message: "A campanha não foi encontrada." }, { status: 404 });
      const { error } = await supabase.from("traffic_campaigns").update({ status, amount_spent: amountSpent, impressions, clicks, leads_generated: leadsGenerated, conversions, notes: str(body.notes, 2000) || null, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      const { error: snapshotError } = await supabase.from("traffic_campaign_snapshots").insert({ campaign_id: id, amount_spent: amountSpent, impressions, clicks, leads_generated: leadsGenerated, conversions, status });
      if (snapshotError) throw snapshotError;
      const { error: activityError } = await supabase.from("traffic_lead_activity").insert({ lead_id: campaign.lead_id, actor_user_id: userId, event_type: "indicadores", description: `Indicadores da campanha atualizados (${campaignLabels(status)}). Gasto: R$ ${Number(amountSpent).toFixed(2).replace(".", ",")}; impressões: ${impressions}; cliques: ${clicks}; leads: ${leadsGenerated}; conversões: ${conversions}.` });
      if (activityError) throw activityError;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, message: "Tipo de atualização inválido." }, { status: 400 });
  } catch (error) {
    console.error("Falha ao atualizar módulo de tráfego:", error);
    return NextResponse.json({ ok: false, message: "Não foi possível salvar. Confira se a migração do módulo já foi aplicada." }, { status: 500 });
  }
}

function pipelineLabel(status: string) {
  const labels: Record<string, string> = { novo: "Novo", contato: "Em contato", proposta: "Proposta enviada", negociacao: "Em negociação", fechado: "Fechado", perdido: "Perdido" };
  return labels[status] ?? status;
}

function campaignLabels(status: string) {
  const labels: Record<string, string> = { planejada: "Planejada", ativa: "Ativa", pausada: "Pausada", concluida: "Concluída" };
  return labels[status] ?? status;
}
