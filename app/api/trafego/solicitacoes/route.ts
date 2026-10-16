import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ ok: false, message: "Confira os dados e tente novamente." }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    if (clean(payload.website, 120)) return NextResponse.json({ ok: true, message: "Solicitação recebida." }, { status: 201 });

    const name = clean(payload.name, 120);
    const phone = clean(payload.phone, 30);
    const email = clean(payload.email, 160).toLowerCase();
    const audience = clean(payload.audience, 20);
    const organizationName = clean(payload.organizationName, 160);
    const planCode = clean(payload.planCode, 40);
    const needDescription = clean(payload.needDescription, 3000);
    if (!name || !phone || !needDescription || !["visitante", "cliente", "prestador"].includes(audience) || payload.consent !== true) {
      return NextResponse.json({ ok: false, message: "Preencha nome, telefone, necessidade e aceite o contato da VALLEX." }, { status: 400 });
    }
    if (phone.replace(/\D/g, "").length < 10 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return NextResponse.json({ ok: false, message: "Confira o telefone e o e-mail informados." }, { status: 400 });
    }

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error("A configuração do banco não está disponível.");
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const header = (name: string) => clean(request.headers.get(name), 500) || null;
    const { data, error } = await supabase.from("traffic_leads").insert({
      name,
      phone,
      email: email || null,
      audience,
      organization_name: organizationName || null,
      plan_code: planCode || null,
      need_description: needDescription,
      source: "pagina_trafego",
      utm_source: clean(payload.utm_source, 200) || null,
      utm_medium: clean(payload.utm_medium, 200) || null,
      utm_campaign: clean(payload.utm_campaign, 200) || null,
      utm_content: clean(payload.utm_content, 200) || null,
      utm_term: clean(payload.utm_term, 200) || null,
      referrer: header("referer"),
      landing_path: clean(payload.landingPath, 500) || null,
      consent: true,
    }).select("id").single();
    if (error) throw error;

    if (data?.id) {
      await supabase.from("traffic_lead_activity").insert({
        lead_id: data.id,
        event_type: "entrada",
        description: "Contato recebido pela página pública de tráfego pago.",
      });
    }

    return NextResponse.json({ ok: true, message: "Recebemos seu pedido. A equipe VALLEX entrará em contato." }, { status: 201 });
  } catch (error) {
    console.error("Falha ao registrar interesse em tráfego pago:", error);
    return NextResponse.json({ ok: false, message: "Não foi possível registrar agora. Tente novamente ou fale com a VALLEX pelo contato do site." }, { status: 500 });
  }
}
