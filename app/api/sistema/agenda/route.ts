import { randomBytes, createHash } from "node:crypto";
import { activeAppointmentStatuses, isAppointmentStatus, canTransition, arrivalEstimate, trackingExpiry } from "@/lib/appointment-flow";
import { hasMemberAffiliation } from "@/lib/server/member-affiliation";
import { requireProviderPanelAccess } from "@/lib/server/provider-panel-access";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeMemberPermissions, ownerPermissions } from "@/lib/team-permissions";

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
  if (owned && !await hasMemberAffiliation(admin, user.id)) {
    const accessError = await requireProviderPanelAccess(admin, owned.id);
    if (accessError) return { error: accessError };
    return { admin, user, organization: owned, role: "owner" as Role, permissions: ownerPermissions };
  }

  const { data: membership, error: memberError } = await admin
    .from("organization_members").select("organization_id, role, permissions").eq("is_active", true).eq("user_id", user.id).maybeSingle();
  if (memberError) return { error: reply("Não foi possível consultar sua equipe.", 500) };
  if (!membership || membership.role !== "member") return { error: reply("Organização não encontrada.", 403) };
  const { data: organization, error: organizationError } = await admin
    .from("organizations").select("id, name, owner_id").eq("id", membership.organization_id).maybeSingle();
  if (organizationError || !organization) return { error: reply("Não foi possível carregar a organização.", 500) };
  const accessError = await requireProviderPanelAccess(admin, organization.id);
  if (accessError) return { error: accessError };
  return { admin, user, organization, role: "member" as Role, permissions: normalizeMemberPermissions(membership.permissions) };
}

