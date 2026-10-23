import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Nenhum resultado de vínculo é armazenado em cache: uma desativação vale na
// próxima requisição, mesmo quando a conta também possui organização própria.
export async function proxy(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return NextResponse.next(); // A rota mantém sua própria autenticação.
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const secret = process.env.SUPABASE_SECRET_KEY;
    const adminUrl = process.env.SUPABASE_URL;
    if (!url || !anon || !secret || !adminUrl) return NextResponse.json({ ok: false, message: "Não foi possível verificar o acesso." }, { status: 503 });
    const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
    const auth = createClient(url, anon, options);
    const { data: { user }, error: authError } = await auth.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ ok: false, message: "Sessão inválida." }, { status: 401 });
    const admin = createClient(adminUrl, secret, options);
    const { data: memberships, error } = await admin.from("organization_members")
      .select("organization_id, is_active").eq("user_id", user.id).eq("role", "member");
    if (error) throw error;
    if (!memberships?.length) return NextResponse.next();
    if (memberships.length !== 1) return NextResponse.json({ ok: false, code: "MULTIPLE_ORGANIZATIONS", message: "É necessário revisar os vínculos desta conta com a VALLEX." }, { status: 409 });
    if (!memberships[0].is_active) return NextResponse.json({ ok: false, code: "MEMBER_DISABLED", message: "Seu acesso como colaborador foi desativado pelo proprietário. Entre em contato com ele para solicitar a reativação." }, { status: 403 });
    const path = request.nextUrl.pathname;
    const operational = ["/api/sistema/clientes", "/api/sistema/orcamentos", "/api/sistema/agenda", "/api/sistema/financeiro", "/api/sistema/vitrine/servicos", "/api/sistema/suporte"];
    if (operational.includes(path) || (path === "/api/sistema/organizacao" && request.method === "GET")) return NextResponse.next();
    return NextResponse.json({ ok: false, code: "MEMBER_OWNER_ACTION", message: "Esta ação é exclusiva do proprietário. Sua conta está vinculada como colaborador." }, { status: 403 });
  } catch {
    return NextResponse.json({ ok: false, message: "Não foi possível verificar seu acesso. Tente novamente." }, { status: 503 });
  }
}

export const config = { matcher: "/api/sistema/:path*" };
