import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePlatformPermission } from "@/lib/server/platform-admin";

export const runtime = "nodejs";

const stages = ["novo", "contato", "qualificacao", "proposta", "aguardando_decisao", "negociacao", "ganho", "perdido"] as const;
const products = ["trafego_pago", "servicofacil", "site_institucional", "desenvolvimento_web", "planilha_automatizada", "consultoria", "outro"] as const;
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const amount = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  const normalized = value.trim().replace(/\s|R\$/gi, "");
  return normalized.includes(",") ? Number(normalized.replace(/\./g, "").replace(",", ".")) : Number(normalized);
};

function readClient(body: Record<string, unknown>) {
  const contactName = text(body.contact_name, 140);
  const companyName = text(body.company_name, 160);
  const product = text(body.product, 40);
  const stage = text(body.stage, 30);
  const email = text(body.email, 180).toLowerCase();
  const phone = text(body.phone, 40);
  const setupValue = amount(body.setup_value);
  const monthlyValue = amount(body.monthly_value);
  if (contactName.length < 2) throw new Error("Informe o nome do cliente ou contato.");
  if (!products.includes(product as (typeof products)[number])) throw new Error("Selecione um produto VALLEX válido.");
  if (!stages.includes(stage as (typeof stages)[number])) throw new Error("Selecione uma etapa comercial válida.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");
  if ([setupValue, monthlyValue].some((value) => value !== null && (!Number.isFinite(value) || value < 0))) throw new Error("Os valores não podem ser negativos.");
  const contractStartDate = text(body.contract_start_date, 10);
  const contractEndDate = text(body.contract_end_date, 10);
  if ((contractStartDate && !/^\d{4}-\d{2}-\d{2}$/.test(contractStartDate)) || (contractEndDate && !/^\d{4}-\d{2}-\d{2}$/.test(contractEndDate))) throw new Error("Confira as datas do período do contrato.");
  if (contractStartDate && contractEndDate && contractEndDate < contractStartDate) throw new Error("O fim do contrato precisa ser posterior ao início.");
  return {
    contact_name: contactName,
    company_name: companyName || null,
    email: email || null,
    phone: phone || null,
    niche: text(body.niche, 120) || null,
    city: text(body.city, 100) || null,
    state: text(body.state, 2).toUpperCase() || null,
    product,
    product_scope: text(body.product_scope, 180) || null,
    stage,
    contract_start_date: contractStartDate || null,
    contract_end_date: contractEndDate || null,
    source: text(body.source, 60) || "prospeccao",
    responsible_name: text(body.responsible_name, 140) || null,
    setup_value: setupValue,
    monthly_value: monthlyValue,
    notes: text(body.notes, 4000) || null,
  };
}

async function recordActivity(supabase: SupabaseClient, clientId: string, userId: string, eventType: string, description: string) {
  const { data } = await supabase.from("platform_admin_members").select("display_name").eq("user_id", userId).maybeSingle();
  const { error } = await supabase.from("vallex_sales_activity").insert({ client_id: clientId, actor_user_id: userId, actor_name: data?.display_name ?? "Administração VALLEX", event_type: eventType, description });
  if (error) throw error;
}

export async function GET(request: Request) {
  const auth = await requirePlatformPermission(request, "sales", "view");
  if (!auth.ok) return auth.response;
  const [clients, activity] = await Promise.all([
    auth.context.supabase.from("vallex_sales_clients").select("*").order("updated_at", { ascending: false }).limit(1000),
    auth.context.supabase.from("vallex_sales_activity").select("*").order("created_at", { ascending: false }).limit(2000),
  ]);
  const error = clients.error ?? activity.error;
  if (error) {
    console.error("Falha ao carregar a área de vendas VALLEX:", error);
    return NextResponse.json({ ok: false, code: "SALES_SCHEMA_REQUIRED", message: "A estrutura de vendas ainda não foi aplicada no Supabase. Execute supabase/vendas_vallex.sql." }, { status: 503 });
  }
  return NextResponse.json({ ok: true, clients: clients.data ?? [], activity: activity.data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const auth = await requirePlatformPermission(request, "sales", "create");
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const client = readClient(body);
    const { data, error } = await auth.context.supabase.from("vallex_sales_clients").insert({ ...client, created_by: auth.context.userId, updated_by: auth.context.userId }).select("id").single();
    if (error) throw error;
    await recordActivity(auth.context.supabase, data.id, auth.context.userId, "cadastro", "Cliente ou oportunidade cadastrado.");
    const note = text(body.activity_note, 2000);
    if (note) await recordActivity(auth.context.supabase, data.id, auth.context.userId, "negociacao", note);
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível cadastrar o cliente.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const requestBody = await request.clone().json().catch(() => ({})) as Record<string, unknown>;
  const auth = await requirePlatformPermission(request, "sales", requestBody.archived === true ? "delete" : "edit");
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = text(body.id, 50);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, message: "Cadastro inválido." }, { status: 400 });
    const { data: previous, error: lookupError } = await auth.context.supabase.from("vallex_sales_clients").select("*").eq("id", id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!previous) return NextResponse.json({ ok: false, message: "Cliente não encontrado." }, { status: 404 });

    if (typeof body.archived === "boolean") {
      const archivedAt = body.archived ? new Date().toISOString() : null;
      const { error } = await auth.context.supabase.from("vallex_sales_clients").update({ archived_at: archivedAt, archived_by: body.archived ? auth.context.userId : null, updated_by: auth.context.userId, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await recordActivity(auth.context.supabase, id, auth.context.userId, body.archived ? "arquivamento" : "restauracao", body.archived ? "Cadastro arquivado." : "Cadastro restaurado para a lista ativa.");
      return NextResponse.json({ ok: true });
    }

    const client = readClient(body);
    const labels: Record<string, string> = { contact_name: "Contato", company_name: "Empresa", email: "E-mail", phone: "Telefone", niche: "Nicho", city: "Cidade", state: "UF", product: "Produto", product_scope: "Plano/escopo", stage: "Etapa", contract_start_date: "Início do contrato", contract_end_date: "Fim do contrato", source: "Origem", responsible_name: "Responsável", setup_value: "Valor de implantação", monthly_value: "Valor mensal", notes: "Observações" };
    const changes = Object.keys(labels).filter((key) => String(previous[key] ?? "") !== String(client[key as keyof typeof client] ?? "")).map((key) => `${labels[key]} atualizado.`);
    const note = text(body.activity_note, 2000);
    const { error } = await auth.context.supabase.from("vallex_sales_clients").update({ ...client, updated_by: auth.context.userId, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    for (const change of changes) await recordActivity(auth.context.supabase, id, auth.context.userId, "edicao", change);
    if (note) await recordActivity(auth.context.supabase, id, auth.context.userId, "negociacao", note);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível atualizar o cadastro.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requirePlatformPermission(request, "sales", "delete");
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = text(body.id, 50);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, message: "Cadastro inválido." }, { status: 400 });
    const { error } = await auth.context.supabase.from("vallex_sales_clients").update({ archived_at: new Date().toISOString(), archived_by: auth.context.userId, updated_by: auth.context.userId, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    await recordActivity(auth.context.supabase, id, auth.context.userId, "arquivamento", "Cadastro arquivado.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Falha ao arquivar cliente da área de vendas:", error);
    return NextResponse.json({ ok: false, message: "Não foi possível arquivar este cadastro." }, { status: 500 });
  }
}
