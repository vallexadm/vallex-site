import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function response(body: { ok: boolean; isAdmin: boolean }, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!token) return response({ ok: false, isAdmin: false }, 401);

  const authUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminUserId = process.env.SUPABASE_ADMIN_USER_ID;

  if (!authUrl || !anonKey || !adminUserId) {
    return response({ ok: false, isAdmin: false }, 503);
  }

  const authClient = createClient(authUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(token);

  if (error || !data.user) return response({ ok: false, isAdmin: false }, 401);
  if (data.user.id !== adminUserId) return response({ ok: true, isAdmin: false });

  return response({ ok: true, isAdmin: true });
}