export async function GET(request: Request) {
  try {
    const context = await getContext(request);
    if ("error" in context) return context.error;
    const { admin, user, organization, role, permissions } = context;
    if (!permissions.agenda.view) return reply("O proprietário ainda não liberou o acesso à Agenda para sua conta.", 403);
    const historyId = new URL(request.url).searchParams.get("history_id");
    if (historyId) {
      if (!uuid(historyId)) return reply("Atendimento inválido.", 400);
      const { data: appointment, error: appointmentError } = await admin.from("organization_appointments").select("id,assigned_to").eq("organization_id", organization.id).eq("id", historyId).maybeSingle();
      if (appointmentError) return reply("Não foi possível consultar o atendimento.", 503);
      if (!appointment || (role === "member" && !permissions.agenda.manage && appointment.assigned_to !== user.id)) return reply("Atendimento não encontrado.", 404);
      const { data: history, error } = await admin.from("organization_appointment_history").select("id,created_at,before_data,after_data").eq("appointment_id", historyId).eq("organization_id", organization.id).order("created_at", { ascending: false }).limit(30);
      if (error) return reply("Não foi possível carregar o histórico.", 503);
      return NextResponse.json({ ok: true, history }, { headers: { "Cache-Control": "no-store" } });
    }
    let query = admin.from("organization_appointments").select(
      "id, title, details, starts_at, ends_at, status, assigned_to, created_by, created_at, updated_at, revision, buffer_minutes, arrival_estimate_at, customers(id, name, phone, address)"
    ).eq("organization_id", organization.id).order("starts_at", { ascending: true });
    if (role === "member" && !permissions.agenda.manage) query = query.eq("assigned_to", user.id);
    const { data: appointments, error } = await query;
    if (error) {
      console.error("Erro ao carregar agenda:", error);
      return reply("Não foi possível carregar a agenda. Confira se a tabela de atendimentos foi criada no Supabase.", 500);
    }

    let customers: { id: string; name: string; phone: string | null; address: string | null }[] = [];
    let team: { id: string; email: string; name: string; role: Role }[] = [];
    if (role === "owner" || permissions.agenda.manage) {
      const [{ data: customerRows, error: customerError }, { data: members, error: membersError }, { data: acceptedInvitations, error: invitationError }] = await Promise.all([
        admin.from("customers").select("id, name, phone, address").eq("organization_id", organization.id).eq("status", "ativo").order("name"),
        admin.from("organization_members").select("user_id, role").eq("is_active", true).eq("organization_id", organization.id),
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
      assigned_name: role === "owner" || permissions.agenda.manage ? namesByUser.get(appointment.assigned_to) ?? "Membro da equipe" : null,
    }));
    return NextResponse.json({ ok: true, organization, role, permissions, appointments: visibleAppointments, customers, team }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Erro na API GET da agenda:", error);
    return reply("Ocorreu um erro ao carregar a agenda.", 500);
  }
}

function mutationError(error: { code?: string } | null) {
  if (error?.code === "23P01") return reply("Este profissional já tem uma reserva nesse período, incluindo o intervalo. Escolha outro horário ou responsável.", 409);
  if (error?.code === "23514") return reply("Confira a situação, os horários e o intervalo do atendimento.", 400);
  if (["42703", "42P01", "PGRST204"].includes(error?.code ?? "")) return reply("A agenda precisa da atualização de estrutura. Entre em contato com a VALLEX.", 503);
  return reply("Não foi possível salvar o atendimento. Tente novamente.", 500);
}
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function POST(request: Request) {
  try {
    const context = await getContext(request);
    if ("error" in context) return context.error;
    const { admin, user, organization, role, permissions } = context;
    if (role !== "owner" && !permissions.agenda.manage) return reply("Seu acesso não permite gerenciar a agenda.", 403);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply("Dados inválidos.", 400);
    const start = new Date(body.starts_at), end = new Date(body.ends_at);
    const buffer = body.buffer_minutes ?? 0;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const details = typeof body.details === "string" ? body.details.trim() : "";
    if (!uuid(body.customer_id) || !uuid(body.assigned_to) || title.length < 2 || title.length > 200 || details.length > 5000 ||
      !body.starts_at || !body.ends_at || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end.getTime()-start.getTime()>86400_000 ||
      !Number.isInteger(buffer) || buffer < 0 || buffer > 240) return reply("Informe cliente, responsável, título, início e término válidos (até 24 horas) e intervalo entre 0 e 240 minutos.", 400);
    const [{ data: customer, error: customerError }, { data: member, error: memberError }] = await Promise.all([
      admin.from("customers").select("id").eq("id", body.customer_id).eq("organization_id", organization.id).eq("status", "ativo").maybeSingle(),
      admin.from("organization_members").select("user_id").eq("organization_id", organization.id).eq("user_id", body.assigned_to).eq("is_active", true).maybeSingle(),
    ]);
    if (customerError || memberError) return reply("Não foi possível verificar cliente e responsável.", 503);
    if (!customer) return reply("Cliente ativo não encontrado na organização.", 404);
    if (body.assigned_to !== organization.owner_id && !member) return reply("Responsável não pertence à equipe ativa.", 400);
    const { data: appointment, error } = await admin.from("organization_appointments").insert({
      organization_id: organization.id, customer_id: body.customer_id, assigned_to: body.assigned_to,
      created_by: user.id, updated_by: user.id, title, details: details || null,
      starts_at: start.toISOString(), ends_at: end.toISOString(), buffer_minutes: buffer, status: "scheduled",
    }).select("id").single();
    if (error) return mutationError(error);
    return NextResponse.json({ ok: true, appointment }, { status: 201 });
  } catch { return reply("Ocorreu um erro ao criar o atendimento.", 500); }
}

export async function PATCH(request: Request) {
  try {
    const context = await getContext(request);
    if ("error" in context) return context.error;
    const { admin, user, organization, role, permissions } = context;
    const body = await request.json().catch(() => null);
    if (!body || !uuid(body.id) || Array.isArray(body)) return reply("Atendimento inválido.", 400);
    const manager = role === "owner" || permissions.agenda.manage;
    if (!permissions.agenda.view || (!manager && !permissions.agenda.updateAssigned)) return reply("Seu acesso não permite atualizar a agenda.", 403);
    const { data: existing, error: readError } = await admin.from("organization_appointments")
      .select("id, assigned_to, status, revision, ends_at, starts_at")
      .eq("id", body.id).eq("organization_id", organization.id).maybeSingle();
    if (readError) return mutationError(readError);
    if (!existing) return reply("Atendimento não encontrado.", 404);
    if (!manager && existing.assigned_to !== user.id) return reply("Você só pode atualizar seus atendimentos.", 403);

    if (["tracking_create", "tracking_revoke"].includes(body.action)) {
      if (!manager) return reply("Somente quem gerencia a agenda pode compartilhar o acompanhamento.", 403);
      if (body.action === "tracking_revoke") {
        const { error } = await admin.from("organization_appointment_tracking").update({ revoked_at: new Date().toISOString() }).eq("appointment_id", existing.id);
        if (error) return mutationError(error);
        return NextResponse.json({ ok: true, message: "Link de acompanhamento desativado." });
      }
      if (!activeAppointmentStatuses.includes(existing.status)) return reply("Gere o acompanhamento para um atendimento ativo.", 409);
      const token = randomBytes(32).toString("hex"), expiresAt = trackingExpiry(existing.ends_at);
      const { error } = await admin.from("organization_appointment_tracking").upsert({
        appointment_id: existing.id, token_hash: createHash("sha256").update(token).digest("hex"),
        expires_at: expiresAt, revoked_at: null, created_by: user.id, created_at: new Date().toISOString(),
      }, { onConflict: "appointment_id" });
      if (error) return mutationError(error);
      // Token permanece no fragmento: nao integra URL de requisicao nem Referer.
      return NextResponse.json({ ok: true, trackingPath: `/acompanhamento#token=${token}`, expiresAt }, { headers: { "Cache-Control": "no-store" } });
    }
    if (!Number.isInteger(body.expected_revision) || body.expected_revision !== existing.revision) return reply("Este atendimento foi atualizado em outra tela. Atualize a agenda antes de tentar novamente.", 409);
    const updates: Record<string, unknown> = { updated_by: user.id };
    if (body.action === "reschedule") {
      if (!manager) return reply("Somente quem gerencia a agenda pode remarcar.", 403);
      if (!activeAppointmentStatuses.includes(existing.status)) return reply("Atendimento encerrado não pode ser remarcado.", 409);
      if (typeof body.reason !== "string" || body.reason.trim().length < 3 || body.reason.length > 500) return reply("Informe o motivo da remarcação (3 a 500 caracteres).", 400);
      const start = new Date(body.starts_at), end = new Date(body.ends_at);
      if (!body.starts_at || !body.ends_at || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end.getTime()-start.getTime()>86400_000 || !uuid(body.assigned_to) || !Number.isInteger(body.buffer_minutes) || body.buffer_minutes<0 || body.buffer_minutes>240) return reply("Confira responsável, início, término e intervalo.", 400);
      if (body.assigned_to !== organization.owner_id) {
        const { data: member, error } = await admin.from("organization_members").select("user_id").eq("organization_id", organization.id).eq("user_id", body.assigned_to).eq("is_active", true).maybeSingle();
        if (error) return reply("Não foi possível verificar o responsável.", 503);
        if (!member) return reply("Responsável não pertence à equipe ativa.", 400);
      }
      Object.assign(updates, { starts_at: start.toISOString(), ends_at: end.toISOString(), assigned_to: body.assigned_to, buffer_minutes: body.buffer_minutes, status: "scheduled", arrival_estimate_at: null, change_reason: body.reason.trim() });
    } else {
      if (body.action !== "status" || Object.keys(body).some(key => !["id", "action", "status", "eta_minutes", "expected_revision"].includes(key))) return reply("Ação inválida.", 400);
      if (!isAppointmentStatus(existing.status) || !isAppointmentStatus(body.status)) return reply("Situação inválida.", 400);
      const refreshingEta = existing.status === "on_way" && body.status === "on_way" && body.eta_minutes !== undefined;
      if (!refreshingEta && !canTransition(existing.status, body.status, manager)) return reply("Esta mudança de situação não é permitida para o atendimento.", 409);
      let estimate: string | null = null;
      if (body.eta_minutes !== undefined) {
        estimate = arrivalEstimate(body.eta_minutes);
        if (body.status !== "on_way" || !estimate) return reply("Informe previsão de 1 a 480 minutos somente durante o deslocamento.", 400);
      }
      Object.assign(updates, { status: body.status, arrival_estimate_at: estimate, change_reason: null });
    }
    const { data: appointment, error } = await admin.from("organization_appointments").update(updates)
      .eq("id", body.id).eq("organization_id", organization.id).eq("revision", body.expected_revision).select("id").maybeSingle();
    if (error) return mutationError(error);
    if (!appointment) return reply("Outro usuário atualizou o atendimento. Atualize a agenda.", 409);
    return NextResponse.json({ ok: true, appointment });
  } catch { return reply("Ocorreu um erro ao atualizar o atendimento.", 500); }
}
