import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizePlatformPermissions, ownerPermissions } from "@/lib/server/platform-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.json({ ok: false, isAdmin: false, isStaff: false }, { status: 401 });
  const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const databaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!authUrl || !anonKey || !databaseUrl || !serviceKey) return NextResponse.json({ ok: false, isAdmin: false, isStaff: false }, { status: 503 });
  const auth = createClient(authUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ ok: false, isAdmin: false, isStaff: false }, { status: 401 });
  if (data.user.id === process.env.SUPABASE_ADMIN_USER_ID) return NextResponse.json({ ok: true, isAdmin: true, isStaff: false, permissions: ownerPermissions() }, { headers: { "Cache-Control": "private, no-store" } });
  const admin = createClient(databaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: member } = await admin.from("platform_admin_members").select("permissions,is_active").eq("user_id", data.user.id).maybeSingle();
  const permissions = member?.is_active ? normalizePlatformPermissions(member.permissions) : {};
  return NextResponse.json({ ok: true, isAdmin: false, isStaff: member?.is_active === true, permissions }, { headers: { "Cache-Control": "private, no-store" } });
}
