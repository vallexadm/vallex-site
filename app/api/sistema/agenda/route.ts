import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Role = "owner" | "member";

function reply(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

function createAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getContext(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { error: reply("Configuração de autenticação incompleta.", 500) };
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: reply("Autenticação necessária.", 401) };
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) return { error: reply("Sessão inválida ou expirada.", 401) };

  const admin = createAdminClient();
  if (!admin) return { error: reply("Configuração do servidor incompleta.", 500) };
  const { data: owned, error: ownerError } = await admin
    .from("organizations").select("id, name, owner_id").eq("owner_id", user.id).maybeSingle();
  if (ownerError) return { error: reply("Não foi possível consultar a organização.", 500) };
  if (owned) return { admin, user, organization: owned, role: "owner" as Role };

  const { data: membership, error: memberError } = await admin
    .from("organization_members").select("organization_id, role").eq("user_id", user.id).maybeSingle();
  if (memberError) return { error: reply("Não foi possível consultar sua equipe.", 500) };
  if (!membership || membership.role !== "member") return { error: reply("Organização não encontrada.", 403) };
  const { data: organization, error: organizationError } = await admin
    .from("organizations").select("id, name, owner_id").eq("id", membership.organization_id).maybeSingle();
  if (organizationError || !organization) return { error: reply("Não foi possível carregar a organização.", 500) };
  return { admin, user, organization, role: "member" as Role };
}

