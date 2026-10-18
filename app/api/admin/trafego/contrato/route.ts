import { NextResponse } from "next/server";
import { requireTrafficAdmin } from "@/lib/server/traffic-admin";

export const runtime = "nodejs";

const bucketName = "traffic-signed-contracts";
const maxFileSize = 10 * 1024 * 1024;
const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

export async function POST(request: Request) {
  const auth = await requireTrafficAdmin(request, "manage_leads");
  if (!auth.ok) return auth.response;
  const { supabase, userId } = auth.context;

  try {
    const form = await request.formData();
    const leadId = String(form.get("leadId") ?? "");
    const file = form.get("file");
    if (!isUuid(leadId) || !(file instanceof File)) {
      return NextResponse.json({ ok: false, message: "Selecione um PDF assinado e o atendimento correspondente." }, { status: 400 });
    }
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ ok: false, message: "O contrato assinado precisa estar em formato PDF." }, { status: 415 });
    }
    if (file.size < 1 || file.size > maxFileSize) {
      return NextResponse.json({ ok: false, message: "O PDF precisa ter até 10 MB." }, { status: 413 });
    }

    const { data: lead, error: leadError } = await supabase.from("traffic_leads").select("id,signed_contract_path").eq("id", leadId).maybeSingle();
    if (leadError) throw leadError;
    if (!lead) return NextResponse.json({ ok: false, message: "O atendimento não foi encontrado." }, { status: 404 });

    const path = `${leadId}/contrato-assinado.pdf`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
      return NextResponse.json({ ok: false, message: "O arquivo selecionado não parece ser um PDF válido." }, { status: 415 });
    }
    const { error: uploadError } = await supabase.storage.from(bucketName).upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw uploadError;

    const signedAt = new Date().toISOString();
    const storedName = file.name.replace(/[\x00-\x1f\\/]/g, "_").slice(0, 180) || "contrato-assinado.pdf";
    const { error: updateError } = await supabase.from("traffic_leads").update({ signed_contract_path: path, signed_contract_name: storedName, signed_contract_at: signedAt, updated_at: signedAt }).eq("id", leadId);
    if (updateError) throw updateError;
    const { error: activityError } = await supabase.from("traffic_lead_activity").insert({ lead_id: leadId, actor_user_id: userId, event_type: "contrato_assinado", description: `Contrato assinado anexado: ${storedName}.` });
    if (activityError) console.error("Contrato salvo, mas o histórico do atendimento não foi atualizado:", activityError);

    return NextResponse.json({ ok: true, name: storedName, signedAt });
  } catch (error) {
    console.error("Falha ao salvar contrato assinado:", error);
    return NextResponse.json({ ok: false, message: "Não foi possível guardar o PDF. Confira se a migração de contratos assinados foi aplicada." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const auth = await requireTrafficAdmin(request, "manage_leads");
  if (!auth.ok) return auth.response;
  const id = new URL(request.url).searchParams.get("leadId") ?? "";
  if (!isUuid(id)) return NextResponse.json({ ok: false, message: "Identificador inválido." }, { status: 400 });

  const { data: lead, error } = await auth.context.supabase.from("traffic_leads").select("signed_contract_path,signed_contract_name").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ ok: false, message: "Não foi possível consultar o contrato. Confira se a migração foi aplicada." }, { status: 503 });
  if (!lead?.signed_contract_path) return NextResponse.json({ ok: false, message: "Este atendimento ainda não tem contrato assinado anexado." }, { status: 404 });

  const { data, error: linkError } = await auth.context.supabase.storage.from(bucketName).createSignedUrl(lead.signed_contract_path, 60, { download: lead.signed_contract_name ?? "contrato-assinado.pdf" });
  if (linkError || !data?.signedUrl) return NextResponse.json({ ok: false, message: "Não foi possível abrir o contrato assinado." }, { status: 503 });
  return NextResponse.json({ ok: true, url: data.signedUrl }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request) {
  const auth = await requireTrafficAdmin(request, "manage_leads");
  if (!auth.ok) return auth.response;
  const { supabase, userId } = auth.context;

  try {
    const body = await request.json() as Record<string, unknown>;
    const leadId = typeof body.leadId === "string" ? body.leadId : "";
    if (!isUuid(leadId)) return NextResponse.json({ ok: false, message: "Identificador inválido." }, { status: 400 });
    const { data: lead, error: lookupError } = await supabase.from("traffic_leads").select("signed_contract_path,signed_contract_name").eq("id", leadId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!lead?.signed_contract_path) return NextResponse.json({ ok: false, message: "Este atendimento não tem contrato assinado anexado." }, { status: 404 });

    const { error: storageError } = await supabase.storage.from(bucketName).remove([lead.signed_contract_path]);
    if (storageError) throw storageError;
    const { error: updateError } = await supabase.from("traffic_leads").update({ signed_contract_path: null, signed_contract_name: null, signed_contract_at: null, updated_at: new Date().toISOString() }).eq("id", leadId);
    if (updateError) throw updateError;
    const { error: activityError } = await supabase.from("traffic_lead_activity").insert({ lead_id: leadId, actor_user_id: userId, event_type: "contrato_removido", description: `PDF assinado removido do atendimento: ${lead.signed_contract_name ?? "contrato-assinado.pdf"}.` });
    if (activityError) console.error("Contrato removido, mas o histórico do atendimento não foi atualizado:", activityError);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Falha ao remover contrato assinado:", error);
    return NextResponse.json({ ok: false, message: "Não foi possível excluir o PDF assinado." }, { status: 500 });
  }
}
