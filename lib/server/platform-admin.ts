import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export type PlatformPermissions = Record<string, Record<string, boolean>>;
export type PlatformAdminContext = {
  userId: string;
  isOwner: boolean;
  permissions: PlatformPermissions;
  supabase: SupabaseClient;
};

const modules = ["traffic", "support", "providers", "finance", "sales"] as const;
const actions: Record<(typeof modules)[number], readonly string[]> = {
  traffic: ["view", "manage_plans", "manage_leads", "manage_campaigns"],
  support: ["view", "edit", "delete"],
  providers: ["view", "edit", "delete"],
  finance: ["view", "edit", "delete"],
  sales: ["view", "create", "edit", "delete"],
};

export function ownerPermissions(): PlatformPermissions {
  return Object.fromEntries(modules.map((module) => [module, Object.fromEntries(actions[module].map((action) => [action, true]))]));
}

export function normalizePlatformPermissions(value: unknown): PlatformPermissions {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const normalized = Object.fromEntries(modules.map((module) => {
    const moduleValue = source[module] && typeof source[module] === "object" ? source[module] as Record<string, unknown> : {};
    return [module, Object.fromEntries(actions[module].map((action) => [action, moduleValue[action] === true]))];
  })) as PlatformPermissions;
  normalized.sales.view ||= normalized.sales.create || normalized.sales.edit || normalized.sales.delete;
  return normalized;
}

export async function resolvePlatformAdmin(request: Request): Promise<
  { ok: true; context: PlatformAdminContext } | { ok: false; response: NextResponse }
> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, response: NextResponse.json({ ok: false, message: "Entre na conta autorizada para continuar." }, { status: 401 }) };
  const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const databaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!authUrl || !anonKey || !databaseUrl || !serviceKey) return { ok: false, response: NextResponse.json({ ok: false, message: "A configuração administrativa do servidor está incompleta." }, { status: 503 }) };

  const auth = createClient(authUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) return { ok: false, response: NextResponse.json({ ok: false, message: "Sua sessão expirou. Entre novamente." }, { status: 401 }) };
  const supabase = createClient(databaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const isOwner = data.user.id === process.env.SUPABASE_ADMIN_USER_ID;
  if (isOwner) return { ok: true, context: { userId: data.user.id, isOwner, permissions: ownerPermissions(), supabase } };

  const { data: member, error: memberError } = await supabase.from("platform_admin_members").select("permissions,is_active").eq("user_id", data.user.id).maybeSingle();
  if (memberError) return { ok: false, response: NextResponse.json({ ok: false, code: "ACCESS_SCHEMA_REQUIRED", message: "A tabela de acessos administrativos ainda não foi criada no Supabase de teste." }, { status: 503 }) };
  if (!member?.is_active) return { ok: false, response: NextResponse.json({ ok: false, message: "Esta conta não tem acesso ao painel administrativo." }, { status: 403 }) };
  return { ok: true, context: { userId: data.user.id, isOwner: false, permissions: normalizePlatformPermissions(member.permissions), supabase } };
}

export async function requirePlatformPermission(request: Request, module: string, action: string) {
  const resolved = await resolvePlatformAdmin(request);
  if (!resolved.ok) return resolved;
  if (!resolved.context.isOwner && resolved.context.permissions[module]?.[action] !== true) {
    return { ok: false as const, response: NextResponse.json({ ok: false, message: "Você não tem permissão para esta ação." }, { status: 403 }) };
  }
  return resolved;
}