export async function GET(request: Request) {
  try {
    const context = await getContext(request);
    if ("error" in context) return context.error;
    const { admin, user, organization, role } = context;
    let query = admin.from("organization_appointments").select(
      "id, title, details, starts_at, ends_at, status, assigned_to, created_by, created_at, updated_at, customers(id, name, phone, address)"
    ).eq("organization_id", organization.id).order("starts_at", { ascending: true });
    if (role === "member") query = query.eq("assigned_to", user.id);
    const { data: appointments, error } = await query;
    if (error) {
      console.error("Erro ao carregar agenda:", error);
      return reply("Não foi possível carregar a agenda. Confira se a tabela de atendimentos foi criada no Supabase.", 500);
    }

    let customers: { id: string; name: string; phone: string | null; address: string | null }[] = [];
    let team: { id: string; email: string; name: string; role: Role }[] = [];
    if (role === "owner") {
      const [{ data: customerRows, error: customerError }, { data: members, error: membersError }, { data: acceptedInvitations, error: invitationError }] = await Promise.all([
        admin.from("customers").select("id, name, phone, address").eq("organization_id", organization.id).eq("status", "ativo").order("name"),
        admin.from("organization_members").select("user_id, role").eq("organization_id", organization.id),
        admin.from("organization_invitations").select("accepted_by, invitee_name, contact_phone").eq("organization_id", organization.id).eq("status", "accepted"),
      ]);
      if (customerError || membersError || invitationError) return reply("Não foi possível carregar clientes e equipe. Confira a atualização SQL de convites.", 500);
      customers = customerRows ?? [];
      const ids = [...new Set([organization.owner_id, ...(members ?? []).map((item) => item.user_id)].filter(Boolean))];
      const profilesByUser = new Map((acceptedInvitations ?? []).map((invitation) => [invitation.accepted_by, invitation]));
      const users = await Promise.all(ids.map(async (id) => {
        const { data } = await admin.auth.admin.getUserById(id);
        return data.user ? { user: data.user, profile: profilesByUser.get(id) } : null;
      }));
      team = users.filter((item): item is NonNullable<typeof item> => Boolean(item)).map(({ user: item, profile }) => ({
        id: item.id,
        email: item.email ?? "",
        name: profile?.invitee_name?.trim() || (typeof item.user_metadata?.full_name === "string" ? item.user_metadata.full_name.trim() : "") || (item.id === organization.owner_id ? "Proprietário" : "Colaborador"),
        role: item.id === organization.owner_id ? "owner" : "member",
      }));
    }
    const namesByUser = new Map(team.map((person) => [person.id, person.name]));
    const visibleAppointments = (appointments ?? []).map((appointment) => ({
      ...appointment,
      assigned_name: role === "owner" ? namesByUser.get(appointment.assigned_to) ?? "Membro da equipe" : null,
    }));
    return NextResponse.json({ ok: true, organization, role, appointments: visibleAppointments, customers, team });
  } catch (error) {
    console.error("Erro na API GET da agenda:", error);
    return reply("Ocorreu um erro ao carregar a agenda.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getContext(request);
    if ("error" in context) return context.error;
    const { admin, user, organization, role } = context;
    if (role !== "owner") return reply("Somente o proprietário pode criar ou atribuir atendimentos.", 403);
    let body: unknown;
    try { body = await request.json(); } catch { return reply("Corpo da requisição inválido.", 400); }
    if (!body || typeof body !== "object") return reply("Dados do atendimento inválidos.", 400);
    const data = body as Record<string, unknown>;
    const customerId = typeof data.customer_id === "string" ? data.customer_id.trim() : "";
    const assignee = typeof data.assigned_to === "string" ? data.assigned_to.trim() : "";
    const title = typeof data.title === "string" ? data.title.trim() : "";
    const details = typeof data.details === "string" ? data.details.trim() : "";
    const startsAt = typeof data.starts_at === "string" ? new Date(data.starts_at) : new Date(NaN);
    const endsAt = typeof data.ends_at === "string" && data.ends_at ? new Date(data.ends_at) : null;
    if (!/^[0-9a-f-]{36}$/i.test(customerId) || !assignee || !title || Number.isNaN(startsAt.getTime())) return reply("Informe cliente, colaborador, título e data válidos.", 400);
    if (title.length > 200 || details.length > 5000 || (endsAt && Number.isNaN(endsAt.getTime()))) return reply("Confira os dados e os limites dos campos.", 400);
    if (endsAt && endsAt <= startsAt) return reply("O horário final deve ser depois do horário inicial.", 400);
    const [{ data: customer }, { data: ownerMember }, { data: assigneeMember }] = await Promise.all([
      admin.from("customers").select("id").eq("id", customerId).eq("organization_id", organization.id).maybeSingle(),
      Promise.resolve({ data: assignee === organization.owner_id ? { user_id: organization.owner_id } : null }),
      admin.from("organization_members").select("user_id").eq("organization_id", organization.id).eq("user_id", assignee).maybeSingle(),
    ]);
    if (!customer) return reply("O cliente não pertence à organização.", 404);
    if (!ownerMember && !assigneeMember) return reply("O colaborador selecionado não pertence à equipe.", 400);
    const { data: appointment, error } = await admin.from("organization_appointments").insert({
      organization_id: organization.id,
      customer_id: customerId,
      assigned_to: assignee,
      created_by: user.id,
      title,
      details: details || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() ?? null,
      status: "scheduled",
    }).select("id, title, details, starts_at, ends_at, status, assigned_to, customers(id, name, phone, address)").single();
    if (error) {
      console.error("Erro ao criar atendimento:", error);
      return reply("Não foi possível criar o atendimento.", 500);
    }
    return NextResponse.json({ ok: true, appointment }, { status: 201 });
  } catch (error) {
    console.error("Erro na API POST da agenda:", error);
    return reply("Ocorreu um erro ao criar o atendimento.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getContext(request);
    if ("error" in context) return context.error;
    const { admin, user, organization, role } = context;
    let body: unknown;
    try { body = await request.json(); } catch { return reply("Corpo da requisição inválido.", 400); }
    if (!body || typeof body !== "object") return reply("Dados do atendimento inválidos.", 400);
    const data = body as Record<string, unknown>;
    const id = typeof data.id === "string" ? data.id.trim() : "";
    const { data: existing } = await admin.from("organization_appointments").select("id, assigned_to, status").eq("id", id).eq("organization_id", organization.id).maybeSingle();
    if (!existing) return reply("Atendimento não encontrado.", 404);

    if (role === "member") {
      if (existing.assigned_to !== user.id || Object.keys(data).some((key) => !["id", "status"].includes(key))) return reply("Você só pode atualizar o andamento dos seus atendimentos.", 403);
      if (!(["in_progress", "completed"] as unknown[]).includes(data.status)) return reply("Status de atendimento inválido.", 400);
      if (existing.status === "completed" || existing.status === "cancelled") return reply("Este atendimento já foi encerrado.", 409);
      if ((existing.status === "scheduled" && data.status !== "in_progress") || (existing.status === "in_progress" && data.status !== "completed")) return reply("Atualize o atendimento na ordem: iniciar e depois concluir.", 409);
      const { data: appointment, error } = await admin.from("organization_appointments").update({ status: data.status, updated_at: new Date().toISOString() }).eq("id", id).select("id, status").single();
      if (error) return reply("Não foi possível atualizar o atendimento.", 500);
      return NextResponse.json({ ok: true, appointment });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof data.status === "string" && ["scheduled", "in_progress", "completed", "cancelled"].includes(data.status)) updates.status = data.status;
    else return reply("Informe um status válido.", 400);
    const { data: appointment, error } = await admin.from("organization_appointments").update(updates).eq("id", id).select("id, status").single();
    if (error) return reply("Não foi possível atualizar o atendimento.", 500);
    return NextResponse.json({ ok: true, appointment });
  } catch (error) {
    console.error("Erro na API PATCH da agenda:", error);
    return reply("Ocorreu um erro ao atualizar o atendimento.", 500);
  }
}
