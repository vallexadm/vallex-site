import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
const unavailable = () => NextResponse.json({ ok: false, message: "Link indisponível, expirado ou desativado. Peça um novo link ao prestador." }, { status: 404, headers });
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 256) return unavailable();
    const body = JSON.parse(text);
    if (!body || typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token)) return unavailable();
    const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error("config");
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: link, error } = await admin.from("organization_appointment_tracking")
      .select("appointment_id,expires_at").eq("token_hash", createHash("sha256").update(body.token).digest("hex"))
      .is("revoked_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (error) throw new Error("lookup");
    if (!link) return unavailable();
    const { data: appointment, error: appointmentError } = await admin.from("organization_appointments")
      .select("organization_id,starts_at,ends_at,status,arrival_estimate_at,updated_at").eq("id", link.appointment_id).maybeSingle();
    if (appointmentError) throw new Error("appointment");
    if (!appointment) return unavailable();
    const { data: organization, error: orgError } = await admin.from("organizations").select("name").eq("id", appointment.organization_id).maybeSingle();
    if (orgError) throw new Error("organization");
    if (!organization) return unavailable();
    // Lista explicita: nao retornar titulo livre, notas, cliente, endereco, equipe ou outros compromissos.
    return NextResponse.json({ ok: true, appointment: {
      provider: organization.name, startsAt: appointment.starts_at, endsAt: appointment.ends_at,
      status: appointment.status, arrivalEstimateAt: appointment.status === "on_way" ? appointment.arrival_estimate_at : null,
      updatedAt: appointment.updated_at,
    } }, { headers });
  } catch {
    return NextResponse.json({ ok: false, message: "Não foi possível atualizar o acompanhamento. Tente novamente em instantes." }, { status: 503, headers });
  }
}
