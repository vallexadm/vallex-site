import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePlatformPermission, normalizePlatformPermissions } from "@/lib/server/platform-admin";

export const runtime = "nodejs";

async function owner(request: Request) {
  const auth = await requirePlatformPermission(request, "admin_access", "manage");
  if (!auth.ok) return auth;
  if (!auth.context.isOwner) return { ok: false as const, response: NextResponse.json({ ok: false, message: "Somente o administrador proprietário pode gerenciar acessos." }, { status: 403 }) };
  return auth;
}

export async function GET(request: Request) {
  const auth = await owner(request);
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.context.supabase.from("platform_admin_members").select("id,user_id,display_name,role_title,email,permissions,is_active,created_at,updated_at").order("created_at");
  if (error) return NextResponse.json({ ok: false, message: "Não foi possível carregar os acessos. Confira se a migração foi aplicada no Supabase de teste." }, { status: 503 });
  try {
    const members = await linkPendingMembers(auth.context.supabase, data ?? []);
    return NextResponse.json({ ok: true, members }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (linkError) {
    console.error("Falha ao conferir vínculos dos acessos administrativos:", linkError);
    return NextResponse.json({ ok: false, message: "Não foi possível verificar se as contas dos membros já foram criadas." }, { status: 503 });
  }
}

async function findAuthUserId(supabase: SupabaseClient, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.trim().toLowerCase() === normalizedEmail);
    if (user) return user.id;
    if (data.users.length < 100) break;
  }
  return null;
}

async function linkPendingMembers<T extends { id: string; user_id: string | null; email: string | null }>(supabase: SupabaseClient, members: T[]) {
  const claimedUserIds = new Set(members.flatMap((member) => member.user_id ? [member.user_id] : []));
  const linkedMembers: T[] = [];

  for (const member of members) {
    const email = member.email?.trim().toLowerCase();
    if (member.user_id || !email) {
      linkedMembers.push(member);
      continue;
    }

    const userId = await findAuthUserId(supabase, email);
    if (!userId || claimedUserIds.has(userId)) {
      linkedMembers.push(member);
      continue;
    }

    const { data, error } = await supabase
      .from("platform_admin_members")
      .update({ user_id: userId, updated_at: new Date().toISOString() })
      .eq("id", member.id)
      .is("user_id", null)
      .select("id,user_id,display_name,role_title,email,permissions,is_active,created_at,updated_at")
      .maybeSingle();
    if (error) throw error;
    if (data) {
      claimedUserIds.add(userId);
      linkedMembers.push(data as T);
    } else {
      linkedMembers.push(member);
    }
  }

  return linkedMembers;
}

export async function POST(request: Request) {
  const auth = await owner(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const displayName = String(body.display_name ?? "").trim().slice(0, 120);
    const roleTitle = String(body.role_title ?? "").trim().slice(0, 100);
    const email = String(body.email ?? "").trim().toLowerCase() || null;
    if (displayName.length < 2) return NextResponse.json({ ok: false, message: "Informe o nome da pessoa." }, { status: 400 });
    if (roleTitle.length < 2) return NextResponse.json({ ok: false, message: "Informe o cargo ou a função da pessoa na VALLEX." }, { status: 400 });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ ok: false, message: "Informe um e-mail válido." }, { status: 400 });
    const userId = email ? await findAuthUserId(auth.context.supabase, email) : null;
    const { data, error } = await auth.context.supabase.from("platform_admin_members").insert({ display_name: displayName, role_title: roleTitle, email, user_id: userId, permissions: normalizePlatformPermissions(body.permissions), is_active: userId ? body.is_active === true : false }).select("id,user_id,display_name,role_title,email,permissions,is_active").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, member: data, pending: !userId }, { status: 201 });
  } catch (error) {
    console.error("Falha ao criar acesso administrativo:", error);
    return NextResponse.json({ ok: false, message: "Não foi possível salvar. Verifique se o e-mail já está cadastrado." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await owner(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = String(body.id ?? "").trim();
    const displayName = String(body.display_name ?? "").trim().slice(0, 120);
    const roleTitle = String(body.role_title ?? "").trim().slice(0, 100);
    const email = String(body.email ?? "").trim().toLowerCase() || null;
    if (!/^[0-9a-f-]{36}$/i.test(id) || displayName.length < 2 || roleTitle.length < 2) return NextResponse.json({ ok: false, message: "Confira o nome, o cargo e o cadastro selecionado." }, { status: 400 });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ ok: false, message: "Informe um e-mail válido." }, { status: 400 });
    const userId = email ? await findAuthUserId(auth.context.supabase, email) : null;
    const { data, error } = await auth.context.supabase.from("platform_admin_members").update({ display_name: displayName, role_title: roleTitle, email, user_id: userId, permissions: normalizePlatformPermissions(body.permissions), is_active: userId ? body.is_active === true : false, updated_at: new Date().toISOString() }).eq("id", id).select("id,user_id,display_name,role_title,email,permissions,is_active").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, member: data, pending: !userId });
  } catch (error) {
    console.error("Falha ao atualizar acesso administrativo:", error);
    return NextResponse.json({ ok: false, message: "Não foi possível salvar. O e-mail pode já estar vinculado a outro acesso." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await owner(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = String(body.id ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, message: "Cadastro inválido." }, { status: 400 });
    const { error } = await auth.context.supabase.from("platform_admin_members").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Falha ao excluir acesso administrativo:", error);
    return NextResponse.json({ ok: false, message: "Não foi possível excluir este acesso." }, { status: 500 });
  }
}
